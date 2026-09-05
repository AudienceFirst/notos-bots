// NOTOS: Settings › Models: het model van je persoonlijke ruimte en je eigen keys
// (Mitch, 5 september 2026).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageSection, PageShell } from "@/components/layout/page-shell";
import { ModelKeysPanel } from "@/components/models/model-keys-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type ModelProvider,
  personalModelQueryOptions,
  PROVIDER_LABELS,
  setPersonalModelMutationOptions,
} from "@/lib/model-keys/queries";
import { MODEL_CHOICES } from "@/lib/workspaces/queries";

export const Route = createFileRoute("/_authed/settings/models")({
  component: ModelsSettingsPage,
});

function ModelsSettingsPage() {
  return (
    <PageShell
      description="Your personal space runs on the model you choose here, with your own keys. Nobody else sees your space, and your keys serve your space only."
      title="Models"
    >
      <PageSection>
        <h2 className="mb-2 font-medium text-sm">
          Your personal space runs on
        </h2>
        <PersonalModelForm />
      </PageSection>
      <PageSection>
        <h2 className="mb-2 font-medium text-sm">Your keys</h2>
        <p className="mb-4 text-muted-foreground text-sm text-pretty">
          A subscription is not a key: Claude Max and Gemini CLI sign you in on
          your own laptop and cannot be used from a server. Bots run on API
          access, billed per use by the provider. Without a key of your own,
          your space uses the deployment's keys where an administrator set them.
        </p>
        <ModelKeysPanel scope="personal" />
      </PageSection>
    </PageShell>
  );
}

const PROVIDERS: ModelProvider[] = [
  "vertex",
  "anthropic",
  "openai",
  "openrouter",
  "google-ai",
];

function PersonalModelForm() {
  const queryClient = useQueryClient();
  const current = useQuery(personalModelQueryOptions());
  const save = useMutation(setPersonalModelMutationOptions(queryClient));
  const [custom, setCustom] = useState(false);
  const [provider, setProvider] = useState<ModelProvider>("vertex");
  const [model, setModel] = useState("");

  if (current.isPending) return null;
  if (current.error) {
    return (
      <p className="text-destructive text-sm" role="alert">
        Your model choice could not be loaded.
      </p>
    );
  }
  const value = current.data;
  const chosen = MODEL_CHOICES.find(
    (choice) =>
      choice.provider === value.provider &&
      choice.defaultModel === value.defaultModel &&
      (choice.provider !== "vertex" ||
        choice.vertexLocation === value.vertexLocation),
  );

  return (
    <div className="flex flex-col gap-2">
      <select
        aria-label="Model for your personal space"
        className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        disabled={save.isPending}
        onChange={(event) => {
          if (event.target.value === "custom") {
            setCustom(true);
            setProvider(value.provider);
            setModel(value.defaultModel);
            return;
          }
          const choice = MODEL_CHOICES.find(
            (row) =>
              `${row.provider}|${row.defaultModel}` === event.target.value,
          );
          if (!choice) return;
          setCustom(false);
          save.mutate({
            provider: choice.provider,
            vertexLocation: choice.vertexLocation,
            defaultModel: choice.defaultModel,
          });
        }}
        value={
          custom
            ? "custom"
            : chosen
              ? `${chosen.provider}|${chosen.defaultModel}`
              : "custom"
        }
      >
        {MODEL_CHOICES.map((choice) => (
          <option
            key={`${choice.provider}|${choice.defaultModel}`}
            value={`${choice.provider}|${choice.defaultModel}`}
          >
            {choice.label}
          </option>
        ))}
        <option value="custom">
          {chosen
            ? "Another model (type its id)…"
            : `Custom: ${PROVIDER_LABELS[value.provider]} · ${value.defaultModel}`}
        </option>
      </select>
      {custom || !chosen ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!model.trim()) return;
            save.mutate(
              {
                provider,
                vertexLocation: value.vertexLocation,
                defaultModel: model.trim(),
              },
              { onSuccess: () => setCustom(false) },
            );
          }}
        >
          <select
            aria-label="Provider"
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            onChange={(event) =>
              setProvider(event.target.value as ModelProvider)
            }
            value={provider}
          >
            {PROVIDERS.map((row) => (
              <option key={row} value={row}>
                {PROVIDER_LABELS[row]}
              </option>
            ))}
          </select>
          <Input
            aria-label="Model id"
            className="h-8 font-mono text-sm"
            onChange={(event) => setModel(event.target.value)}
            placeholder="e.g. anthropic/claude-sonnet-5 on OpenRouter"
            value={model}
          />
          <Button
            disabled={save.isPending || !model.trim()}
            size="sm"
            type="submit"
          >
            Save
          </Button>
        </form>
      ) : null}
      {save.error ? (
        <p className="text-destructive text-xs" role="alert">
          {save.error.message}
        </p>
      ) : null}
    </div>
  );
}
