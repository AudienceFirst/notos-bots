import { describe, expect, test } from "bun:test";
import type { MiddlewareHandler } from "hono";
import { createApp } from "../src/app";
import type { AppVariables } from "../src/auth/guards";
import { loadConfig } from "../src/config";
import type { NotosIdentity } from "../src/notos/auth";
import { testEnvironment } from "./support/environment";

/**
 * NOTOS: the routes behind the session guard, with the guard faked (stap 1).
 *
 * The guard itself is held in tests/notos/identity.test.ts; this holds that createApp mounts it in
 * front of what it should, and that an administrator is decided by the actor's role and nothing else.
 */

const config = loadConfig({
  ...testEnvironment(),
});

function identityOf(actor: AppVariables["actor"] | null): NotosIdentity {
  const requireUser: MiddlewareHandler<{ Variables: AppVariables }> = async (
    context,
    next,
  ) => {
    if (!actor) {
      return context.json({ error: "Authentication required." }, 401);
    }
    context.set("actor", actor);
    await next();
  };
  return { requireUser, actorFor: async () => actor };
}

const member = {
  id: "member",
  email: "member@openbot.test",
  name: "OpenBot Member",
  image: "https://example.test/member.png",
  role: "user" as const,
  isInternal: false,
};

describe("server authorization", () => {
  test("returns 401 when a protected route has no session", async () => {
    const app = createApp(config, identityOf(null), {
      rolesForUser: async () => [],
    });

    const response = await app.request("http://openbot.local/api/me");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication required.",
    });
  });

  test("denies a signed-in user from an administrator route", async () => {
    const app = createApp(config, identityOf(member), {
      rolesForUser: async () => ["user"],
    });

    const response = await app.request("http://openbot.local/api/admin/status");

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Administrator access required.",
    });
  });

  test("returns the authenticated user actor, with whether they are ZUID", async () => {
    const app = createApp(config, identityOf(member), {
      rolesForUser: async () => ["user"],
    });

    const response = await app.request("http://openbot.local/api/me");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      user: {
        ...member,
        // No store was passed, so this deployment tracks no onboarding and the app gates nobody.
        onboarding: null,
      },
      // NOTOS: no workspace store was passed either, so there is nothing to enter (stap 2).
      workspaces: [],
    });
  });

  test("allows an administrator to reach an administrator route", async () => {
    const app = createApp(
      config,
      identityOf({ ...member, id: "admin", role: "admin", isInternal: true }),
      { rolesForUser: async () => ["admin"] },
    );

    const response = await app.request("http://openbot.local/api/admin/status");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  test("answers 503 when sign-in is not configured and nobody said single-user", async () => {
    const open = loadConfig({
      ...testEnvironment(),
      SUPABASE_URL: undefined,
      SUPABASE_PUBLISHABLE_KEY: undefined,
      OPENBOT_SINGLE_USER: "true",
    });
    // Single-user: everybody is the one administrator, no identity needed.
    const app = createApp(open, undefined, { rolesForUser: async () => [] });
    const response = await app.request("http://openbot.local/api/me");
    expect(response.status).toBe(200);
  });
});
