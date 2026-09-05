// NOTOS: één paneel voor API-keys, gebruikt door Admin › Models (deployment) en Settings › Models
// (persoonlijk) (Mitch, 5 september 2026).
import { IconExternalLink } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Anthropic, GoogleGemini, Openai, Openrouter } from "@thesvg/react";
import type * as React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type KeyedProvider,
  type KeyScope,
  modelKeysQueryOptions,
  PROVIDER_HELP,
  PROVIDER_LABELS,
  removeModelKeyMutationOptions,
  setModelKeyMutationOptions,
} from "@/lib/model-keys/queries";

const MARKS: Record<
  KeyedProvider,
  React.ComponentType<{ className?: string }>
> = {
  anthropic: Anthropic,
  openai: Openai,
  openrouter: Openrouter,
  "google-ai": GoogleGemini,
};

/**
 * Keys in, never out: the server lists a provider, a label and the last four characters, and the
 * field here is a password field that clears itself after saving. Subscriptions are not keys:
 * Claude Max and Gemini CLI sign a person in on their own machine and cannot be used from a
 * server, so the page says that once, above the list, instead of letting somebody try.
 */
export function ModelKeysPanel({ scope }: { scope: KeyScope }) {
  const keys = useQuery(modelKeysQueryOptions(scope));
  const rows = keys.data?.keys ?? [];
  const providers = keys.data?.providers ?? [];

  if (keys.isPending) return null;
  if (keys.error) {
    return (
      <p className="text-destructive text-sm" role="alert">
        The keys could not be loaded.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {providers.map((provider) => (
        <ProviderRow
          existing={rows.find((row) => row.provider === provider) ?? null}
          key={provider}
          provider={provider}
          scope={scope}
        />
      ))}
    </div>
  );
}

function ProviderRow({
  provider,
  scope,
  existing,
}: {
  provider: KeyedProvider;
  scope: KeyScope;
  existing: { label: string; hint: string; updatedAt: string } | null;
}) {
  const queryClient = useQueryClient();
  const save = useMutation(setModelKeyMutationOptions(queryClient, scope));
  const remove = useMutation(removeModelKeyMutationOptions(queryClient, scope));
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [label, setLabel] = useState(existing?.label ?? "");
  const Mark = MARKS[provider];
  const help = PROVIDER_HELP[provider];
  const set = existing !== null;

  return (
    <div className="rounded-xl border border-border/60 bg-background p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Mark className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm">{PROVIDER_LABELS[provider]}</p>
          <p className="truncate text-muted-foreground text-xs">
            {set
              ? `Key ${existing.hint}${existing.label ? ` · ${existing.label}` : ""} · set ${new Date(existing.updatedAt).toLocaleDateString("nl-NL")}`
              : "No key yet"}
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <span
            aria-hidden="true"
            className={`size-1.5 rounded-full ${set ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
          />
          {set ? "Ready" : "Off"}
        </span>
        <Button
          onClick={() => setOpen((value) => !value)}
          size="sm"
          variant={set ? "ghost" : "outline"}
        >
          {open ? "Close" : set ? "Replace" : "Add key"}
        </Button>
      </div>
      {open ? (
        <form
          className="mt-4 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!key.trim()) return;
            save.mutate(
              { provider, key: key.trim(), label: label.trim() },
              {
                onSuccess: () => {
                  setKey("");
                  setOpen(false);
                },
              },
            );
          }}
        >
          <p className="text-muted-foreground text-xs">
            Get one at{" "}
            <a
              className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-foreground"
              href={help.url}
              rel="noreferrer"
              target="_blank"
            >
              {help.where}
              <IconExternalLink className="size-3" />
            </a>
            . It starts with {help.prefix}
          </p>
          <div className="flex items-center gap-2">
            <Input
              aria-label={`${PROVIDER_LABELS[provider]} API key`}
              autoComplete="off"
              className="h-8 font-mono text-sm"
              onChange={(event) => setKey(event.target.value)}
              placeholder={help.prefix}
              type="password"
              value={key}
            />
            <Input
              aria-label="Label"
              className="h-8 w-40 text-sm"
              maxLength={80}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Label (optional)"
              value={label}
            />
            <Button
              disabled={save.isPending || !key.trim()}
              size="sm"
              type="submit"
            >
              Save
            </Button>
            {set ? (
              <Button
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(provider, { onSuccess: () => setOpen(false) })
                }
                size="sm"
                type="button"
                variant="ghost"
              >
                Remove
              </Button>
            ) : null}
          </div>
          {save.error || remove.error ? (
            <p className="text-destructive text-xs" role="alert">
              {(save.error ?? remove.error)?.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
