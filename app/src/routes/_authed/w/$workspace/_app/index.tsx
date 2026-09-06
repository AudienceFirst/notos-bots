import { keepWorkspace } from "@/notos/workspace";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AgentCard } from "@/components/agents/agent-card";
import { Composer, toAgentOptions } from "@/components/channels/composer";
import { SidebarToggleBar } from "@/components/layout/sidebar-toggle";
import { agentListQueryOptions } from "@/lib/agents/queries";
import { routeMessage } from "@/lib/channels/route";
import { useStartChannel } from "@/lib/channels/start";
import { appConfig } from "@/lib/generated/application-config";
import { useT } from "@/i18n";

export const Route = createFileRoute("/_authed/w/$workspace/_app/")({
  component: RouteComponent,
});

/**
 * How many Bots the home screen shows before it points at the roster.
 *
 * A wrapping grid of at most eight, not a row of all of them: the row ran to 3,500px inside a
 * 630px column with nothing to scroll it, so on a laptop six of twenty-two Bots were reachable and
 * on a phone two and a half. Eight wraps onto two lines at prose width, and the roster is one link
 * away for the rest.
 */
const EXPLORE_LIMIT = 8;

function RouteComponent() {
  const { data: agents } = useQuery(agentListQueryOptions());
  const explore = agents?.filter((a) => !a.mine && a.visibility === "public");
  const { start, startChosen, pending } = useStartChannel();
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  /** Default recipient when the composer draft has no mention. */
  const fallback = explore?.[0] ?? agents?.[0];

  return (
    <>
      <SidebarToggleBar />
      <div className="flex-1 flex flex-col items-center justify-center w-full p-4 mt-8">
        <div className="flex flex-col items-center">
          <h2 className="text-sm uppercase text-muted-foreground font-medium tracking-tight text-center">
            {appConfig.brand.productName}
          </h2>
          <h1 className="text-2xl font-bold tracking-tight mt-1.5 text-center">
            {t("workspace.index.title")}
          </h1>
        </div>
        <div className="mt-8 w-full flex flex-col items-center">
          <Composer
            agents={toAgentOptions(agents)}
            className="w-full max-w-2xl"
            disabled={!fallback}
            onSubmit={async (draft) => {
              // A channel is pinned to one coworker for the life of its thread, so the coworker is
              // chosen now, before it is created. An `@` is an explicit choice and is honoured as-is.
              // With no `@`, the message is routed to the coworker it is for; if that routing cannot
              // run, it falls back to the same default the composer used to always use.
              setError(null);
              try {
                if (draft.agentId) {
                  // Recorded and started as one sequence, shared with `/channel/new`: the person
                  // already decided, and the trail has to say so wherever they decided it.
                  await startChosen(draft.agentId, draft.text);
                  return;
                }
                let agentId: string | undefined;
                try {
                  agentId = (await routeMessage(draft.text)).agentId;
                } catch {
                  agentId = fallback?.id;
                }
                if (!agentId) return;
                await start(agentId, draft.text);
              } catch (caught) {
                setError(
                  caught instanceof Error
                    ? caught.message
                    : t("workspace.index.startFailed"),
                );
                throw caught;
              }
            }}
            pending={pending}
          />
          {fallback ? (
            // Said out loud: a message that silently reaches somebody you did not choose is the
            // kind of surprise that costs trust the first time it happens.
            <p className="mt-2 w-full max-w-2xl text-xs text-muted-foreground text-center">
              {t("workspace.index.routedHintBefore")}
              <code>@</code>
              {t("workspace.index.routedHintAfter")}
            </p>
          ) : null}
          {error ? (
            <p
              className="mt-2 w-full max-w-2xl text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>
        {!!explore?.length && (
          <div className="mt-10 w-full max-w-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">{t("workspace.index.bots")}</h2>
              <Link
                className="text-sm text-muted-foreground hover:text-foreground"
                params={keepWorkspace}
                to="/w/$workspace/agents"
              >
                {t("workspace.index.allBots")}
              </Link>
            </div>
            {/* The roster's grid: fixed cards, `gap-4`, wrapping on the width it actually has. */}
            <div className="mt-4 grid grid-cols-[repeat(auto-fill,144px)] gap-4">
              {explore.slice(0, EXPLORE_LIMIT).map((agent) => (
                <Link
                  key={agent.id}
                  to="/w/$workspace/channel/new"
                  params={keepWorkspace}
                  search={{
                    agent: agent.id,
                  }}
                >
                  <AgentCard agent={agent} />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
