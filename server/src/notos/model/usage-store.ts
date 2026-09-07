// NOTOS: het gemeten modelverbruik bewaren en teruglezen (Mitch, 7 september 2026).
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { modelUsage } from "../../db/schema/model-usage";
import type { UsageRecord } from "./usage";

export type UsageLine = {
  provider: string;
  modelName: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  lastUsedAt: string | null;
};

export type UsageStore = {
  /**
   * Wegschrijven zonder de aanroeper te laten wachten.
   *
   * Het antwoord van het model is al onderweg naar de lezer als dit gebeurt; erop wachten zou een
   * gesprek trager maken voor een getal dat niemand op dat moment leest. Mislukt het, dan is er een
   * regel minder in het overzicht, en dat is minder erg dan een run die blijft hangen.
   */
  record(usage: UsageRecord): void;
  /** Opgeteld per model, zwaarste eerst. Zonder workspace: alles wat deze omgeving deed. */
  summary(input: {
    workspaceId?: string | null;
    since: Date;
  }): Promise<UsageLine[]>;
};

export function createUsageStore(database: Database): UsageStore {
  return {
    record(usage) {
      /*
       * Een async-blokje, en niet `void insert().catch()`: de query van drizzle wordt pas gedaan
       * als er echt op gewacht wordt, en met alleen een `.catch()` eraan gebeurde er niets. Dat is
       * stil misgegaan tot het gemeten werd, dus staat het hier expliciet.
       */
      void (async () => {
        try {
          await database.insert(modelUsage).values({
            workspaceId: usage.workspaceId,
            botId: usage.botId,
            provider: usage.provider,
            modelName: usage.modelName,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            cachedInputTokens: usage.cachedInputTokens,
            reasoningTokens: usage.reasoningTokens,
          });
        } catch (error) {
          // Zie de toelichting bij `record`: dit mag geen gesprek breken. Wel gemeld, want een
          // kostenoverzicht dat stil leegblijft is erger dan een regel in het logboek.
          console.warn(
            `model usage not recorded: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      })();
    },

    async summary({ workspaceId, since }) {
      /*
       * `workspaceId: undefined` betekent "alles", `null` betekent "de persoonlijke ruimtes".
       * Dat verschil is er echt: een beheerder wil het totaal zien, en een persoonlijke ruimte
       * hoort bij geen enkele klant.
       */
      const scope =
        workspaceId === undefined
          ? undefined
          : workspaceId === null
            ? isNull(modelUsage.workspaceId)
            : eq(modelUsage.workspaceId, workspaceId);

      const rows = await database
        .select({
          provider: modelUsage.provider,
          modelName: modelUsage.modelName,
          calls: sql<number>`count(*)::int`,
          inputTokens: sql<number>`coalesce(sum(${modelUsage.inputTokens}), 0)::bigint`,
          outputTokens: sql<number>`coalesce(sum(${modelUsage.outputTokens}), 0)::bigint`,
          cachedInputTokens: sql<number>`coalesce(sum(${modelUsage.cachedInputTokens}), 0)::bigint`,
          reasoningTokens: sql<number>`coalesce(sum(${modelUsage.reasoningTokens}), 0)::bigint`,
          lastUsedAt: sql<string | null>`max(${modelUsage.at})`,
        })
        .from(modelUsage)
        .where(scope ? and(gte(modelUsage.at, since), scope) : gte(modelUsage.at, since))
        .groupBy(modelUsage.provider, modelUsage.modelName)
        .orderBy(desc(sql`sum(${modelUsage.inputTokens} + ${modelUsage.outputTokens})`));

      return rows.map((row) => ({
        provider: row.provider,
        modelName: row.modelName,
        // Postgres geeft een bigint terug als tekst; hier moet een getal uit komen.
        calls: Number(row.calls),
        inputTokens: Number(row.inputTokens),
        outputTokens: Number(row.outputTokens),
        cachedInputTokens: Number(row.cachedInputTokens),
        reasoningTokens: Number(row.reasoningTokens),
        lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt).toISOString() : null,
      }));
    },
  };
}
