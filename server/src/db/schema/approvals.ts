// NOTOS: goedkeuringen voor schrijvende tool-calls (bouwplan stap 5).
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { deploymentPackages } from "./core";
// Not drizzle's `jsonb`: that one serialises and so does the driver (see core.ts).
import { jsonb } from "./json";

/**
 * One row per write that a Bot wanted to do and a person had to say yes to first.
 *
 * The key is (bot, tool, arguments). A "yes" is for exactly that call: the same Bot calling the same
 * tool with the same arguments within ten minutes goes through once, and then the row is used. A
 * different argument is a different row and a new question. There is no blanket permission per tool
 * on purpose; the NOTOS rule is that every write, every time, passes a person.
 */
export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The workspace the Bot belongs to; null for a Bot from before the workspaces. */
    workspaceId: uuid("workspace_id").references(() => deploymentPackages.id, {
      onDelete: "cascade",
    }),
    /** The thread the call came out of, when the run said so; the card is drawn there. */
    threadId: text("thread_id"),
    botId: text("bot_id").notNull(),
    /** `<server>/<tool>`, as the plugin store names it. */
    toolRef: text("tool_ref").notNull(),
    /** sha256 over the arguments with their keys sorted, so the retry is recognised. */
    argsHash: text("args_hash").notNull(),
    /** The arguments as the Bot sent them, for the person to read before deciding. */
    args: jsonb("args").notNull(),
    /** Who was talking to the Bot when it asked; the person the card is for. */
    requestedByActor: text("requested_by_actor"),
    decidedBy: text("decided_by"),
    /** `granted` or `denied`; null while the question is open. */
    decision: text("decision"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    /** Set when the granted call actually went through; a grant is spent on one call. */
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (table) => [
    index("approvals_key_idx").on(table.botId, table.toolRef, table.argsHash),
    index("approvals_workspace_idx").on(table.workspaceId, table.createdAt),
  ],
);
