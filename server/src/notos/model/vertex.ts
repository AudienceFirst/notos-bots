/**
 * Gemini op Vertex AI, met ADC en zonder API-sleutel (bouwplan stap 3).
 *
 * `createVertex` uit `@ai-sdk/google-vertex` authenticeert via `google-auth-library`: op Cloud Run
 * de serviceaccount van de service, op een laptop `gcloud auth application-default login`. De
 * locatie hoort bij de workspace: `europe-west4` blijft in de EU en kent alleen Gemini 2.5,
 * `global` is nodig voor 3.x en verlaat de EU (zie `mge-platform/src/agents/config.py`).
 *
 * Eén fabriek per proces, één modelinstantie per (locatie, model), zodat een run geen client bouwt.
 */
import { createVertex } from "@ai-sdk/google-vertex";
import type { LanguageModel } from "ai";
import { generateText } from "ai";

export type ModelChoice = { location: string; name: string };

/** Een model voor een keuze, of voor de standaard van de deployment als er geen keuze is. */
export type ModelFactory = (choice?: Partial<ModelChoice>) => LanguageModel;

export type VertexDefaults = {
  project: string;
  location: string;
  name: string;
};

export function createVertexModels(defaults: VertexDefaults): ModelFactory {
  const providers = new Map<string, ReturnType<typeof createVertex>>();
  const models = new Map<string, LanguageModel>();
  return (choice = {}) => {
    const location = choice.location?.trim() || defaults.location;
    const name = choice.name?.trim() || defaults.name;
    const key = `${location}/${name}`;
    const cached = models.get(key);
    if (cached) return cached;
    let provider = providers.get(location);
    if (!provider) {
      provider = createVertex({ project: defaults.project, location });
      providers.set(location, provider);
    }
    const model = provider(name);
    models.set(key, model);
    return model;
  };
}

/**
 * Eén tekstantwoord op één prompt, voor de intent-router en de skill-keuze.
 *
 * Geen JSON-modus van de provider: de prompt vraagt om JSON en de lezer knipt het eerste
 * JSON-object uit het antwoord (`routing/classify.ts`), wat ook omheiningen als ```json overleeft.
 */
export function createTextCompleter(
  modelFor: ModelFactory,
  options: { timeoutMs?: number } = {},
): (prompt: string, choice?: Partial<ModelChoice>) => Promise<string> {
  const timeoutMs = options.timeoutMs ?? 20_000;
  return async (prompt, choice) => {
    const { text } = await generateText({
      model: modelFor(choice),
      prompt,
      abortSignal: AbortSignal.timeout(timeoutMs),
    });
    if (typeof text !== "string" || text.length === 0) {
      throw new Error("model returned no text");
    }
    return text;
  };
}
