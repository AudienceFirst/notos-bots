// NOTOS: het model kiezen in een gesprek (Mitch, 5 september 2026).
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/i18n";
import {
  availableModelsQueryOptions,
  type ConversationModel,
  PROVIDER_LABELS,
} from "@/lib/model-keys/queries";
import { MODEL_CHOICES } from "@/lib/workspaces/queries";

/** The short name of a model, for a button: the catalogue's, or provider plus id. */
export function modelShortLabel(model: ConversationModel | null): string {
  if (!model) return "";
  const known = MODEL_CHOICES.find(
    (choice) =>
      choice.provider === model.provider &&
      choice.defaultModel === model.name &&
      (choice.provider !== "vertex" ||
        choice.vertexLocation === model.location),
  );
  if (known) return known.short;
  const provider =
    PROVIDER_LABELS[model.provider as keyof typeof PROVIDER_LABELS] ??
    model.provider;
  return `${provider} · ${model.name}`;
}

const same = (a: ConversationModel | null, b: ConversationModel | null) =>
  !!a &&
  !!b &&
  a.provider === b.provider &&
  a.name === b.name &&
  (a.provider !== "vertex" || a.location === b.location);

/**
 * One small button in the conversation header that says which model answers here, and a menu
 * to change it. The list holds only what can run: Vertex always, a keyed provider only when a
 * key is reachable for this workspace (or your own space). The first entry is the workspace's
 * model; choosing it clears the conversation's own choice.
 */
export function ModelPicker({
  value,
  onChange,
  disabled,
  pending,
}: {
  value: ConversationModel | null;
  onChange: (model: ConversationModel | null) => void;
  disabled?: boolean;
  pending?: boolean;
}) {
  const t = useT();
  const available = useQuery(availableModelsQueryOptions());
  const providers = available.data?.providers ?? { vertex: true };
  const workspaceDefault = available.data?.workspaceDefault ?? null;
  const choices = MODEL_CHOICES.filter(
    (choice) => providers[choice.provider] === true,
  );
  const current = value ?? workspaceDefault;
  const label = current
    ? modelShortLabel(current)
    : t("settings.modelPicker.model");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={t("settings.modelPicker.triggerLabel", { label })}
            className="h-8 gap-1 px-2 text-muted-foreground text-xs font-normal hover:text-foreground"
            disabled={disabled || pending || available.isPending}
            size="sm"
            variant="ghost"
          />
        }
      >
        <span className="max-w-[180px] truncate">{label}</span>
        <IconChevronDown className="size-3.5 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-1" sideOffset={6}>
        <p className="px-2 pt-1.5 pb-1 text-muted-foreground text-[11px] uppercase tracking-wide">
          {t("settings.modelPicker.heading")}
        </p>
        {workspaceDefault ? (
          <DropdownMenuItem
            className="flex items-start gap-2 text-sm"
            onClick={() => onChange(null)}
          >
            <span className="flex size-4 shrink-0 items-center justify-center pt-0.5">
              {value === null ? <IconCheck className="size-4" /> : null}
            </span>
            <span className="flex min-w-0 flex-col">
              <span>{t("settings.modelPicker.workspaceModel")}</span>
              <span className="text-muted-foreground text-xs">
                {modelShortLabel(workspaceDefault)}
              </span>
            </span>
          </DropdownMenuItem>
        ) : null}
        {choices.map((choice) => {
          const model: ConversationModel = {
            provider: choice.provider,
            location: choice.vertexLocation,
            name: choice.defaultModel,
          };
          const chosen = value !== null && same(value, model);
          return (
            <DropdownMenuItem
              className="flex items-start gap-2 text-sm"
              key={`${choice.provider}|${choice.vertexLocation}|${choice.defaultModel}`}
              onClick={() => onChange(model)}
            >
              <span className="flex size-4 shrink-0 items-center justify-center pt-0.5">
                {chosen ? <IconCheck className="size-4" /> : null}
              </span>
              <span className="flex min-w-0 flex-col">
                <span>{choice.short}</span>
                <span className="text-muted-foreground text-xs">
                  {PROVIDER_LABELS[choice.provider]}
                </span>
              </span>
            </DropdownMenuItem>
          );
        })}
        {choices.length <= 2 ? (
          <p className="px-2 pt-1 pb-1.5 text-muted-foreground text-xs">
            {t("settings.modelPicker.keyedHint")}
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
