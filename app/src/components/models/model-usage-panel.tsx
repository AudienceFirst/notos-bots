// NOTOS: wat de modellen verstookt hebben, per model (Mitch, 7 september 2026).
//
// Tokens en geen euro's. Wat een model kost hangt af van het tarief op het moment van de aanroep,
// en dat tarief staat hier niet en verandert buiten ons om. Een bedrag dat wij erbij verzinnen
// leest als een feit terwijl het een schatting is; tokens zijn wél gemeten. Wie een rekening wil,
// vermenigvuldigt deze getallen met het tarief van dat moment.
import { useQuery } from "@tanstack/react-query";
import { formatDateTime, useLocale, useT } from "@/i18n";
import {
  modelUsageQueryOptions,
  PROVIDER_LABELS,
} from "@/lib/model-keys/queries";

/**
 * Getallen voluit, geen "k" of "M", en met de scheiding van de gekozen taal: 16.564 betekent in
 * het Nederlands zestienduizend en in het Engels zestien-komma-vijf, dus een vaste taal zou de
 * helft van de lezers een verkeerd getal geven.
 */
const useCount = () => {
  const locale = useLocale();
  return (value: number) =>
    value.toLocaleString(locale === "nl" ? "nl-NL" : "en-GB");
};

export function ModelUsagePanel({ days = 30 }: { days?: number }) {
  const t = useT();
  const count = useCount();
  const usage = useQuery(modelUsageQueryOptions(days));

  if (usage.isPending) return null;
  if (usage.error) {
    return (
      <p className="text-destructive text-sm" role="alert">
        {t("admin-a.modelUsage.loadFailed")}
      </p>
    );
  }

  const lines = usage.data?.lines ?? [];
  if (lines.length === 0) {
    return (
      <p className="text-muted-foreground text-sm text-pretty">
        {t("admin-a.modelUsage.empty", { days })}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border border-b text-left text-muted-foreground text-xs uppercase tracking-wider">
            <th className="py-2 pr-4 font-normal">
              {t("admin-a.modelUsage.model")}
            </th>
            <th className="py-2 pr-4 text-right font-normal">
              {t("admin-a.modelUsage.calls")}
            </th>
            <th className="py-2 pr-4 text-right font-normal">
              {t("admin-a.modelUsage.input")}
            </th>
            <th className="py-2 pr-4 text-right font-normal">
              {t("admin-a.modelUsage.output")}
            </th>
            <th className="py-2 pr-4 text-right font-normal">
              {t("admin-a.modelUsage.cached")}
            </th>
            <th className="py-2 text-right font-normal">
              {t("admin-a.modelUsage.lastUsed")}
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr
              className="border-border/60 border-b last:border-0"
              key={`${line.provider}/${line.modelName}`}
            >
              <td className="py-2 pr-4">
                <span className="font-medium">{line.modelName}</span>{" "}
                <span className="text-muted-foreground text-xs">
                  {PROVIDER_LABELS[
                    line.provider as keyof typeof PROVIDER_LABELS
                  ] ?? line.provider}
                </span>
              </td>
              {/* tabular-nums: anders dansen de cijfers per rij uit de rooilijn. */}
              <td className="py-2 pr-4 text-right tabular-nums">
                {count(line.calls)}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {count(line.inputTokens)}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {count(line.outputTokens)}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                {count(line.cachedInputTokens)}
              </td>
              <td className="py-2 text-right text-muted-foreground">
                {line.lastUsedAt
                  ? formatDateTime(line.lastUsedAt, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
