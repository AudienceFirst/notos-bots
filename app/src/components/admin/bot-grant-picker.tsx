import { IconChevronRight } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import type * as React from "react";
import { useState } from "react";
import { PageRows } from "@/components/layout/page-shell";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/i18n";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import { cn } from "@/lib/utils";

/**
 * Every Bot in the deployment, one row each, grouped by workspace, with a search box above.
 *
 * Four admin screens decide something per Bot — a tool, a skill, a component, a batch of grants —
 * and each drew one flat list of every Bot. At three Bots that is a list; at 273 it was twenty-two
 * names repeated twelve times with nothing on the row to say which workspace a Bot belonged to, so
 * the one decision the screen exists for could not be made reliably. The workspace is the part of
 * the id before `--`, which is where the server puts it (server/src/notos/workspaces/packages.ts),
 * and its display name comes from the workspaces the signed-in person can see.
 *
 * Groups start closed when there is more than one. The count on the header already answers "how
 * widely", and the rows matter only once somebody is looking for a particular Bot; typing in the
 * search box opens every group that still has a match. A single group draws no header at all.
 */

export type PickerBot = { id: string; name: string };

type Props = {
  bots: PickerBot[];
  /** Whether a Bot holds the thing — or is selected, when the control is a checkbox. */
  held: (botId: string) => boolean;
  onChange: (botId: string, next: boolean) => void;
  /**
   * `switch` for a grant that takes effect as it is switched, `checkbox` for a selection something
   * else acts on later. The layout skill's distinction, kept here so the four screens agree.
   */
  control?: "switch" | "checkbox";
  /** The one Bot whose write is in flight, so only its row is disabled. */
  pendingId?: string | null;
  /** The control's accessible name. The Bot's name when absent. */
  labelFor?: (bot: PickerBot) => string;
  /** A line under the name, when the row has something to say. */
  describe?: (bot: PickerBot, held: boolean) => React.ReactNode;
  /** A marker beside the control, for a state the control itself cannot show. */
  trailing?: (bot: PickerBot, held: boolean) => React.ReactNode;
  testIdFor?: (bot: PickerBot) => string;
  className?: string;
};

/** The workspace slug a Bot id carries, or null for a Bot from before the workspaces. */
export function workspaceOf(botId: string): string | null {
  const at = botId.indexOf("--");
  return at > 0 ? botId.slice(0, at) : null;
}

type Group = { key: string; label: string; bots: PickerBot[] };

export function BotGrantPicker({
  bots,
  held,
  onChange,
  control = "switch",
  pendingId = null,
  labelFor,
  describe,
  trailing,
  testIdFor,
  className,
}: Props) {
  const t = useT();
  const { data: user } = useQuery(currentUserQueryOptions());
  const [query, setQuery] = useState("");
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());

  const displayName = new Map(
    (user?.workspaces ?? []).map((workspace) => [
      workspace.notosClientId,
      workspace.displayName,
    ]),
  );

  /* Bots without a workspace go last, under this heading. */
  const noWorkspace = t("admin-a.bot-grant-picker.noWorkspace");

  const groups: Group[] = [];
  const byKey = new Map<string, Group>();
  for (const bot of bots) {
    const slug = workspaceOf(bot.id);
    const key = slug ?? "";
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        label: slug === null ? noWorkspace : (displayName.get(slug) ?? slug),
        bots: [],
      };
      byKey.set(key, group);
      groups.push(group);
    }
    group.bots.push(bot);
  }
  groups.sort((a, b) =>
    a.key === "" ? 1 : b.key === "" ? -1 : a.label.localeCompare(b.label),
  );

  /* A match on the workspace name keeps its whole group; otherwise the row has to match itself. */
  const needle = query.trim().toLowerCase();
  const shown =
    needle === ""
      ? groups
      : groups
          .map((group) => ({
            ...group,
            bots: group.label.toLowerCase().includes(needle)
              ? group.bots
              : group.bots.filter(
                  (bot) =>
                    bot.name.toLowerCase().includes(needle) ||
                    bot.id.toLowerCase().includes(needle),
                ),
          }))
          .filter((group) => group.bots.length > 0);

  const heldCount = bots.filter((bot) => held(bot.id)).length;
  /* Headers only when there is something to choose between. */
  const headed = groups.length > 1;

  const toggle = (key: string) =>
    setOpened((previous) => {
      const next = new Set(previous);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-3">
        <Input
          aria-label={t("admin-a.bot-grant-picker.searchAria")}
          className="h-8 min-w-0 flex-1 text-sm"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("admin-a.bot-grant-picker.searchPlaceholder")}
          type="search"
          value={query}
        />
        <span
          className="shrink-0 text-muted-foreground text-xs tabular-nums"
          role="status"
        >
          {t(
            bots.length === 1
              ? "admin-a.bot-grant-picker.countOne"
              : "admin-a.bot-grant-picker.countOther",
            { held: heldCount, total: bots.length },
          )}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t("admin-a.bot-grant-picker.noMatch", { query: query.trim() })}
        </p>
      ) : (
        <PageRows className="mt-0">
          {shown.map((group, groupIndex) => {
            const open = !headed || needle !== "" || opened.has(group.key);
            const heldHere = group.bots.filter((bot) => held(bot.id)).length;
            return (
              <div key={group.key}>
                {groupIndex !== 0 && <Separator />}
                {headed ? (
                  <GroupHeader
                    count={t("admin-a.bot-grant-picker.groupCount", {
                      held: heldHere,
                      total: group.bots.length,
                    })}
                    label={group.label}
                    onToggle={
                      needle === "" ? () => toggle(group.key) : undefined
                    }
                    open={open}
                  />
                ) : null}
                {open
                  ? group.bots.map((bot, index) => {
                      const has = held(bot.id);
                      return (
                        <div key={bot.id}>
                          {headed || index !== 0 ? <Separator /> : null}
                          <Row
                            bot={bot}
                            control={control}
                            description={describe?.(bot, has)}
                            disabled={pendingId === bot.id}
                            has={has}
                            label={labelFor?.(bot) ?? bot.name}
                            marker={trailing?.(bot, has)}
                            onChange={(next) => onChange(bot.id, next)}
                            testId={testIdFor?.(bot)}
                          />
                        </div>
                      );
                    })
                  : null}
              </div>
            );
          })}
        </PageRows>
      )}
    </div>
  );
}

/**
 * A workspace's heading. A button while the groups can be folded; plain text while a search is
 * open, because then every group with a match is open and a chevron that did nothing would lie.
 */
function GroupHeader({
  count,
  label,
  onToggle,
  open,
}: {
  count: string;
  label: string;
  onToggle?: () => void;
  open: boolean;
}) {
  const inner = (
    <>
      <IconChevronRight
        className={cn(
          "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
          open && "rotate-90",
        )}
      />
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
        {count}
      </span>
    </>
  );
  const shape = "flex w-full items-center gap-2 px-3 py-2 text-left text-sm";
  if (!onToggle) return <div className={shape}>{inner}</div>;
  return (
    <button
      aria-expanded={open}
      className={cn(shape, "transition-colors hover:bg-muted/50")}
      onClick={onToggle}
      type="button"
    >
      {inner}
    </button>
  );
}

/** One Bot. The checkbox leads its label, the switch trails its row, as they do everywhere else. */
function Row({
  bot,
  control,
  description,
  disabled,
  has,
  label,
  marker,
  onChange,
  testId,
}: {
  bot: PickerBot;
  control: "switch" | "checkbox";
  description: React.ReactNode;
  disabled: boolean;
  has: boolean;
  label: string;
  marker: React.ReactNode;
  onChange: (next: boolean) => void;
  testId: string | undefined;
}) {
  const id = `bot-picker-${bot.id}`;
  return (
    <Item size="sm">
      {control === "checkbox" ? (
        <ItemMedia>
          <Checkbox
            checked={has}
            data-testid={testId}
            disabled={disabled}
            id={id}
            onCheckedChange={(next) => onChange(next)}
          />
        </ItemMedia>
      ) : null}
      <ItemContent>
        {control === "checkbox" ? (
          /* A real label, so the name is a click target for its box. */
          <label
            className="w-fit font-medium text-sm leading-snug"
            htmlFor={id}
          >
            {bot.name}
          </label>
        ) : (
          <ItemTitle>{bot.name}</ItemTitle>
        )}
        {description ? (
          <ItemDescription className="line-clamp-none">
            {description}
          </ItemDescription>
        ) : null}
      </ItemContent>
      {control === "switch" || marker ? (
        <ItemActions>
          {marker}
          {control === "switch" ? (
            <Switch
              aria-label={label}
              checked={has}
              data-testid={testId}
              disabled={disabled}
              onCheckedChange={(next) => onChange(next)}
            />
          ) : null}
        </ItemActions>
      ) : null}
    </Item>
  );
}
