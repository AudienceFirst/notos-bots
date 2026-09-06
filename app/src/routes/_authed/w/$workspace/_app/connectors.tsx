// NOTOS: alle connectors op één tab, met status en de weg om te koppelen (Mitch, 5 september 2026).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ConnectorMark } from "@/components/connectors/marks";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import { addCuratedServerMutationOptions } from "@/lib/plugins/mutations";
import { useConnectorSummary } from "@/lib/plugins/catalogue-text";
import {
  type CatalogueItem,
  connectionsQueryOptions,
  pluginsPageQueryOptions,
} from "@/lib/plugins/queries";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

export const Route = createFileRoute("/_authed/w/$workspace/_app/connectors")({
  component: ConnectorsPage,
});

type Category =
  | "zuid"
  | "google"
  | "marketing"
  | "commerce"
  | "web"
  | "work"
  | "builtIn"
  | "other";

/** Where a connector sits on the page. Anything the catalogue adds later lands under Other. */
const CATEGORY: Record<string, Category> = {
  frida: "zuid",
  gmail: "google",
  "google-drive": "google",
  hubspot: "marketing",
  klaviyo: "marketing",
  shopify: "commerce",
  stripe: "commerce",
  paypal: "commerce",
  webflow: "web",
  figma: "web",
  cloudflare: "web",
  notion: "work",
  linear: "work",
  monday: "work",
  routines: "builtIn",
};
const ORDER: Category[] = [
  "zuid",
  "google",
  "marketing",
  "commerce",
  "web",
  "work",
  "builtIn",
  "other",
];
/** The heading of each category, translated where it is rendered. */
const CATEGORY_KEY: Record<Category, string> = {
  zuid: "workspace.connectors.categoryZuid",
  google: "workspace.connectors.categoryGoogle",
  marketing: "workspace.connectors.categoryMarketing",
  commerce: "workspace.connectors.categoryCommerce",
  web: "workspace.connectors.categoryWeb",
  work: "workspace.connectors.categoryWork",
  builtIn: "workspace.connectors.categoryBuiltIn",
  other: "workspace.connectors.categoryOther",
};

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
  const t = useT();
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

  const groups = new Map<Category, CatalogueItem[]>();
  for (const entry of plugins.data?.catalogue ?? []) {
    const category = CATEGORY[entry.key] ?? "other";
    groups.set(category, [...(groups.get(category) ?? []), entry]);
  }
  const ordered = ORDER.filter((name) => groups.has(name));

  return (
    <PageShell
      // A grid of cards, not prose: `wide` still caps at 64rem, which on a large display left two
      // columns and a 400px margin. The cap goes, and `auto-fill` decides the column count.
      className="max-w-none"
      description={t("workspace.connectors.description")}
      title={t("workspace.connectors.title")}
      width="wide"
    >
      {plugins.isPending || connections.isPending ? null : plugins.error ? (
        <p className="text-destructive text-sm" role="alert">
          {t("workspace.connectors.loadFailed")}
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
                {t(CATEGORY_KEY[category])}
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
  const t = useT();
  const summaryOf = useConnectorSummary();
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
      {/* The whole summary. Clamped, ten of fifteen cards ended in "…" on a screen with room to spare. */}
      <p className="text-muted-foreground text-sm">
        {summaryOf(entry.key, entry.summary)}
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
            ? t("workspace.connectors.statusBuiltIn")
            : status.kind === "connected"
              ? t("workspace.connectors.statusConnected")
              : status.kind === "enabled"
                ? t("workspace.connectors.statusEnabled")
                : status.kind === "connect"
                  ? t("workspace.connectors.statusNotConnected")
                  : t("workspace.connectors.statusOff")}
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
            {status.kind === "connect"
              ? t("workspace.connectors.connect")
              : t("workspace.connectors.manage")}
          </Button>
        ) : status.kind === "enable" && !status.perInstance ? (
          <Button
            disabled={pending}
            onClick={onEnable}
            size="sm"
            variant="outline"
          >
            {t("workspace.connectors.enable")}
          </Button>
        ) : status.kind === "enable" ? (
          <Button
            render={(props) => <Link {...props} to="/admin/plugins" />}
            size="sm"
            variant="outline"
          >
            {t("workspace.connectors.setUp")}
          </Button>
        ) : status.kind === "ask" ? (
          <span className="text-muted-foreground text-xs">
            {t("workspace.connectors.askAdmin")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
