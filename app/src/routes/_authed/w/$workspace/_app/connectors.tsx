// NOTOS: alle connectors op één tab, met status en de weg om te koppelen (Mitch, 5 september 2026).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ConnectorMark } from "@/components/connectors/marks";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import { addCuratedServerMutationOptions } from "@/lib/plugins/mutations";
import {
  type CatalogueItem,
  connectionsQueryOptions,
  pluginsPageQueryOptions,
} from "@/lib/plugins/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/w/$workspace/_app/connectors")({
  component: ConnectorsPage,
});

/** Where a connector sits on the page. Anything the catalogue adds later lands under Other. */
const CATEGORY: Record<string, string> = {
  frida: "ZUID",
  gmail: "Google",
  "google-drive": "Google",
  hubspot: "Marketing & CRM",
  klaviyo: "Marketing & CRM",
  shopify: "Commerce",
  stripe: "Commerce",
  paypal: "Commerce",
  webflow: "Web & design",
  figma: "Web & design",
  cloudflare: "Web & design",
  notion: "Work",
  linear: "Work",
  monday: "Work",
  routines: "Built in",
};
const ORDER = [
  "ZUID",
  "Google",
  "Marketing & CRM",
  "Commerce",
  "Web & design",
  "Work",
  "Built in",
  "Other",
];

type Status =
  | { kind: "built-in" }
  | { kind: "connected" }
  | { kind: "connect" }
  | { kind: "enabled" }
  | { kind: "enable"; perInstance: boolean }
  | { kind: "ask" };

/**
 * One tab for every service a Bot can reach. The catalogue is a fact about the build; whether a
 * connector is switched on is an administrator's call (Admin › Plugins), and whether it reads as
 * you is yours (Settings › Connected accounts). This page shows all three at once and sends you
 * to the right place, so nobody has to know which of the two other pages holds the switch.
 */
function ConnectorsPage() {
  const queryClient = useQueryClient();
  const { data: user } = useQuery(currentUserQueryOptions());
  const plugins = useQuery(pluginsPageQueryOptions());
  const connections = useQuery(connectionsQueryOptions());
  const enable = useMutation(addCuratedServerMutationOptions(queryClient));
  const isAdmin = user?.role === "admin";

  const connected = new Set(
    (connections.data?.connections ?? []).map((row) => row.serverId),
  );
  const added = new Set((plugins.data?.servers ?? []).map((s) => s.id));

  const statusOf = (entry: CatalogueItem): Status => {
    if (entry.auth === "builtin") return { kind: "built-in" };
    if (entry.auth === "user-oauth") {
      if (!added.has(entry.key)) {
        return isAdmin
          ? { kind: "enable", perInstance: entry.perInstance }
          : { kind: "ask" };
      }
      return connected.has(entry.key)
        ? { kind: "connected" }
        : { kind: "connect" };
    }
    if (added.has(entry.key)) return { kind: "enabled" };
    return isAdmin ? { kind: "enable", perInstance: true } : { kind: "ask" };
  };

  const groups = new Map<string, CatalogueItem[]>();
  for (const entry of plugins.data?.catalogue ?? []) {
    const category = CATEGORY[entry.key] ?? "Other";
    groups.set(category, [...(groups.get(category) ?? []), entry]);
  }
  const ordered = ORDER.filter((name) => groups.has(name));

  return (
    <PageShell
      description="Everything a Bot can reach, in one place. Connect a service so a Bot reads it as you; an administrator switches a connector on for the whole team."
      title="Connectors"
      width="wide"
    >
      {plugins.isPending || connections.isPending ? null : plugins.error ? (
        <p className="text-destructive text-sm" role="alert">
          The connectors could not be loaded.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {enable.error ? (
            <p className="text-destructive text-sm" role="alert">
              {enable.error.message}
            </p>
          ) : null}
          {ordered.map((category) => (
            <section key={category}>
              <h2 className="mb-3 text-muted-foreground text-xs font-medium uppercase tracking-wide">
                {category}
              </h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                {(groups.get(category) ?? [])
                  .sort((a, b) => a.title.localeCompare(b.title))
                  .map((entry) => (
                    <ConnectorCard
                      entry={entry}
                      key={entry.key}
                      onEnable={() => enable.mutate({ key: entry.key })}
                      pending={enable.isPending}
                      status={statusOf(entry)}
                    />
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </PageShell>
  );
}

function ConnectorCard({
  entry,
  status,
  onEnable,
  pending,
}: {
  entry: CatalogueItem;
  status: Status;
  onEnable: () => void;
  pending: boolean;
}) {
  const live = status.kind === "connected" || status.kind === "enabled";
  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background p-4"
      data-testid={`connector-${entry.key}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <ConnectorMark className="size-5" keyName={entry.key} />
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-sm">{entry.title}</p>
          <p className="truncate text-muted-foreground text-xs">
            {entry.vendor}
          </p>
        </div>
      </div>
      <p className="line-clamp-2 text-muted-foreground text-sm">
        {entry.summary}
      </p>
      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 rounded-full",
              live ? "bg-emerald-500" : "bg-muted-foreground/40",
            )}
          />
          {status.kind === "built-in"
            ? "Built in"
            : status.kind === "connected"
              ? "Connected as you"
              : status.kind === "enabled"
                ? "Enabled"
                : status.kind === "connect"
                  ? "Not connected"
                  : "Off"}
        </span>
        {status.kind === "connect" || status.kind === "connected" ? (
          <Button
            render={(props) => (
              <Link
                {...props}
                params={{ key: entry.key }}
                to="/settings/connected-accounts/$key"
              />
            )}
            size="sm"
            variant={status.kind === "connect" ? "default" : "ghost"}
          >
            {status.kind === "connect" ? "Connect" : "Manage"}
          </Button>
        ) : status.kind === "enable" && !status.perInstance ? (
          <Button
            disabled={pending}
            onClick={onEnable}
            size="sm"
            variant="outline"
          >
            Enable
          </Button>
        ) : status.kind === "enable" ? (
          <Button
            render={(props) => <Link {...props} to="/admin/plugins" />}
            size="sm"
            variant="outline"
          >
            Set up
          </Button>
        ) : status.kind === "ask" ? (
          <span className="text-muted-foreground text-xs">
            Ask an administrator
          </span>
        ) : null}
      </div>
    </div>
  );
}
