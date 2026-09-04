import type { MiddlewareHandler } from "hono";
import { createApp as realCreateApp } from "../../src/app";
import type { AppVariables } from "../../src/auth/guards";
import type { NotosIdentity } from "../../src/notos/auth";

/**
 * NOTOS: `createApp` with the session fake the upstream tests were written against (stap 1).
 *
 * Upstream's second argument was a Better Auth service (`api.getSession`) and the third the role
 * repository; the guard combined the two. The real `createApp` now takes a `NotosIdentity`. Rather
 * than rewrite forty call sites, this turns the old pair into the new guard, so a test keeps saying
 * "signed in as this person with this role" the way it did.
 */
type LegacyAuth = {
  handler?: unknown;
  api: {
    getSession: (input: {
      headers: Headers;
      query: { disableCookieCache: boolean };
    }) => Promise<{
      user: {
        id: string;
        email: string;
        name?: string | null;
        image?: string | null;
      };
    } | null>;
  };
};

type RealParameters = Parameters<typeof realCreateApp>;
type Rest = RealParameters extends [unknown, unknown, unknown, ...infer R]
  ? R
  : never;
type RoleRepository = RealParameters[2];

function fromSession(
  auth: LegacyAuth,
  roleRepository: RoleRepository,
): NotosIdentity {
  const actorFor = async (request: Request) => {
    const session = await auth.api.getSession({
      headers: request.headers,
      query: { disableCookieCache: true },
    });
    if (!session) return null;
    const roles = (await roleRepository?.rolesForUser(session.user.id)) ?? [];
    const role = roles.includes("admin")
      ? ("admin" as const)
      : roles.includes("user")
        ? ("user" as const)
        : undefined;
    return { session, role };
  };
  const requireUser: MiddlewareHandler<{ Variables: AppVariables }> = async (
    context,
    next,
  ) => {
    const found = await actorFor(context.req.raw);
    if (!found) {
      return context.json({ error: "Authentication required." }, 401);
    }
    if (!found.role) {
      return context.json({ error: "Authorization required." }, 403);
    }
    context.set("actor", {
      id: found.session.user.id,
      email: found.session.user.email,
      name: found.session.user.name,
      image: found.session.user.image,
      role: found.role,
      // Upstream's tests know no workspaces; a ZUID person reaches every route (stap 2).
      isInternal: true,
    });
    await next();
  };
  return {
    requireUser,
    actorFor: async (request) => {
      const found = await actorFor(request);
      if (!found?.role) return null;
      return {
        id: found.session.user.id,
        email: found.session.user.email,
        name: found.session.user.name,
        image: found.session.user.image,
        role: found.role,
        isInternal: true,
      };
    },
  };
}

export function createApp(
  config: RealParameters[0],
  auth?: LegacyAuth | NotosIdentity,
  roleRepository?: RoleRepository,
  ...rest: Rest
) {
  const identity =
    auth && "api" in auth ? fromSession(auth, roleRepository) : auth;
  return realCreateApp(config, identity, roleRepository, ...rest);
}
