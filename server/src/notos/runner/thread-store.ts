/**
 * Threads en hun gebeurtenissen in onze eigen Postgres.
 *
 * Dit is de opslag onder `PostgresAgentRunner`. Alles wat CopilotKit Intelligence voor OpenBot
 * bewaarde (welke threads er zijn, wat erin gezegd is, welke run bezig is) leeft nu in twee tabellen
 * uit `db/schema/threads.ts`. Geen geheugen, geen leren: dat bestond alleen in Intelligence en komt
 * pas terug als een workspace erom vraagt (bouwplan stap 0, "Niet doen").
 */
import type { BaseEvent, Message } from "@ag-ui/client";
import { and, asc, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { agents, threadEvents, threads } from "../../db/schema";

export type ThreadRecord = {
  id: string;
  workspaceId: string | null;
  agentId: string | null;
  ownerUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt: Date | null;
};

export type StoredEvent = { seq: number; runId: string; event: BaseEvent };

export type ThreadStore = {
  /**
   * Zorg dat de thread bestaat. Idempotent: een tweede aanroep vult alleen velden aan die nog leeg
   * waren (agent, eigenaar) en raakt nooit een bestaande waarde kwijt.
   */
  ensure(input: {
    id: string;
    agentId?: string;
    ownerUserId?: string;
    /** Absent: taken from the agent's workspace when an agent is named. */
    workspaceId?: string;
  }): Promise<void>;
  /** Bestaat de thread, en is hij niet verwijderd. */
  exists(threadId: string): Promise<boolean>;
  get(threadId: string): Promise<ThreadRecord | null>;
  /** De berichten zoals de agent ze achterliet aan het eind van de laatste run. Leeg voor een onbekende thread. */
  messages(threadId: string): Promise<Message[]>;
  /** Alle bewaarde gebeurtenissen op volgorde, eventueel zonder die van één run (de run die nu lokaal loopt). */
  events(
    threadId: string,
    options?: { excludingRunId?: string },
  ): Promise<StoredEvent[]>;
  /** Alles boven een `seq`, voor een replica die meekijkt met een run elders. */
  eventsAfter(threadId: string, seq: number): Promise<StoredEvent[]>;
  /** Het eerstvolgende vrije `seq` voor deze thread. */
  nextSeq(threadId: string): Promise<number>;
  appendEvents(
    threadId: string,
    runId: string,
    rows: readonly { seq: number; event: BaseEvent }[],
  ): Promise<void>;
  /** De momentopname na een run, en het tijdstip. */
  finishRun(
    threadId: string,
    input: { messages: readonly Message[] },
  ): Promise<void>;
  list(options?: { ownerUserId?: string }): Promise<ThreadRecord[]>;
};

const record = (row: typeof threads.$inferSelect): ThreadRecord => ({
  id: row.id,
  workspaceId: row.workspaceId,
  agentId: row.agentId,
  ownerUserId: row.ownerUserId,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  lastRunAt: row.lastRunAt,
});

export function createThreadStore(database: Database): ThreadStore {
  return {
    async ensure({ id, agentId, ownerUserId, workspaceId }) {
      let workspace = workspaceId ?? null;
      if (!workspace && agentId) {
        // Een thread hoort bij de workspace van zijn bot; kanalen en routines noemen de bot.
        const [agent] = await database
          .select({ workspaceId: agents.workspaceId })
          .from(agents)
          .where(eq(agents.id, agentId))
          .limit(1);
        workspace = agent?.workspaceId ?? null;
      }
      await database
        .insert(threads)
        .values({
          id,
          ...(agentId ? { agentId } : {}),
          ...(ownerUserId ? { ownerUserId } : {}),
          ...(workspace ? { workspaceId: workspace } : {}),
        })
        .onConflictDoUpdate({
          target: threads.id,
          set: {
            // Alleen aanvullen wat leeg was: `coalesce(excluded, bestaand)`.
            agentId: sql`coalesce(excluded.agent_id, ${threads.agentId})`,
            ownerUserId: sql`coalesce(excluded.owner_user_id, ${threads.ownerUserId})`,
            workspaceId: sql`coalesce(excluded.workspace_id, ${threads.workspaceId})`,
            updatedAt: sql`now()`,
          },
        });
    },

    async exists(threadId) {
      const [row] = await database
        .select({ id: threads.id })
        .from(threads)
        .where(and(eq(threads.id, threadId), isNull(threads.deletedAt)))
        .limit(1);
      return row !== undefined;
    },

    async get(threadId) {
      const [row] = await database
        .select()
        .from(threads)
        .where(and(eq(threads.id, threadId), isNull(threads.deletedAt)))
        .limit(1);
      return row ? record(row) : null;
    },

    async messages(threadId) {
      const [row] = await database
        .select({ snapshot: threads.snapshot })
        .from(threads)
        .where(and(eq(threads.id, threadId), isNull(threads.deletedAt)))
        .limit(1);
      const stored = (row?.snapshot as { messages?: unknown } | undefined)
        ?.messages;
      return Array.isArray(stored) ? (stored as Message[]) : [];
    },

    async events(threadId, options = {}) {
      const rows = await database
        .select({
          seq: threadEvents.seq,
          runId: threadEvents.runId,
          event: threadEvents.event,
        })
        .from(threadEvents)
        .where(
          options.excludingRunId
            ? and(
                eq(threadEvents.threadId, threadId),
                ne(threadEvents.runId, options.excludingRunId),
              )
            : eq(threadEvents.threadId, threadId),
        )
        .orderBy(asc(threadEvents.seq));
      return rows.map((row) => ({
        seq: row.seq,
        runId: row.runId,
        event: row.event as unknown as BaseEvent,
      }));
    },

    async eventsAfter(threadId, seq) {
      const rows = await database
        .select({
          seq: threadEvents.seq,
          runId: threadEvents.runId,
          event: threadEvents.event,
        })
        .from(threadEvents)
        .where(
          and(eq(threadEvents.threadId, threadId), gt(threadEvents.seq, seq)),
        )
        .orderBy(asc(threadEvents.seq));
      return rows.map((row) => ({
        seq: row.seq,
        runId: row.runId,
        event: row.event as unknown as BaseEvent,
      }));
    },

    async nextSeq(threadId) {
      const [row] = await database
        .select({ last: sql<number>`coalesce(max(${threadEvents.seq}), 0)` })
        .from(threadEvents)
        .where(eq(threadEvents.threadId, threadId));
      return Number(row?.last ?? 0) + 1;
    },

    async appendEvents(threadId, runId, rows) {
      if (rows.length === 0) return;
      await database.insert(threadEvents).values(
        rows.map(({ seq, event }) => ({
          threadId,
          runId,
          seq,
          event: event as unknown as Record<string, unknown>,
        })),
      );
    },

    async finishRun(threadId, { messages }) {
      await database
        .update(threads)
        .set({
          snapshot: { messages: [...messages] },
          lastRunAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(eq(threads.id, threadId));
    },

    async list(options = {}) {
      const rows = await database
        .select()
        .from(threads)
        .where(
          options.ownerUserId
            ? and(
                isNull(threads.deletedAt),
                eq(threads.ownerUserId, options.ownerUserId),
              )
            : isNull(threads.deletedAt),
        )
        .orderBy(desc(threads.updatedAt));
      return rows.map(record);
    },
  };
}
