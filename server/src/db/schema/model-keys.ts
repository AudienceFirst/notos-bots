// NOTOS: API-keys voor modelproviders, per deployment, workspace of persoon (Mitch, 5 september 2026).
import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * One row per (scope, owner, provider). The key itself is sealed with `KEY_ENCRYPTION_KEY`, like
 * every other secret this deployment keeps; it is never listed back, only its last four characters.
 *
 * - `deployment` (scope_id ''): an administrator's key, used by every workspace without its own.
 * - `workspace` (scope_id = deployment_packages.id): a client's own key.
 * - `personal` (scope_id = user id): a person's key for their personal space.
 *
 * Subscriptions (Claude Max, Gemini CLI) are not keys and cannot be used from a server; this is
 * API access only, and the person adding a key sees that said on the page.
 */
export const modelProviderKeys = pgTable(
  "model_provider_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: text("scope").notNull(),
    scopeId: text("scope_id").notNull().default(""),
    /** `anthropic`, `openai`, `openrouter` or `google-ai`. Vertex needs no key. */
    provider: text("provider").notNull(),
    label: text("label").notNull().default(""),
    encryptedKey: text("encrypted_key").notNull(),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("model_provider_keys_owner_idx").on(
      table.scope,
      table.scopeId,
      table.provider,
    ),
  ],
);
