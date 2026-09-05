// NOTOS: opslag en cache van API-keys per provider (Mitch, 5 september 2026).
import { and, eq } from "drizzle-orm";
import { decryptSecret, encryptSecret } from "../../credentials";
import type { Database } from "../../db/client";
import { modelProviderKeys } from "../../db/schema/model-keys";
import {
  isModelProvider,
  type KeyScope,
  type ModelProvider,
} from "./providers";

export type KeyOwner = "deployment" | "workspace" | "personal";

export type ModelKeySummary = {
  scope: KeyOwner;
  scopeId: string;
  provider: Exclude<ModelProvider, "vertex">;
  label: string;
  /** The last four characters, so a person can tell which key this is. Never more. */
  hint: string;
  updatedAt: Date;
};

export class ModelKeyRefusedError extends Error {}

export type ModelKeyStore = {
  list(scope: KeyOwner, scopeId: string): Promise<ModelKeySummary[]>;
  set(input: {
    scope: KeyOwner;
    scopeId: string;
    provider: string;
    key: string;
    label?: string;
    by?: string;
  }): Promise<ModelKeySummary>;
  remove(scope: KeyOwner, scopeId: string, provider: string): Promise<boolean>;
  /** Reads and unseals every key into memory. Called at boot; `startRefresh` repeats it. */
  warm(): Promise<void>;
  startRefresh(intervalMs: number): () => void;
  /**
   * Sync, from the cache: the personal owner's key when the run is in a personal space, then the
   * workspace's, then the deployment's. Null when none of them has one.
   */
  resolve(
    provider: Exclude<ModelProvider, "vertex">,
    scope: KeyScope,
  ): string | null;
};

const cacheKey = (scope: KeyOwner, scopeId: string, provider: string) =>
  `${scope}:${scopeId}:${provider}`;

const hintOf = (key: string) => `…${key.slice(-4)}`;

export function createModelKeyStore(
  database: Database,
  encryptionKey: string,
): ModelKeyStore {
  const cache = new Map<string, string>();

  const summarise = (
    row: typeof modelProviderKeys.$inferSelect,
    plaintext: string,
  ): ModelKeySummary => ({
    scope: row.scope as KeyOwner,
    scopeId: row.scopeId,
    provider: row.provider as Exclude<ModelProvider, "vertex">,
    label: row.label,
    hint: hintOf(plaintext),
    updatedAt: row.updatedAt,
  });

  return {
    async list(scope, scopeId) {
      const rows = await database
        .select()
        .from(modelProviderKeys)
        .where(
          and(
            eq(modelProviderKeys.scope, scope),
            eq(modelProviderKeys.scopeId, scopeId),
          ),
        )
        .orderBy(modelProviderKeys.provider);
      const out: ModelKeySummary[] = [];
      for (const row of rows) {
        const plaintext =
          cache.get(
            cacheKey(row.scope as KeyOwner, row.scopeId, row.provider),
          ) ?? (await decryptSecret(encryptionKey, row.encryptedKey));
        out.push(summarise(row, plaintext));
      }
      return out;
    },

    async set(input) {
      if (!isModelProvider(input.provider) || input.provider === "vertex") {
        throw new ModelKeyRefusedError(
          `${input.provider} is not a provider that takes a key.`,
        );
      }
      const key = input.key.trim();
      if (key.length < 16 || /\s/.test(key)) {
        throw new ModelKeyRefusedError(
          "That does not look like an API key: too short, or it has spaces in it.",
        );
      }
      const encryptedKey = await encryptSecret(encryptionKey, key);
      const [row] = await database
        .insert(modelProviderKeys)
        .values({
          scope: input.scope,
          scopeId: input.scopeId,
          provider: input.provider,
          label: (input.label ?? "").trim().slice(0, 80),
          encryptedKey,
          createdBy: input.by ?? null,
        })
        .onConflictDoUpdate({
          target: [
            modelProviderKeys.scope,
            modelProviderKeys.scopeId,
            modelProviderKeys.provider,
          ],
          set: {
            encryptedKey,
            label: (input.label ?? "").trim().slice(0, 80),
            createdBy: input.by ?? null,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!row) throw new Error("The key could not be written.");
      cache.set(cacheKey(input.scope, input.scopeId, input.provider), key);
      return summarise(row, key);
    },

    async remove(scope, scopeId, provider) {
      const rows = await database
        .delete(modelProviderKeys)
        .where(
          and(
            eq(modelProviderKeys.scope, scope),
            eq(modelProviderKeys.scopeId, scopeId),
            eq(modelProviderKeys.provider, provider),
          ),
        )
        .returning({ id: modelProviderKeys.id });
      cache.delete(cacheKey(scope, scopeId, provider));
      return rows.length > 0;
    },

    async warm() {
      const rows = await database.select().from(modelProviderKeys);
      const fresh = new Map<string, string>();
      for (const row of rows) {
        try {
          fresh.set(
            cacheKey(row.scope as KeyOwner, row.scopeId, row.provider),
            await decryptSecret(encryptionKey, row.encryptedKey),
          );
        } catch {
          // A key sealed with another KEY_ENCRYPTION_KEY: unusable, and said so at run time.
        }
      }
      cache.clear();
      for (const [key, value] of fresh) cache.set(key, value);
    },

    startRefresh(intervalMs) {
      const timer = setInterval(() => {
        void this.warm().catch(() => undefined);
      }, intervalMs);
      timer.unref?.();
      return () => clearInterval(timer);
    },

    resolve(provider, scope) {
      if (scope.personalOwnerId) {
        const personal = cache.get(
          cacheKey("personal", scope.personalOwnerId, provider),
        );
        if (personal) return personal;
      }
      if (scope.workspaceId) {
        const own = cache.get(
          cacheKey("workspace", scope.workspaceId, provider),
        );
        if (own) return own;
      }
      return cache.get(cacheKey("deployment", "", provider)) ?? null;
    },
  };
}
