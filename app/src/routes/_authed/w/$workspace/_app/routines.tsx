import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { agentListQueryOptions } from "@/lib/agents/queries";
import { channelListQueryOptions } from "@/lib/channels/queries";
import { createRoutineMutationOptions } from "@/lib/routines/mutations";
import { createFileRoute } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/page-shell";
import { RoutinesList } from "@/components/routines/routines-list";

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
  return (
    <PageShell
      description="What a Bot does on a schedule, without being asked each time. Make one here or by talking to a Bot; stop one below."
      title="Routines"
    >
      {/* NOTOS (stap 9): a routine from the page, with a schedule you pick rather than write. */}
      <NewRoutineForm />
      <RoutinesList />
    </PageShell>
  );
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const DAYS = [
  ["1", "Monday"],
  ["2", "Tuesday"],
  ["3", "Wednesday"],
  ["4", "Thursday"],
  ["5", "Friday"],
  ["6", "Saturday"],
  ["0", "Sunday"],
] as const;

type Preset = "quarter" | "hourly" | "daily" | "weekly" | "advanced";

/** The cron for a preset. Every fifteen minutes is the shortest the server accepts. */
function cronFor(preset: Preset, hour: number, day: string, advanced: string) {
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
  const queryClient = useQueryClient();
  const agents = useQuery(agentListQueryOptions());
  const channels = useInfiniteQuery(channelListQueryOptions());
  const create = useMutation(createRoutineMutationOptions(queryClient));
  const [open, setOpen] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [channelId, setChannelId] = useState("");
  const [instruction, setInstruction] = useState("");
  const [preset, setPreset] = useState<Preset>("daily");
  const [hour, setHour] = useState(9);
  const [day, setDay] = useState<string>("1");
  const [advanced, setAdvanced] = useState("0 9 * * 1-5");
  const [timezone, setTimezone] = useState("Europe/Amsterdam");

  const bots = agents.data ?? [];
  // The query flattens its pages itself (see lib/channels/queries).
  const channelRows = channels.data ?? [];
  const forBot = channelRows.filter(
    (channel) => !agentId || channel.agentIds.includes(agentId),
  );

  if (!open) {
    return (
      <div className="mb-6">
        <Button onClick={() => setOpen(true)} size="sm" variant="outline">
          New routine
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
        <span className="text-muted-foreground">Bot</span>
        <select
          className={field}
          onChange={(event) => setAgentId(event.target.value)}
          required
          value={agentId}
        >
          <option value="">Choose a Bot</option>
          {bots.map((bot) => (
            <option key={bot.id} value={bot.id}>
              {bot.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">
          Channel (where the Bot posts; leave empty for your channel with it)
        </span>
        <select
          className={field}
          onChange={(event) => setChannelId(event.target.value)}
          value={channelId}
        >
          <option value="">Your channel with this Bot</option>
          {forBot.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Instruction</span>
        <textarea
          className={field}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="Post a summary of last week's Google Ads results: cost, conversions, CPA and ROAS versus the week before."
          required
          rows={3}
          value={instruction}
        />
      </label>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">When</span>
          <select
            className={field}
            onChange={(event) => setPreset(event.target.value as Preset)}
            value={preset}
          >
            <option value="quarter">Every 15 minutes</option>
            <option value="hourly">Every hour</option>
            <option value="daily">Every day at</option>
            <option value="weekly">Every week on</option>
            <option value="advanced">Advanced (cron)</option>
          </select>
        </label>
        {preset === "weekly" ? (
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Day</span>
            <select
              className={field}
              onChange={(event) => setDay(event.target.value)}
              value={day}
            >
              {DAYS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {preset === "daily" || preset === "weekly" ? (
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Hour</span>
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
              Cron (minute hour day month weekday)
            </span>
            <input
              className={`${field} font-mono`}
              onChange={(event) => setAdvanced(event.target.value)}
              value={advanced}
            />
          </label>
        ) : null}
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">Time zone</span>
          <input
            className={field}
            onChange={(event) => setTimezone(event.target.value)}
            value={timezone}
          />
        </label>
      </div>
      {create.isError ? (
        <p className="text-destructive text-sm" role="alert">
          {create.error instanceof Error
            ? create.error.message
            : "The routine could not be created."}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button disabled={create.isPending || !agentId} size="sm" type="submit">
          Create routine
        </Button>
        <Button
          onClick={() => setOpen(false)}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
