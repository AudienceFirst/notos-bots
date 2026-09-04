// NOTOS: goedkeuringen voor schrijvende tool-calls (bouwplan stap 5).
import { createHash } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import type { Database } from "../../db/client";
import { approvals } from "../../db/schema/approvals";

/** How long a "yes" stays good for. Long enough for the Bot to retry, short enough to be about now. */
export const APPROVAL_TTL_MS = 10 * 60 * 1000;

export type Approval = {
  id: string;
  workspaceId: string | null;
  threadId: string | null;
  botId: string;
  toolRef: string;
  argsHash: string;
  args: Record<string, unknown>;
  requestedByActor: string | null;
  decidedBy: string | null;
  decision: "granted" | "denied" | null;
  createdAt: Date;
  decidedAt: Date | null;
  usedAt: Date | null;
};

export type ApprovalKey = {
  botId: string;
  toolRef: string;
  argsHash: string;
};

export type ApprovalStore = {
  /** The open question for this exact call, or a new one. Never two open rows for one key. */
  open(input: {
    workspaceId: string | null;
    threadId: string | null;
    botId: string;
    toolRef: string;
    args: Record<string, unknown>;
    requestedByActor: string | null;
  }): Promise<{ approval: Approval; created: boolean }>;
  /**
   * A grant for this exact call that is younger than the TTL and not yet used. Spending it is a
   * separate step, so a refusal further down the gateway does not burn the person's yes.
   */
  findGranted(key: ApprovalKey, now?: Date): Promise<Approval | null>;
  markUsed(id: string, now?: Date): Promise<void>;
  decide(
    id: string,
    decision: "granted" | "denied",
    decidedBy: string,
    now?: Date,
  ): Promise<Approval | null>;
  get(id: string): Promise<Approval | null>;
  /** Open questions in a workspace, newest first; for the thread when given. */
  listOpen(workspaceId: string, threadId?: string): Promise<Approval[]>;
};

/**
 * The same arguments in a different key order are the same call. `JSON.stringify` keeps insertion
 * order, so the keys are sorted first, at every depth.
 */
export function hashArgs(args: Record<string, unknown>): string {
  return createHash("sha256").update(canonical(args)).digest("hex");
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

type Row = typeof approvals.$inferSelect;

function toApproval(row: Row): Approval {
  return {
    id: row.id,
    workspaceId: row.workspaceId ?? null,
    threadId: row.threadId ?? null,
    botId: row.botId,
    toolRef: row.toolRef,
    argsHash: row.argsHash,
    args: row.args,
    requestedByActor: row.requestedByActor ?? null,
    decidedBy: row.decidedBy ?? null,
    decision:
      row.decision === "granted" || row.decision === "denied"
        ? row.decision
        : null,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt ?? null,
    usedAt: row.usedAt ?? null,
  };
}

export function createApprovalStore(database: Database): ApprovalStore {
  const get = async (id: string) => {
    const [row] = await database
      .select()
      .from(approvals)
      .where(eq(approvals.id, id))
      .limit(1);
    return row ? toApproval(row) : null;
  };

  return {
    async open(input) {
      const argsHash = hashArgs(input.args);
      const [existing] = await database
        .select()
        .from(approvals)
        .where(
          and(
            eq(approvals.botId, input.botId),
            eq(approvals.toolRef, input.toolRef),
            eq(approvals.argsHash, argsHash),
            isNull(approvals.decision),
          ),
        )
        .orderBy(desc(approvals.createdAt))
        .limit(1);
      if (existing) return { approval: toApproval(existing), created: false };

      const [row] = await database
        .insert(approvals)
        .values({
          workspaceId: input.workspaceId,
          threadId: input.threadId,
          botId: input.botId,
          toolRef: input.toolRef,
          argsHash,
          args: input.args,
          requestedByActor: input.requestedByActor,
        })
        .returning();
      if (!row) throw new Error("The approval could not be recorded.");
      return { approval: toApproval(row), created: true };
    },

    async findGranted(key, now = new Date()) {
      const since = new Date(now.getTime() - APPROVAL_TTL_MS);
      const [row] = await database
        .select()
        .from(approvals)
        .where(
          and(
            eq(approvals.botId, key.botId),
            eq(approvals.toolRef, key.toolRef),
            eq(approvals.argsHash, key.argsHash),
            eq(approvals.decision, "granted"),
            isNull(approvals.usedAt),
            gt(approvals.decidedAt, since),
          ),
        )
        .orderBy(desc(approvals.decidedAt))
        .limit(1);
      return row ? toApproval(row) : null;
    },

    async markUsed(id, now = new Date()) {
      await database
        .update(approvals)
        .set({ usedAt: now })
        .where(and(eq(approvals.id, id), isNull(approvals.usedAt)));
    },

    async decide(id, decision, decidedBy, now = new Date()) {
      // Only an open row takes a decision; a second click, or a second person, changes nothing.
      const [row] = await database
        .update(approvals)
        .set({ decision, decidedBy, decidedAt: now })
        .where(and(eq(approvals.id, id), isNull(approvals.decision)))
        .returning();
      return row ? toApproval(row) : await get(id);
    },

    get,

    async listOpen(workspaceId, threadId) {
      const rows = await database
        .select()
        .from(approvals)
        .where(
          and(
            eq(approvals.workspaceId, workspaceId),
            isNull(approvals.decision),
            ...(threadId ? [eq(approvals.threadId, threadId)] : []),
          ),
        )
        .orderBy(desc(approvals.createdAt))
        .limit(50);
      return rows.map(toApproval);
    },
  };
}
