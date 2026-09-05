// NOTOS: API-keys voor modelproviders, per deployment (beheerder) of persoon (Mitch, 5 september 2026).
import {
  mutationOptions,
  type QueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { client } from "@/lib/client";

export type KeyedProvider = "anthropic" | "openai" | "openrouter" | "google-ai";
export type ModelProvider = "vertex" | KeyedProvider;
export type KeyScope = "deployment" | "personal";

export type ModelKeySummary = {
  scope: KeyScope;
  scopeId: string;
  provider: KeyedProvider;
  label: string;
  /** The last four characters. Never more. */
  hint: string;
  updatedAt: string;
};

export const PROVIDER_LABELS: Record<ModelProvider, string> = {
  vertex: "Vertex AI (Google Cloud)",
  anthropic: "Anthropic",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  "google-ai": "Google AI Studio",
};

/** Where a person gets a key. The page links there so nobody has to search for it. */
export const PROVIDER_HELP: Record<
  KeyedProvider,
  { where: string; url: string; prefix: string }
> = {
  anthropic: {
    where: "console.anthropic.com → API keys",
    url: "https://console.anthropic.com/settings/keys",
    prefix: "sk-ant-…",
  },
  openai: {
    where: "platform.openai.com → API keys",
    url: "https://platform.openai.com/api-keys",
    prefix: "sk-…",
  },
  openrouter: {
    where: "openrouter.ai → Keys",
    url: "https://openrouter.ai/keys",
    prefix: "sk-or-…",
  },
  "google-ai": {
    where: "aistudio.google.com → Get API key",
    url: "https://aistudio.google.com/apikey",
    prefix: "AIza…",
  },
};

const base = (scope: KeyScope) =>
  scope === "deployment" ? "/api/admin/model-keys" : "/api/me/model-keys";

export const modelKeyKeys = {
  list: (scope: KeyScope) => ["model-keys", scope] as const,
  personalModel: ["personal-model"] as const,
};

export function modelKeysQueryOptions(scope: KeyScope) {
  return queryOptions({
    queryKey: modelKeyKeys.list(scope),
    queryFn: async () =>
      (await (
        await client(base(scope), {
          fallback: "The keys could not be loaded.",
        })
      ).json()) as { providers: KeyedProvider[]; keys: ModelKeySummary[] },
  });
}

export function setModelKeyMutationOptions(
  queryClient: QueryClient,
  scope: KeyScope,
) {
  return mutationOptions({
    mutationFn: async (input: {
      provider: KeyedProvider;
      key: string;
      label?: string;
    }) => {
      const response = await client(`${base(scope)}/${input.provider}`, {
        method: "PUT",
        body: { key: input.key, label: input.label ?? "" },
        fallback: "The key could not be saved.",
      });
      return ((await response.json()) as { key: ModelKeySummary }).key;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: modelKeyKeys.list(scope) }),
  });
}

export function removeModelKeyMutationOptions(
  queryClient: QueryClient,
  scope: KeyScope,
) {
  return mutationOptions({
    mutationFn: async (provider: KeyedProvider) => {
      await client(`${base(scope)}/${provider}`, {
        method: "DELETE",
        fallback: "The key could not be removed.",
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: modelKeyKeys.list(scope) }),
  });
}

/** NOTOS: a model chosen for one conversation (channel or thread). */
export type ConversationModel = {
  provider: string;
  location: string;
  name: string;
};

export type AvailableModels = {
  /** Which providers can run here: Vertex always, keyed ones only with a reachable key. */
  providers: Record<string, boolean>;
  workspaceDefault: ConversationModel | null;
};

export function availableModelsQueryOptions() {
  return queryOptions({
    queryKey: ["models", "available"] as const,
    queryFn: async () =>
      (await (
        await client("/api/models/available", {
          fallback: "The models could not be loaded.",
        })
      ).json()) as AvailableModels,
    staleTime: 60_000,
  });
}

export function threadModelQueryOptions(threadId: string) {
  return queryOptions({
    queryKey: ["threads", threadId, "model"] as const,
    queryFn: async () =>
      (await (
        await client(`/api/threads/${encodeURIComponent(threadId)}`, {
          fallback: "The thread could not be read.",
        })
      ).json()) as { known: boolean; model: ConversationModel | null },
  });
}

export function setThreadModelMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (input: {
      threadId: string;
      model: ConversationModel | null;
    }) => {
      await client(`/api/threads/${encodeURIComponent(input.threadId)}/model`, {
        method: "PUT",
        body: { model: input.model },
        fallback: "Could not change the model for this chat",
      });
    },
    onSuccess: (_result, input) =>
      queryClient.invalidateQueries({
        queryKey: ["threads", input.threadId, "model"],
      }),
  });
}

export type PersonalModel = {
  provider: ModelProvider;
  vertexLocation: string;
  defaultModel: string;
};

export function personalModelQueryOptions() {
  return queryOptions({
    queryKey: modelKeyKeys.personalModel,
    queryFn: async () =>
      (await (
        await client("/api/me/personal-model", {
          fallback: "Your model choice could not be loaded.",
        })
      ).json()) as PersonalModel,
  });
}

export function setPersonalModelMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (input: PersonalModel) => {
      await client("/api/me/personal-model", {
        method: "PUT",
        body: input,
        fallback: "Your model choice could not be saved.",
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: modelKeyKeys.personalModel }),
  });
}
