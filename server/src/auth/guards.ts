// NOTOS: de Better Auth-sessieguard (createRequireUser, AuthService) is weg; zie notos/auth/guard.ts (stap 1).
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import type { Database } from "../db/client";
import { userRoles } from "../db/schema";
import type { ActorWorkspace } from "../agents/profile-types";
import type { OpenBotRole } from "./roles";

export type AuthenticatedActor = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: OpenBotRole;
  /** NOTOS: whether the address is a ZUID one (INTERNAL_DOMAINS). Absent on the single-user actor. */
  isInternal?: boolean;
  /** NOTOS: for a client guest, the NOTOS clients they may enter and their role there (stap 2). */
  // NOTOS: "zuid" too, for a person an administrator added to a workspace with ZUID-level access.
  memberships?: Record<string, "zuid" | "lead" | "specialist" | "viewer">;
  /** NOTOS: set by `requireWorkspace` for a request under /api/w/:workspace (stap 2). */
  workspace?: ActorWorkspace;
};

export type RoleRepository = {
  rolesForUser: (userId: string) => Promise<OpenBotRole[]>;
};

export type AppVariables = {
  actor: AuthenticatedActor;
};

export function createRoleRepository(database: Database): RoleRepository {
  return {
    rolesForUser: async (userId) => {
      const records = await database
        .select({ role: userRoles.role })
        .from(userRoles)
        .where(eq(userRoles.userId, userId));

      return records.map((record) => record.role);
    },
  };
}

export function requireAdmin(context: Context<{ Variables: AppVariables }>) {
  if (context.var.actor.role !== "admin") {
    return context.json({ error: "Administrator access required." }, 403);
  }

  return undefined;
}
