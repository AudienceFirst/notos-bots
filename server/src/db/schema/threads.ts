// NOTOS: gesprekken in eigen Postgres in plaats van CopilotKit Intelligence (bouwplan stap 0).
import {
  bigserial,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { deploymentPackages } from "./core";
import { jsonb } from "./json";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/**
 * Een gesprek. Eén rij per thread-id, zoals `thread-identity.ts` die munt.
 *
 * `id` is tekst en geen `uuid`-kolom: de rest van het schema (`intelligence_channel_mappings.thread_id`)
 * bewaart thread-id's als tekst, en een kolomtype dat strenger is dan zijn buren levert alleen
 * cast-fouten op bij de eerste join.
 *
 * `workspace_id` blijft leeg tot stap 2 de workspace-dimensie toevoegt.
 *
 * `snapshot` is wat de agent aan berichten overhield toen de laatste run eindigde, als
 * `{ messages: Message[] }`. Dat is dezelfde momentopname die de in-memory runner van CopilotKit
 * bijhoudt, en het is wat de browser leest om een gesprek te heropenen. De gebeurtenissen zelf
 * staan in `thread_events`; daaruit is de momentopname in principe te herleiden, maar niemand
 * hoeft dat bij elk openen te doen.
 */
export const threads = pgTable("threads", {
  id: text("id").primaryKey(),
  /** The workspace (deployment package) this conversation belongs to. Null only for rows older than stap 2. */
  workspaceId: uuid("workspace_id").references(() => deploymentPackages.id, {
    onDelete: "set null",
  }),
  agentId: text("agent_id"),
  ownerUserId: text("owner_user_id"),
  snapshot: jsonb("snapshot").notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

/**
 * Elke AG-UI-gebeurtenis van elke run, in volgorde.
 *
 * `seq` loopt per thread op en is uniek per thread; de run-lock (`notos/runner/thread-lock.ts`)
 * garandeert dat maar één run tegelijk schrijft, dus de teller kan in het proces leven zolang de
 * lock gehouden wordt. Een tweede replica die meekijkt leest alles boven het laatste `seq` dat
 * hij zag.
 */
export const threadEvents = pgTable(
  "thread_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    runId: text("run_id").notNull(),
    seq: integer("seq").notNull(),
    event: jsonb("event").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("thread_events_thread_seq_idx").on(table.threadId, table.seq),
    index("thread_events_run_idx").on(table.threadId, table.runId),
  ],
);
