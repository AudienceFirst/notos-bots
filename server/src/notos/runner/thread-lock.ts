/**
 * De run-lock per gesprek, zonder Intelligence.
 *
 * ÉÉN RUN TEGELIJK PER THREAD. Intelligence gaf die lock uit via een Redis-sleutel; hier is het een
 * rij in `work_items` met `kind = "thread-run"` en de thread als sleutel, met een lease die de
 * database-klok bijhoudt (zie `work/queue.ts` voor waarom het altijd de klok van Postgres is).
 *
 * Idempotent voor dezelfde run: `acquire` met een `runId` die de lock al houdt slaagt opnieuw. Dat
 * is bewust, want zowel een routine-beurt als een hop neemt de lock vóór de runner draait, en de
 * runner neemt hem daarna nog eens met hetzelfde run-id. Twee verschillende run-id's op één thread
 * botsen wel: de tweede krijgt `false`, wat de aanroeper als "nu niet" behandelt.
 *
 * Een lease die verloopt is een run waarvan het proces stierf zonder los te laten; de volgende
 * `acquire` neemt hem gewoon over. `work_items.finished_at` is de nette vrijgave.
 */
import { and, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { workItems } from "../../db/schema";

export const THREAD_RUN_KIND = "thread-run";

/** Zelfde waarde als `THREAD_LOCK_TTL_SECONDS` in copilot.ts had: hoe lang een gesprek vast blijft na een gestorven proces. */
export const DEFAULT_THREAD_LOCK_TTL_SECONDS = 120;

export type ThreadLock = {
  /** `true` als deze run de lock nu houdt; `false` als een andere run erin zit. */
  acquire(input: {
    threadId: string;
    runId: string;
    userId?: string;
    agentId?: string;
    ttlSeconds?: number;
  }): Promise<boolean>;
  /** `false` als de lock intussen van iemand anders is: dan hoort de run te stoppen. */
  renew(input: {
    threadId: string;
    runId: string;
    ttlSeconds?: number;
  }): Promise<boolean>;
  release(input: { threadId: string; runId: string }): Promise<void>;
  /** Wie de lock nu houdt, of null. */
  holder(threadId: string): Promise<{ runId: string } | null>;
};

export function createThreadLock(
  database: Database,
  options: { ttlSeconds?: number } = {},
): ThreadLock {
  const defaultTtl = options.ttlSeconds ?? DEFAULT_THREAD_LOCK_TTL_SECONDS;
  const lease = (ttl: number) =>
    sql`now() + make_interval(secs => ${ttl}::double precision)`;

  return {
    async acquire({ threadId, runId, userId, agentId, ttlSeconds }) {
      const ttl = ttlSeconds ?? defaultTtl;
      const payload = {
        ...(userId ? { userId } : {}),
        ...(agentId ? { agentId } : {}),
      };
      const rows = await database
        .insert(workItems)
        .values({
          kind: THREAD_RUN_KIND,
          key: threadId,
          claimedBy: runId,
          leaseUntil: lease(ttl),
          attempts: 1,
          payload,
        })
        .onConflictDoUpdate({
          target: [workItems.kind, workItems.key],
          set: {
            claimedBy: runId,
            leaseUntil: lease(ttl),
            finishedAt: null,
            lastError: null,
            payload,
            attempts: sql`${workItems.attempts} + 1`,
            updatedAt: sql`now()`,
          },
          // Vrij, netjes vrijgegeven, verlopen, of al van deze run: dan mag hij over.
          setWhere: or(
            isNull(workItems.claimedBy),
            isNotNull(workItems.finishedAt),
            lt(workItems.leaseUntil, sql`now()`),
            eq(workItems.claimedBy, runId),
          ),
        })
        .returning({ claimedBy: workItems.claimedBy });
      return rows.length > 0;
    },

    async renew({ threadId, runId, ttlSeconds }) {
      const rows = await database
        .update(workItems)
        .set({
          leaseUntil: lease(ttlSeconds ?? defaultTtl),
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(workItems.kind, THREAD_RUN_KIND),
            eq(workItems.key, threadId),
            eq(workItems.claimedBy, runId),
            isNull(workItems.finishedAt),
          ),
        )
        .returning({ key: workItems.key });
      return rows.length > 0;
    },

    async release({ threadId, runId }) {
      await database
        .update(workItems)
        .set({
          finishedAt: sql`now()`,
          leaseUntil: null,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(workItems.kind, THREAD_RUN_KIND),
            eq(workItems.key, threadId),
            eq(workItems.claimedBy, runId),
            isNull(workItems.finishedAt),
          ),
        );
    },

    async holder(threadId) {
      const [row] = await database
        .select({ claimedBy: workItems.claimedBy })
        .from(workItems)
        .where(
          and(
            eq(workItems.kind, THREAD_RUN_KIND),
            eq(workItems.key, threadId),
            isNotNull(workItems.claimedBy),
            isNull(workItems.finishedAt),
            sql`${workItems.leaseUntil} > now()`,
          ),
        )
        .limit(1);
      return row?.claimedBy ? { runId: row.claimedBy } : null;
    },
  };
}
