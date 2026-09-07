import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { RoutinesList } from "@/components/routines/routines-list";
import { Button } from "@/components/ui/button";
import { formatDateTime, useT } from "@/i18n";
import { agentListQueryOptions } from "@/lib/agents/queries";
import { campaignListQueryOptions } from "@/lib/campaigns/queries";
import { channelListQueryOptions } from "@/lib/channels/queries";
import { createRoutineMutationOptions } from "@/lib/routines/mutations";

/**
 * A person's own standing instructions: what runs on a schedule, and a switch to stop one.
 *
 * `_authed/_app`, not Admin: a routine is something anybody has, the same way a skill is — it is
 * scoped to the signed-in person on every read and write, not to the deployment.
 *
 * THERE IS DELIBERATELY NO CREATE AND NO EDIT FORM ON THIS PAGE. Turning a sentence into a cron
 * expression and a channel is conversational work — ask a Bot in a channel, "every weekday at 9,
 * post the standup notes here" — and that is exactly what a conversation is for. This screen answers
 * a narrower question: what is standing right now, and does it stay standing. It shows and it stops;
 * it does not compose. Absent on purpose, not an omission.
 */
export const Route = createFileRoute("/_authed/w/$workspace/_app/routines")({
  component: RoutinesPage,
});

function RoutinesPage() {
  const t = useT();
  return (
    <PageShell
      description={t("workspace.routines.description")}
      title={t("workspace.routines.title")}
    >
      {/* NOTOS (stap 9): a routine from the page, with a schedule you pick rather than write. */}
      <NewRoutineForm />
      <RoutinesList />
    </PageShell>
  );
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
/** Cron weekday numbers with the dictionary key of the day's name; translated where rendered. */
const DAYS = [
  ["1", "workspace.routines.monday"],
  ["2", "workspace.routines.tuesday"],
  ["3", "workspace.routines.wednesday"],
  ["4", "workspace.routines.thursday"],
  ["5", "workspace.routines.friday"],
  ["6", "workspace.routines.saturday"],
  ["0", "workspace.routines.sunday"],
] as const;

type Preset =
  | "quarter"
  | "hourly"
  | "daily"
  | "weekly"
  | "advanced"
  | "mention"
  | "keyword";

/** De twee aanleidingen die niet op de klok lopen. */
const EVENT_PRESETS: Preset[] = ["mention", "keyword"];
const isEvent = (preset: Preset) => EVENT_PRESETS.includes(preset);

/**
 * The cron for a preset. Every fifteen minutes is the shortest the server accepts.
 *
 * Een routine op een aanleiding krijgt er ook een. De kolom staat op NOT NULL en de sweep kijkt
 * alleen naar routines op de klok, dus die waarde wordt nergens gelezen; hem weglaten zou een
 * schemawijziging vragen zonder dat iemand er iets aan heeft.
 */
function cronFor(preset: Preset, hour: number, day: string, advanced: string) {
  if (isEvent(preset)) return "0 9 * * *";
  switch (preset) {
    case "quarter":
      return "*/15 * * * *";
    case "hourly":
      return "0 * * * *";
    case "daily":
      return `0 ${hour} * * *`;
    case "weekly":
      return `0 ${hour} * * ${day}`;
    default:
      return advanced.trim();
  }
}

function NewRoutineForm() {
  const t = useT();
  const queryClient = useQueryClient();
  const agents = useQuery(agentListQueryOptions());
  const channels = useInfiniteQuery(channelListQueryOptions());
  // For the option labels: channel names repeat across campaigns ("SEA Specialist" three times),
  // and the campaign is what tells them apart, the same way the sidebar groups them.
  const campaigns = useQuery(campaignListQueryOptions());
  const create = useMutation(createRoutineMutationOptions(queryClient));
  const [open, setOpen] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [instruction, setInstruction] = useState("");
  const [preset, setPreset] = useState<Preset>("daily");
  const [hour, setHour] = useState(9);
  const [day, setDay] = useState<string>("1");
  const [advanced, setAdvanced] = useState("0 9 * * 1-5");
  const [keyword, setKeyword] = useState("");
  const [timezone, setTimezone] = useState("Europe/Amsterdam");

  const bots = agents.data ?? [];
  // The query flattens its pages itself (see lib/channels/queries).
  const channelRows = channels.data ?? [];
  const forBot = channelRows.filter(
    (channel) => !agentId || channel.agentIds.includes(agentId),
  );
  const campaignNames = new Map(
    (campaigns.data ?? []).map((campaign) => [campaign.id, campaign.name]),
  );
  /** "Name · Campaign", or "Name · Workspace" for a channel outside any (active) campaign. */
  const placed = (channel: { name: string; campaignId?: string | null }) =>
    `${channel.name} · ${
      (channel.campaignId && campaignNames.get(channel.campaignId)) ||
      t("workspace.routines.workspaceFallback")
    }`;
  /*
   * Three "SEA Specialist · Workspace" are still three identical options, so a label that is
   * not unique after the campaign gets the channel's creation date and time as well. Only those:
   * a date on every option is noise on the ones the campaign already tells apart.
   */
  const labelCounts = new Map<string, number>();
  for (const channel of forBot) {
    const label = placed(channel);
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }
  const channelLabel = (channel: {
    name: string;
    campaignId?: string | null;
    createdAt: string;
  }) => {
    const label = placed(channel);
    if ((labelCounts.get(label) ?? 0) < 2) return label;
    const started = formatDateTime(channel.createdAt, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    return t("workspace.routines.startedAt", { label, started });
  };

  if (!open) {
    return (
      <div className="mb-6">
        <Button onClick={() => setOpen(true)} size="sm" variant="outline">
          {t("workspace.routines.new")}
        </Button>
      </div>
    );
  }

  const field = "w-full rounded-md border bg-transparent px-2 py-1.5 text-sm";

  return (
    <form
      className="mb-8 flex max-w-xl flex-col gap-3 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate(
          {
            agentId,
            ...(channelId ? { channelId } : {}),
            instruction,
            cron: cronFor(preset, hour, day, advanced),
            timezone,
            trigger: isEvent(preset) ? preset : "schedule",
            ...(preset === "keyword" ? { keyword: keyword.trim() } : {}),
          },
          {
            onSuccess: () => {
              setOpen(false);
              setInstruction("");
            },
          },
        );
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">
          {t("workspace.routines.botLabel")}
        </span>
        <select
          className={field}
          onChange={(event) => setAgentId(event.target.value)}
          required
          value={agentId}
        >
          <option value="">{t("workspace.routines.chooseBot")}</option>
          {bots.map((bot) => (
            <option key={bot.id} value={bot.id}>
              {bot.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">
          {t("workspace.routines.channelLabel")}
        </span>
        <select
          className={field}
          onChange={(event) => setChannelId(event.target.value)}
          value={channelId}
        >
          <option value="">{t("workspace.routines.ownChannel")}</option>
          {forBot.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channelLabel(channel)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">
          {t("workspace.routines.instructionLabel")}
        </span>
        <textarea
          className={field}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder={t("workspace.routines.instructionPlaceholder")}
          required
          rows={3}
          value={instruction}
        />
      </label>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">
            {t("workspace.routines.whenLabel")}
          </span>
          <select
            className={field}
            onChange={(event) => setPreset(event.target.value as Preset)}
            value={preset}
          >
            <option value="quarter">
              {t("workspace.routines.presetQuarter")}
            </option>
            <option value="hourly">
              {t("workspace.routines.presetHourly")}
            </option>
            <option value="daily">{t("workspace.routines.presetDaily")}</option>
            <option value="weekly">
              {t("workspace.routines.presetWeekly")}
            </option>
            <option value="advanced">
              {t("workspace.routines.presetAdvanced")}
            </option>
            {/* Niet op de klok maar op een aanleiding; hetzelfde menu, want het antwoordt op
                dezelfde vraag: wanneer draait dit? */}
            <option value="mention">
              {t("workspace.routines.presetMention")}
            </option>
            <option value="keyword">
              {t("workspace.routines.presetKeyword")}
            </option>
          </select>
        </label>
        {preset === "keyword" ? (
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">
              {t("workspace.routines.keywordLabel")}
            </span>
            <input
              className={field}
              minLength={2}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={t("workspace.routines.keywordPlaceholder")}
              required
              value={keyword}
            />
          </label>
        ) : null}
        {preset === "weekly" ? (
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">
              {t("workspace.routines.dayLabel")}
            </span>
            <select
              className={field}
              onChange={(event) => setDay(event.target.value)}
              value={day}
            >
              {DAYS.map(([value, key]) => (
                <option key={value} value={value}>
                  {t(key)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {preset === "daily" || preset === "weekly" ? (
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">
              {t("workspace.routines.hourLabel")}
            </span>
            <select
              className={field}
              onChange={(event) => setHour(Number(event.target.value))}
              value={hour}
            >
              {HOURS.map((value) => (
                <option key={value} value={value}>
                  {String(value).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {preset === "advanced" ? (
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">
              {t("workspace.routines.cronLabel")}
            </span>
            <input
              className={`${field} font-mono`}
              onChange={(event) => setAdvanced(event.target.value)}
              value={advanced}
            />
          </label>
        ) : null}
        {/* Een tijdzone zegt niets over een routine die op een aanleiding start. */}
        {isEvent(preset) ? null : (
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">
              {t("workspace.routines.timezoneLabel")}
            </span>
            <input
              className={field}
              onChange={(event) => setTimezone(event.target.value)}
              value={timezone}
            />
          </label>
        )}
      </div>
      {isEvent(preset) ? (
        <p className="text-muted-foreground text-xs text-pretty">
          {t("workspace.routines.eventNote")}
        </p>
      ) : null}
      {create.isError ? (
        <p className="text-destructive text-sm" role="alert">
          {create.error instanceof Error
            ? create.error.message
            : t("workspace.routines.createFailed")}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button disabled={create.isPending || !agentId} size="sm" type="submit">
          {t("workspace.routines.create")}
        </Button>
        <Button
          onClick={() => setOpen(false)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {t("workspace.routines.cancel")}
        </Button>
      </div>
    </form>
  );
}
