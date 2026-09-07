// NOTOS: meten wat een modelaanroep verstookt, zonder de aanroep zelf te veranderen
// (Mitch, 7 september 2026).
//
// Dit hangt als een laagje om het taalmodel heen in plaats van dat elke plek die een model
// aanroept zelf gaat tellen. Eén plek die telt, en aanroepers die er niets van merken: een nieuwe
// route of een nieuwe tool wordt vanzelf meegeteld, en niemand kan vergeten het aan te zetten.
//
// De belofte die deze laag moet houden: hij mag een run nooit laten omvallen. Meten is boekhouding,
// en boekhouding die een gesprek breekt is erger dan geen boekhouding. Alles wat hier misgaat gaat
// dus stil, en het antwoord van het model gaat ongewijzigd door.
//
// WAAROM TWEE WEGEN. De AI SDK kent twee afspraken naast elkaar. `wrapLanguageModel` uit `ai` werkt
// alleen op de nieuwe (v3), maar onze eigen standaard, Gemini op Vertex, is nog v2. Alleen v3
// afhandelen betekende in de praktijk: niets meten, en dat is precies wat er gebeurde tot dit
// gemeten werd. Vandaar dat v2 hier met de hand wordt omwikkeld. Verdwijnt v2 uit de SDK, dan kan
// die helft weg.
import { wrapLanguageModel } from "ai";
import type { LanguageModel } from "ai";

export type UsageRecord = {
  workspaceId: string | null;
  botId: string;
  provider: string;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
};

/** Waar een gemeten aanroep heen gaat. Mag traag zijn; hij wordt niet afgewacht. */
export type UsageSink = (record: UsageRecord) => void;

/** Wat we van de aanroep al weten voordat hij gedaan is. */
export type UsageContext = {
  workspaceId: string | null;
  botId: string;
  provider: string;
  modelName: string;
};

/**
 * De twee vormen waarin een telling terugkomt.
 *
 * v2 geeft platte getallen. v3 splitst invoer in vers en uit-de-cache, en uitvoer in tekst en
 * redeneren. Beide worden hieronder tot dezelfde vier getallen teruggebracht.
 */
type UsageV2 = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  cachedInputTokens?: number | null;
  reasoningTokens?: number | null;
};
type UsageV3 = {
  inputTokens?: { total?: number; noCache?: number; cacheRead?: number };
  outputTokens?: { total?: number; reasoning?: number };
};

type Counts = Pick<
  UsageRecord,
  "inputTokens" | "outputTokens" | "cachedInputTokens" | "reasoningTokens"
>;

const whole = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : 0;

/** De vier getallen die wij bewaren, uit welke van de twee vormen dan ook. */
export function readUsage(usage: unknown): Counts {
  const input = (usage as UsageV3 | undefined)?.inputTokens;
  if (input !== null && typeof input === "object") {
    const v3 = usage as UsageV3;
    const cacheRead = whole(v3.inputTokens?.cacheRead);
    /*
     * `total` telt de cache-treffers mee. Wij zetten ze apart, zodat "wat is er vers gelezen" en
     * "wat kwam er goedkoop uit de cache" los te lezen zijn; anders lijkt een goedkope maand duur.
     * Valt `total` weg, dan is `noCache` het beste dat we hebben.
     */
    const total = whole(v3.inputTokens?.total);
    return {
      inputTokens:
        total > 0
          ? Math.max(total - cacheRead, 0)
          : whole(v3.inputTokens?.noCache),
      outputTokens: whole(v3.outputTokens?.total),
      cachedInputTokens: cacheRead,
      reasoningTokens: whole(v3.outputTokens?.reasoning),
    };
  }
  const v2 = usage as UsageV2 | undefined;
  const cached = whole(v2?.cachedInputTokens);
  return {
    // v2's `inputTokens` telt de cache ook mee; dezelfde correctie als hierboven.
    inputTokens: Math.max(whole(v2?.inputTokens) - cached, 0),
    outputTokens: whole(v2?.outputTokens),
    cachedInputTokens: cached,
    reasoningTokens: whole(v2?.reasoningTokens),
  };
}

/** Een aanroep zonder enige telling schrijven we niet weg: een rij met nullen zegt niets. */
function isEmpty(counts: Counts): boolean {
  return (
    counts.inputTokens === 0 &&
    counts.outputTokens === 0 &&
    counts.cachedInputTokens === 0 &&
    counts.reasoningTokens === 0
  );
}

/**
 * Hetzelfde model, met een teller eromheen.
 *
 * Zowel de gewone aanroep als de streamende: bij streamen komt de telling pas in het laatste stukje
 * van de stroom voorbij, dus die wordt onderweg meegelezen. Meelezen, niet vasthouden: elk stukje
 * gaat meteen door naar de lezer, anders zou het antwoord pas verschijnen als het model klaar is.
 */
export function meterModel(
  model: LanguageModel,
  context: UsageContext,
  sink: UsageSink,
): LanguageModel {
  const report = (usage: unknown) => {
    try {
      const counts = readUsage(usage);
      if (!isEmpty(counts)) sink({ ...context, ...counts });
    } catch {
      // Boekhouding breekt geen gesprek.
    }
  };

  /*
   * Een `LanguageModel` mag ook gewoon een modelnaam zijn, die de SDK zelf nog opzoekt. Daar valt
   * niets omheen te wikkelen, dus die gaat ongemeten door in plaats van dat de run hier omvalt.
   */
  if (typeof model === "string") return model;

  /** Elk stukje meteen doorgeven, en onderweg de telling uit het `finish`-stukje plukken. */
  const watchStream = <T extends { stream: ReadableStream<unknown> }>(
    result: T,
  ): T => {
    let seen: unknown;
    return {
      ...result,
      stream: result.stream.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            const part = chunk as { type?: string; usage?: unknown };
            if (part?.type === "finish" && part.usage) seen = part.usage;
            controller.enqueue(chunk);
          },
          flush() {
            report(seen);
          },
        }),
      ),
    };
  };

  if (model.specificationVersion === "v3") {
    return wrapLanguageModel({
      model,
      middleware: {
        specificationVersion: "v3",
        async wrapGenerate({ doGenerate }) {
          const result = await doGenerate();
          report(result.usage);
          return result;
        },
        async wrapStream({ doStream }) {
          return watchStream(await doStream());
        },
      },
    });
  }

  /*
   * v2 met de hand. Een Proxy en geen kopie: het model heeft eigenschappen die de SDK uitleest
   * (provider, modelId, supportedUrls) en die moeten kloppen, ook als er later eentje bijkomt.
   */
  return new Proxy(model, {
    get(target, property, receiver) {
      if (property === "doGenerate") {
        return async (...args: unknown[]) => {
          const call = Reflect.get(target, property, receiver) as unknown as (
            ...a: unknown[]
          ) => PromiseLike<{ usage?: unknown }>;
          const result = await call.apply(target, args);
          report(result.usage);
          return result;
        };
      }
      if (property === "doStream") {
        return async (...args: unknown[]) => {
          const call = Reflect.get(target, property, receiver) as unknown as (
            ...a: unknown[]
          ) => PromiseLike<{ stream: ReadableStream<unknown> }>;
          return watchStream(await call.apply(target, args));
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
