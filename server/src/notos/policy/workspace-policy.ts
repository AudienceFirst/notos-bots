// NOTOS: actiebeleid per workspace, met "schrijven alleen na een mens" als standaard (stap 5).
import { eq } from "drizzle-orm";
import type { ActionPolicy } from "../../computer/policy";
import type { Database } from "../../db/client";
import { actionPolicy } from "../../db/schema/computer";

/**
 * What every workspace gets until an administrator writes its own rules.
 *
 * One deny rule: a tool that changes something needs a person's yes first. `approval.granted` is
 * true only when this exact call was approved a moment ago (see `notos/approvals`). Reads pass.
 * This is the NOTOS rule "agents schrijven nooit direct", written as policy rather than as a habit.
 */
export const DEFAULT_WORKSPACE_POLICY: ActionPolicy = Object.freeze({
  mode: "enforce",
  deny: ["mcp.effect == 'write' && !approval.granted"],
  allow: ["true"],
}) as ActionPolicy;

/** The rule text the default deny is recognised by, in refusals and on the Boundaries screen. */
export const NEEDS_APPROVAL_RULE = DEFAULT_WORKSPACE_POLICY.deny[0] as string;

export type WorkspacePolicyStore = {
  /** The workspace's own policy, or the default. Null is a Bot from before the workspaces: default. */
  policyFor(workspaceId: string | null): Promise<ActionPolicy>;
  setFor(workspaceId: string, policy: ActionPolicy, by?: string): Promise<void>;
  resetFor(workspaceId: string): Promise<void>;
  /** Whether the workspace runs on the default or on rules of its own. */
  sourceFor(workspaceId: string): Promise<"default" | "workspace">;
};

const rowId = (workspaceId: string) => `ws:${workspaceId}`;

/** Read on every write-call, so a short cache keeps the gateway off the database for the common case. */
const CACHE_MS = 15_000;

export function createWorkspacePolicyStore(
  database: Database,
): WorkspacePolicyStore {
  const cache = new Map<string, { policy: ActionPolicy; until: number }>();

  const read = async (workspaceId: string): Promise<ActionPolicy | null> => {
    const [row] = await database
      .select()
      .from(actionPolicy)
      .where(eq(actionPolicy.id, rowId(workspaceId)))
      .limit(1);
    if (!row) return null;
    return {
      mode: row.mode as ActionPolicy["mode"],
      deny: [...row.deny],
      allow: [...row.allow],
    };
  };

  return {
    async policyFor(workspaceId) {
      if (workspaceId === null) return DEFAULT_WORKSPACE_POLICY;
      const hit = cache.get(workspaceId);
      const now = Date.now();
      if (hit && hit.until > now) return hit.policy;
      const own = await read(workspaceId);
      const policy = own ?? DEFAULT_WORKSPACE_POLICY;
      cache.set(workspaceId, { policy, until: now + CACHE_MS });
      return policy;
    },

    async setFor(workspaceId, policy, by) {
      await database
        .insert(actionPolicy)
        .values({
          id: rowId(workspaceId),
          workspaceId,
          mode: policy.mode,
          deny: [...policy.deny],
          allow: [...policy.allow],
          updatedBy: by ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: actionPolicy.id,
          set: {
            mode: policy.mode,
            deny: [...policy.deny],
            allow: [...policy.allow],
            updatedBy: by ?? null,
            updatedAt: new Date(),
          },
        });
      cache.delete(workspaceId);
    },

    async resetFor(workspaceId) {
      await database
        .delete(actionPolicy)
        .where(eq(actionPolicy.id, rowId(workspaceId)));
      cache.delete(workspaceId);
    },

    async sourceFor(workspaceId) {
      return (await read(workspaceId)) ? "workspace" : "default";
    },
  };
}
