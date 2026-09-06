import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { BotGrantPicker } from "@/components/admin/bot-grant-picker";
import {
  PageEmpty,
  PageRows,
  PageSection,
  PageShell,
} from "@/components/layout/page-shell";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { useT } from "@/i18n";
import { useBotNames } from "@/lib/agents/bot-names";
import { agentListQueryOptions } from "@/lib/agents/queries";
import { setPluginGrantMutationOptions } from "@/lib/plugins/mutations";
import { pluginsPageQueryOptions } from "@/lib/plugins/queries";

/**
 * One tool, and which Bots hold it.
 *
 * Its own screen because a grant is a per-Bot decision and there is no upper bound on Bots. The
 * connector page used to draw a chip for every Bot inside every tool row: at three Bots and eight
 * tools that is twenty-four controls stacked in a list, wrapping onto second and third lines, where
 * the thing being decided — does THIS Bot get THIS tool — was the least legible part of it. Here each
 * Bot is one row with one switch, grouped by workspace, which is the same decision with nothing
 * competing for it.
 *
 * `$key_` opts this route out of nesting under `$key.tsx`, so the connector page stays a page rather
 * than becoming a layout with an outlet.
 */
export const Route = createFileRoute(
  "/_authed/admin/plugins/$key_/tools/$tool",
)({ component: RouteComponent });

function RouteComponent() {
  const { key, tool: toolName } = useParams({
    from: "/_authed/admin/plugins/$key_/tools/$tool",
  });
  const queryClient = useQueryClient();
  const plugins = useQuery(pluginsPageQueryOptions());
  const { data: agents } = useQuery(agentListQueryOptions());
  /*
   * Whether a call from this Bot could be authenticated at all.
   *
   * Its own issued credential, or the deployment's shared one. Separate from the grant: the switch
   * decides whether the tool is offered to the model, this decides whether the call it makes gets
   * past the front door. A Bot with the grant and neither credential produced "May call this tool"
   * beside a tool that refused every call, with no audit row, because the call never arrived.
   */
  const sharedCallback = plugins.data?.botsMayCallBack === true;
  const canCallBack = (bot: { id: string }) =>
    sharedCallback ||
    agents?.find((one) => one.id === bot.id)?.hasCallbackToken === true;
  const nameFor = useBotNames();
  const t = useT();
  const [error, setError] = useState<string | null>(null);

  const setGrant = useMutation({
    ...setPluginGrantMutationOptions(queryClient),
    onError: (thrown: Error) => setError(thrown.message),
  });

  const server = plugins.data?.servers.find((row) => row.id === key);
  const tool = server?.tools.find((row) => row.name === toolName);

  const back = {
    label: server?.title ?? t("admin-b.pluginTool.backFallback"),
    linkProps: {
      params: { key },
      to: "/admin/plugins/$key" as const,
    },
  };

  /* Nothing rather than a placeholder, so no sentence asserts anything while the fetch is open. */
  if (plugins.isPending) {
    return (
      <PageShell title={t("admin-b.pluginTool.pendingTitle")}>{null}</PageShell>
    );
  }

  if (!tool) {
    return (
      <PageShell
        backButton={back}
        description={t("admin-b.pluginTool.notFoundDescription")}
        title={toolName}
      >
        {/*
         * Says which of the two it is. A tool disappears from this list when the vendor stops
         * offering it, and that reads very differently from a mistyped address.
         */}
        <PageEmpty>
          {server
            ? t("admin-b.pluginTool.withdrawn")
            : t("admin-b.pluginTool.connectorDisabled")}
        </PageEmpty>
      </PageShell>
    );
  }

  const bots = (agents ?? []).map((agent: { id: string }) => ({
    id: agent.id,
    name: nameFor(agent.id),
  }));

  /*
   * Granted, and yet every call would be refused: the state a switch cannot show. Counted once and
   * said once above the list, where it used to be a clamped sentence under each of 264 rows with the
   * instruction cut off at the second line.
   */
  const stuck = bots.filter(
    (bot) => tool.grantedTo.includes(bot.id) && !canCallBack(bot),
  ).length;

  return (
    <PageShell
      backButton={back}
      description={tool.description || t("admin-b.pluginTool.noDescription")}
      title={toolName}
    >
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <PageSection
        description={
          tool.effect === "write"
            ? t("admin-b.pluginTool.writeDescription")
            : t("admin-b.pluginTool.readDescription")
        }
        title={t("admin-b.pluginTool.whatItDoes")}
      >
        <PageRows>
          {/*
           * Read-only, and the layout skill's third row kind is right here: there is one of it, it is
           * the fact the section exists to state, and nothing about it is switchable. The effect
           * comes from the vendor's own classification, not from the tool's name.
           */}
          <Item size="sm">
            <ItemContent>
              <ItemTitle>{t("admin-b.pluginTool.effect")}</ItemTitle>
              <ItemDescription>
                {t("admin-b.pluginTool.effectDescription")}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <span
                className={
                  tool.effect === "write"
                    ? "text-amber-600 text-xs dark:text-amber-500"
                    : "text-muted-foreground text-xs"
                }
              >
                {tool.effect === "write"
                  ? t("admin-b.pluginTool.changesThings")
                  : t("admin-b.pluginTool.reads")}
              </span>
            </ItemActions>
          </Item>
        </PageRows>
      </PageSection>

      <PageSection
        description={t("admin-b.pluginTool.botsDescription")}
        title={t("admin-b.pluginTool.bots")}
      >
        {bots.length === 0 ? (
          <PageEmpty>{t("admin-b.pluginTool.noBots")}</PageEmpty>
        ) : (
          <>
            {stuck > 0 ? (
              <p
                className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
                role="status"
              >
                <span className="font-medium">
                  {t(
                    stuck === 1
                      ? "admin-b.pluginTool.stuckOne"
                      : "admin-b.pluginTool.stuckOther",
                    { count: stuck },
                  )}
                </span>{" "}
                {t("admin-b.pluginTool.stuckExplanation")}{" "}
                <code>AGENT_TOOL_TOKEN</code>{" "}
                {t("admin-b.pluginTool.stuckExplanationTail")}
              </p>
            ) : null}
            {/*
             * Binary and immediate, which is what a Switch is for: it takes effect when switched and
             * there is no save. Disabled only while its own write is in flight, so switching one Bot
             * does not freeze the rest of the list.
             */}
            <BotGrantPicker
              bots={bots}
              className="mt-4"
              held={(botId) => tool.grantedTo.includes(botId)}
              labelFor={(bot) =>
                t("admin-b.pluginTool.letCall", {
                  name: bot.name,
                  tool: toolName,
                })
              }
              onChange={(botId, next) => {
                setError(null);
                setGrant.mutate({
                  agentId: botId,
                  granted: next,
                  kind: "mcp",
                  ref: tool.ref,
                });
              }}
              pendingId={
                setGrant.isPending
                  ? (setGrant.variables?.agentId ?? null)
                  : null
              }
              trailing={(bot, held) =>
                held && !canCallBack(bot) ? (
                  <span className="text-amber-600 text-xs dark:text-amber-500">
                    {t("admin-b.pluginTool.cannotCallBack")}
                  </span>
                ) : null
              }
            />
          </>
        )}
      </PageSection>
    </PageShell>
  );
}
