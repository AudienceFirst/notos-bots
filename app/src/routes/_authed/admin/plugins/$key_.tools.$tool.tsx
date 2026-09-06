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
  const [error, setError] = useState<string | null>(null);

  const setGrant = useMutation({
    ...setPluginGrantMutationOptions(queryClient),
    onError: (thrown: Error) => setError(thrown.message),
  });

  const server = plugins.data?.servers.find((row) => row.id === key);
  const tool = server?.tools.find((row) => row.name === toolName);

  const back = {
    label: server?.title ?? "Plugin",
    linkProps: {
      params: { key },
      to: "/admin/plugins/$key" as const,
    },
  };

  /* Nothing rather than a placeholder, so no sentence asserts anything while the fetch is open. */
  if (plugins.isPending) {
    return <PageShell title="Tool">{null}</PageShell>;
  }

  if (!tool) {
    return (
      <PageShell
        backButton={back}
        description="This connector does not advertise a tool by that name."
        title={toolName}
      >
        {/*
         * Says which of the two it is. A tool disappears from this list when the vendor stops
         * offering it, and that reads very differently from a mistyped address.
         */}
        <PageEmpty>
          {server
            ? "It may have been withdrawn since the tool list was last refreshed."
            : "This deployment has not enabled that connector."}
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
      description={tool.description || "This tool came with no description."}
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
            ? "This tool changes something at the vendor. A boundary written about writes applies to it, and it is refused when one matches."
            : "This tool only reads. A boundary written about writes does not apply to it."
        }
        title="What it does"
      >
        <PageRows>
          {/*
           * Read-only, and the layout skill's third row kind is right here: there is one of it, it is
           * the fact the section exists to state, and nothing about it is switchable. The effect
           * comes from the vendor's own classification, not from the tool's name.
           */}
          <Item size="sm">
            <ItemContent>
              <ItemTitle>Effect</ItemTitle>
              <ItemDescription>
                Decided by the connector, not by the tool's name. Anything
                unrecognised counts as a write.
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
                {tool.effect === "write" ? "changes things" : "reads"}
              </span>
            </ItemActions>
          </Item>
        </PageRows>
      </PageSection>

      <PageSection
        description="A Bot may call this tool only while its switch is on. Turning one off takes effect on the next call, with nothing cached in between. Every call is still checked against the boundaries and written to the audit trail."
        title="Bots"
      >
        {bots.length === 0 ? (
          <PageEmpty>
            This deployment has no Bots yet, so there is nobody to grant this
            to.
          </PageEmpty>
        ) : (
          <>
            {stuck > 0 ? (
              <p
                className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm"
                role="status"
              >
                <span className="font-medium">
                  {stuck === 1
                    ? "1 Bot holds this tool but cannot call it yet."
                    : `${stuck} Bots hold this tool but cannot call it yet.`}
                </span>{" "}
                They have no credential for calling tools back, so every call is
                refused before it reaches the boundary. Issue one on each Bot's
                own page, or set <code>AGENT_TOOL_TOKEN</code> for the
                deployment.
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
              labelFor={(bot) => `Let ${bot.name} call ${toolName}`}
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
                    cannot call back
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
