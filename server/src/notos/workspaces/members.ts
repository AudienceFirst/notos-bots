// NOTOS: leden per workspace, beheerd door een beheerder (Mitch, 5 september 2026).
import { and, eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { workspaceMembers } from "../../db/schema/campaigns";
import { deploymentPackages } from "../../db/schema/core";
import type { WorkspaceRole } from "./store";

export type WorkspaceMember = {
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  addedBy: string | null;
  createdAt: Date;
};

export const MEMBER_ROLES: readonly WorkspaceRole[] = Object.freeze([
  "zuid",
  "lead",
  "specialist",
  "viewer",
]);

export type MemberStore = {
  list(workspaceId: string): Promise<WorkspaceMember[]>;
  add(input: {
    workspaceId: string;
    email: string;
    role: WorkspaceRole;
    addedBy?: string;
  }): Promise<WorkspaceMember>;
  remove(workspaceId: string, email: string): Promise<boolean>;
  /** slug -> role for one address, across all workspaces; what the actor resolver merges in. */
  membershipsFor(email: string): Promise<Record<string, WorkspaceRole>>;
};

const normalise = (email: string) => email.trim().toLowerCase();

export function createMemberStore(database: Database): MemberStore {
  return {
    async list(workspaceId) {
      const rows = await database
        .select()
        .from(workspaceMembers)
        .where(eq(workspaceMembers.workspaceId, workspaceId))
        .orderBy(workspaceMembers.email);
      return rows.map((row) => ({
        workspaceId: row.workspaceId,
        email: row.email,
        role: row.role as WorkspaceRole,
        addedBy: row.addedBy ?? null,
        createdAt: row.createdAt,
      }));
    },

    async add(input) {
      const email = normalise(input.email);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error(`${input.email} is not an e-mail address.`);
      }
      if (!MEMBER_ROLES.includes(input.role)) {
        throw new Error(`${input.role} is not a role.`);
      }
      const [row] = await database
        .insert(workspaceMembers)
        .values({
          workspaceId: input.workspaceId,
          email,
          role: input.role,
          addedBy: input.addedBy ?? null,
        })
        .onConflictDoUpdate({
          target: [workspaceMembers.workspaceId, workspaceMembers.email],
          set: { role: input.role, addedBy: input.addedBy ?? null },
        })
        .returning();
      if (!row) throw new Error("The member could not be written.");
      return {
        workspaceId: row.workspaceId,
        email: row.email,
        role: row.role as WorkspaceRole,
        addedBy: row.addedBy ?? null,
        createdAt: row.createdAt,
      };
    },

    async remove(workspaceId, email) {
      const rows = await database
        .delete(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.email, normalise(email)),
          ),
        )
        .returning({ email: workspaceMembers.email });
      return rows.length > 0;
    },

    async membershipsFor(email) {
      const rows = await database
        .select({
          slug: deploymentPackages.tenantId,
          role: workspaceMembers.role,
        })
        .from(workspaceMembers)
        .innerJoin(
          deploymentPackages,
          eq(deploymentPackages.id, workspaceMembers.workspaceId),
        )
        .where(eq(workspaceMembers.email, normalise(email)));
      const out: Record<string, WorkspaceRole> = {};
      for (const row of rows) out[row.slug] = row.role as WorkspaceRole;
      return out;
    },
  };
}
