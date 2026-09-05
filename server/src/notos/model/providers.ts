// NOTOS: één modelfabriek voor Vertex (ADC) én API-keys van Anthropic, OpenAI, OpenRouter en
// Google AI Studio (Mitch, 5 september 2026).
import { createHash } from "node:crypto";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { createVertexModels, type VertexDefaults } from "./vertex";

export const MODEL_PROVIDERS = [
  "vertex",
  "anthropic",
  "openai",
  "openrouter",
  "google-ai",
] as const;
export type ModelProvider = (typeof MODEL_PROVIDERS)[number];

export const isModelProvider = (value: unknown): value is ModelProvider =>
  typeof value === "string" &&
  (MODEL_PROVIDERS as readonly string[]).includes(value);

/** Providers that need a key. Vertex runs on the server's own Google credentials. */
export const KEYED_PROVIDERS = MODEL_PROVIDERS.filter(
  (provider) => provider !== "vertex",
) as readonly Exclude<ModelProvider, "vertex">[];

export const PROVIDER_LABELS: Record<ModelProvider, string> = {
  vertex: "Vertex AI (Google Cloud)",
  anthropic: "Anthropic",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  "google-ai": "Google AI Studio",
};

/** Whose key a run may use: the person's for a personal space, the workspace's, the deployment's. */
export type KeyScope = {
  workspaceId: string | null;
  personalOwnerId: string | null;
};

export type ModelChoice = {
  provider: ModelProvider;
  location: string;
  name: string;
} & KeyScope;

export type ModelFactory = (choice?: Partial<ModelChoice>) => LanguageModel;

/** Sync lookup from a warmed cache; null when nobody in scope has a key for this provider. */
export type KeyResolver = (
  provider: Exclude<ModelProvider, "vertex">,
  scope: KeyScope,
) => string | null;

export class ModelKeyMissingError extends Error {}

/**
 * Vertex stays what it was (stap 3): Gemini through the server's ADC, per location. Every other
 * provider is reached with an API key found in scope; the model object is cached per key so a
 * rotated key gives a fresh client and an old one is never reused by accident.
 */
export function createModels(
  defaults: VertexDefaults,
  resolveKey: KeyResolver,
): ModelFactory {
  const vertex = createVertexModels(defaults);
  const cache = new Map<string, LanguageModel>();
  return (choice = {}) => {
    const provider = choice.provider ?? "vertex";
    if (provider === "vertex") {
      return vertex({ location: choice.location, name: choice.name });
    }
    const name = choice.name?.trim();
    if (!name) {
      throw new ModelKeyMissingError(
        `No model is named for ${PROVIDER_LABELS[provider]}.`,
      );
    }
    const key = resolveKey(provider, {
      workspaceId: choice.workspaceId ?? null,
      personalOwnerId: choice.personalOwnerId ?? null,
    });
    if (!key) {
      throw new ModelKeyMissingError(
        `No API key for ${PROVIDER_LABELS[provider]}. An administrator adds one under Admin › Models; for your personal space you add your own under Settings › Models.`,
      );
    }
    const cacheKey = `${provider}/${name}/${fingerprint(key)}`;
    const hit = cache.get(cacheKey);
    if (hit) return hit;
    const model = build(provider, name, key);
    cache.set(cacheKey, model);
    return model;
  };
}

function build(
  provider: Exclude<ModelProvider, "vertex">,
  name: string,
  apiKey: string,
): LanguageModel {
  switch (provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(name);
    case "openai":
      return createOpenAI({ apiKey })(name);
    case "openrouter":
      return createOpenRouter({ apiKey })(name);
    case "google-ai":
      return createGoogleGenerativeAI({ apiKey })(name);
  }
}

/** A short hash for the cache key: the key itself never sits in a Map key or a log. */
function fingerprint(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 12);
}
