import {
  IconArrowUpRight,
  IconChevronRight,
  IconExternalLink,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import * as React from "react";
import { useState } from "react";
import { BotGrantPicker } from "@/components/admin/bot-grant-picker";
import {
  PageEmpty,
  PageRows,
  PageSection,
  PageShell,
} from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/i18n";
import { useBotNames } from "@/lib/agents/bot-names";
import { agentListQueryOptions } from "@/lib/agents/queries";
import { useConnectorSummary } from "@/lib/plugins/catalogue-text";
import { storeMcpToken } from "@/lib/credentials/mutations";
import {
  addCuratedServerMutationOptions,
  connectAccountMutationOptions,
  grantPlugin,
  invalidatePlugins,
  refreshPluginServerMutationOptions,
  registerOAuthClientMutationOptions,
  removePluginServerMutationOptions,
} from "@/lib/plugins/mutations";
import {
  connectionsQueryOptions,
  pluginsPageQueryOptions,
} from "@/lib/plugins/queries";

/**
 * One vendor: what it needs from this deployment, and which Bots hold its tools.
 *
 * Its own page because what a connector needs configured differs by vendor and does not fit on a
 * row. A token for one, an OAuth client and a redirect URI for another, an instance hostname for a
 * third, and then a grant per tool per Bot. The screen this replaced tried to hold all of that in a
 * list and grew a column per Bot, which is how a grant goes unread.
 */
export const Route = createFileRoute("/_authed/admin/plugins/$key")({
  component: RouteComponent,
});

/** Which of the five dialogs is open, or none. */
type OpenDialog = "token" | "client" | "instance" | "grant" | "disable" | null;

/** The set with one member toggled, as a new set so React sees the change. */
function toggled(
  set: ReadonlySet<string>,
  member: string,
): ReadonlySet<string> {
  const next = new Set(set);
  if (!next.delete(member)) next.add(member);
  return next;
}

/**
 * How widely a tool is granted, in words rather than a fraction.
 *
 * "0/3" needs decoding and reads as a score. The two ends are the ones worth recognising without
 * reading — nothing holds this, or everything does — so they are named, and the middle is the only
 * case that gets a number.
 */
type Translate = ReturnType<typeof useT>;

function grantSummary(t: Translate, held: number, total: number): string {
  if (held === 0) return t("admin-b.plugin.noBots");
  if (held === total)
    return total === 1
      ? t("admin-b.plugin.oneBot")
      : t("admin-b.plugin.allBots");
  return t("admin-b.plugin.someBots", { held, total });
}

function RouteComponent() {
  const summaryOf = useConnectorSummary();
  const { key } = useParams({ from: "/_authed/admin/plugins/$key" });
  const queryClient = useQueryClient();
  const plugins = useQuery(pluginsPageQueryOptions());
  /*
   * The administrator's OWN connections, not the deployment's.
   *
   * On an admin screen that is a deliberate mixture, and it is the useful one: setting a per-person
   * connector up and finding out whether it works are two different questions, and the second has no
   * answer anywhere on this page without it. Nobody else's connection is readable here — the endpoint
   * only ever returns the caller's, so this cannot become a list of who has connected what.
   */
  const connections = useQuery(connectionsQueryOptions());
  const { data: agents } = useQuery(agentListQueryOptions());
  const youConnected = (connections.data?.connections ?? []).some(
    (row) => row.serverId === key,
  );
  const nameFor = useBotNames();
  const t = useT();

  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [token, setToken] = useState("");
  const [instanceHost, setInstanceHost] = useState("");
  const [client, setClient] = useState({ clientId: "", clientSecret: "" });
  /** Who gets the tools, and which, while the grant dialog is open. */
  const [selectedBots, setSelectedBots] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [selectedRefs, setSelectedRefs] = useState<ReadonlySet<string>>(
    new Set(),
  );
  /**
   * How far through a batch of grants we are, or null when none is running.
   *
   * A count rather than a boolean because a bulk grant is honestly N writes: a Bot times twelve
   * tools is twelve requests, and a button that says only "Granting…" for the length of them gives
   * an administrator no way to tell a slow batch from a stuck one.
   */
  const [granting, setGranting] = useState<{
    done: number;
    total: number;
  } | null>(null);

  /* Every write reports into one banner rather than each growing its own handler. */
  const report = { onError: (thrown: Error) => setError(thrown.message) };
  const addCurated = useMutation({
    ...addCuratedServerMutationOptions(queryClient),
    ...report,
  });
  const registerClient = useMutation({
    ...registerOAuthClientMutationOptions(queryClient),
    ...report,
  });
  const refresh = useMutation({
    ...refreshPluginServerMutationOptions(queryClient),
    ...report,
  });
  const remove = useMutation({
    ...removePluginServerMutationOptions(queryClient),
    ...report,
  });
  const connectSelf = useMutation({
    // Back to this page afterwards, not to the personal settings screen.
    ...connectAccountMutationOptions("admin"),
    ...report,
    /*
     * A full page navigation, not a fetch. The consent screen is the vendor's own and has to be
     * shown to this person in their own browser; there is deliberately nothing here that could
     * complete it for them, and nothing about being an administrator changes that.
     */
    onSuccess: (authorizationUrl) => {
      window.location.href = authorizationUrl;
    },
  });
  const entry = plugins.data?.catalogue.find((item) => item.key === key);
  const server = plugins.data?.servers.find((item) => item.id === key);
  const bots = (agents ?? []).map((agent: { id: string }) => ({
    id: agent.id,
    name: nameFor(agent.id),
  }));

  /**
   * How this vendor is reached, from whichever record we have.
   *
   * A server added by URL has no catalogue entry, and nothing about it is reached as a person, so it
   * falls back to the shared-token shape.
   */
  const auth = entry?.auth ?? "deployment-bearer";
  const title = entry?.title ?? server?.title ?? key;

  /** Adding is two writes when a token was typed: the credential, then the record pointing at it. */
  const add = async () => {
    setError(null);
    try {
      const credentialId =
        auth === "deployment-bearer"
          ? await storeMcpToken(key, token || undefined)
          : undefined;
      await addCurated.mutateAsync({
        key,
        instanceHost: instanceHost || undefined,
        credentialId,
      });
      if (auth === "user-oauth" && client.clientId && client.clientSecret) {
        await registerClient.mutateAsync({ serverId: key, ...client });
      }
      setToken("");
      setClient({ clientId: "", clientSecret: "" });
      setDialog(null);
    } catch (thrown) {
      setError((thrown as Error).message);
    }
  };

  /*
   * One write per grant, in selection order. The server records each grant as its own audit row, so
   * a bulk action here is honestly N decisions; a refusal stops the rest and leaves the dialog open
   * with the banner saying why.
   *
   * One refetch for the batch, at the end. Going through the grant mutation invalidated every plugin
   * query after each write and awaited it, so a batch of twenty grants was twenty round trips
   * interleaved with twenty refetches of a list nobody could see behind the dialog — most of the
   * wait, for nothing anybody read. It is invalidated even when a grant is refused, because the ones
   * before it landed and the screen behind is now stale about them.
   */
  const grantSelected = async () => {
    setError(null);
    const total = selectedBots.size * selectedRefs.size;
    setGranting({ done: 0, total });
    let done = 0;
    try {
      for (const agentId of selectedBots) {
        for (const ref of selectedRefs) {
          await grantPlugin({ agentId, kind: "mcp", ref });
          done += 1;
          setGranting({ done, total });
        }
      }
      setDialog(null);
    } catch (thrown) {
      setError((thrown as Error).message);
    } finally {
      await invalidatePlugins(queryClient);
      setGranting(null);
    }
  };

  /* Nothing rather than a placeholder, so no sentence asserts anything while the fetch is open. */
  if (plugins.isPending) {
    return (
      <PageShell title={t("admin-b.plugin.pendingTitle")}>{null}</PageShell>
    );
  }
  if (!(entry || server)) {
    return (
      <PageShell
        backButton={{
          label: t("admin-b.plugin.back"),
          linkProps: { to: "/admin/plugins" },
        }}
        description={t("admin-b.plugin.notFoundDescription")}
        title={t("admin-b.plugin.notFoundTitle")}
      >
        <PageEmpty>{t("admin-b.plugin.notFoundEmpty")}</PageEmpty>
      </PageShell>
    );
  }

  /* The grant dialog's two halves of the tool list, split by what a boundary would see. */
  const reads = server?.tools.filter((tool) => tool.effect !== "write") ?? [];
  const writes = server?.tools.filter((tool) => tool.effect === "write") ?? [];
  const chosenWrites = writes.filter((tool) =>
    selectedRefs.has(tool.ref),
  ).length;
  const chosenNames = bots
    .filter((bot) => selectedBots.has(bot.id))
    .map((bot) => bot.name);

  /* What switching the vendor off takes with it, said in the dialog that asks. */
  const grantsHeld = server ? [...server.tools, ...server.withdrawn] : [];
  const grantCount = grantsHeld.reduce(
    (sum, tool) => sum + tool.grantedTo.length,
    0,
  );
  const grantedBots = new Set(grantsHeld.flatMap((tool) => tool.grantedTo))
    .size;

  return (
    <PageShell
      backButton={{
        label: t("admin-b.plugin.back"),
        linkProps: { to: "/admin/plugins" },
      }}
      description={
        entry
          ? summaryOf(entry.key, entry.summary)
          : server
            ? summaryOf(server.id, server.summary)
            : undefined
      }
      title={title}
    >
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {/*
       * No section heading. This is one decision, and a heading over a single row that repeats the
       * row's own title tells a reader nothing they cannot already see.
       */}
      <PageSection>
        <PageRows className="mt-0">
          {/*
           * Binary and immediate, which is what the layout skill reserves a Switch for: it takes
           * effect when switched and there is no save. It replaces an "Add to deployment" button and
           * a destructive "Remove" row that were the same decision drawn twice, in two places, one of
           * them looking far more dangerous than the other.
           *
           * The description states the consequence in the present tense, in both directions, because
           * switching this off deletes every grant on the vendor's tools and that is not recoverable
           * by switching it back on.
           */}
          <Item size="sm">
            <ItemContent>
              <ItemTitle>{t("admin-b.plugin.enable")}</ItemTitle>
              <ItemDescription>
                {server
                  ? t("admin-b.plugin.enabledDescription")
                  : t("admin-b.plugin.disabledDescription")}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                aria-label={t("admin-b.plugin.enableLabel", { title })}
                checked={server !== undefined}
                onCheckedChange={(next) => {
                  setError(null);
                  /* Off is asked about first: it deletes every grant on the vendor's tools. */
                  if (next) void add();
                  else setDialog("disable");
                }}
              />
            </ItemActions>
          </Item>
        </PageRows>
      </PageSection>

      {server ? (
        <PageSection
          description={
            auth === "user-oauth"
              ? t("admin-b.plugin.connectionOauthDescription")
              : auth === "builtin"
                ? t("admin-b.plugin.connectionBuiltinDescription")
                : t("admin-b.plugin.connectionBearerDescription")
          }
          title={t("admin-b.plugin.connection")}
        >
          {/*
           * Rows that DO something, and nothing else — with two admitted exceptions. The layout
           * skill's third row kind — a value with no chevron and nothing to click — earns its
           * place on a screen full of them, but among four actionable rows a dead one reads as a
           * control that has stopped working. The redirect URI is prose under the card instead.
           *
           * The first exception is the OAuth client row for a vendor with a dynamic client: there
           * is a real fact to state — this deployment registers itself, nobody configures it —
           * right where the actionable client row would otherwise sit. Leaving that slot empty
           * would read as a missing setup step, not as nothing to do.
           *
           * The second is the whole Connection card for a builtin server: there is nothing to
           * configure, but a card of nothing under a "Connection" heading reads as a missing setup
           * step rather than as the answer. The row states that plainly instead of leaving the
           * card empty — and being first, it also gives the docsUrl row below something other than
           * the card's own top border to sit its leading separator against.
           */}
          <PageRows>
            {auth === "builtin" ? (
              /*
               * Nothing to click. A builtin server runs inside this deployment, on tables it
               * already owns — there is no vendor to authenticate to and no credential to store.
               */
              <Item size="sm">
                <ItemContent>
                  <ItemTitle>{t("admin-b.plugin.connection")}</ItemTitle>
                  <ItemDescription>
                    {t("admin-b.plugin.builtinDescription")}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <span className="text-muted-foreground text-xs">
                    {t("admin-b.plugin.builtIn")}
                  </span>
                </ItemActions>
              </Item>
            ) : null}

            {auth === "deployment-bearer" ? (
              <Item
                render={
                  <button onClick={() => setDialog("token")} type="button" />
                }
                size="sm"
              >
                <ItemContent>
                  <ItemTitle>{t("admin-b.plugin.accessToken")}</ItemTitle>
                  <ItemDescription>
                    {t("admin-b.plugin.accessTokenDescription")}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <span className="text-muted-foreground text-xs">
                    {server?.hasCredential
                      ? t("admin-b.plugin.held")
                      : t("admin-b.plugin.notSet")}
                  </span>
                  <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </ItemActions>
              </Item>
            ) : null}

            {auth === "user-oauth" && server?.dynamicClient ? (
              /*
               * Nothing to click. This deployment registers its own OAuth client with the
               * vendor (RFC 7591) the first time anybody connects, so there is no client id
               * or secret for an administrator to hold, let alone paste.
               */
              <Item size="sm">
                <ItemContent>
                  <ItemTitle>{t("admin-b.plugin.oauthClient")}</ItemTitle>
                  <ItemDescription>
                    {t("admin-b.plugin.oauthClientDynamicDescription")}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <span className="text-muted-foreground text-xs">
                    {t("admin-b.plugin.selfRegistered")}
                  </span>
                </ItemActions>
              </Item>
            ) : null}

            {auth === "user-oauth" && !server?.dynamicClient ? (
              <Item
                render={
                  <button onClick={() => setDialog("client")} type="button" />
                }
                size="sm"
              >
                <ItemContent>
                  <ItemTitle>{t("admin-b.plugin.oauthClient")}</ItemTitle>
                  <ItemDescription>
                    {t("admin-b.plugin.oauthClientDescription")}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <span className="text-muted-foreground text-xs">
                    {server?.hasCredential
                      ? t("admin-b.plugin.registered")
                      : t("admin-b.plugin.notRegistered")}
                  </span>
                  <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </ItemActions>
              </Item>
            ) : null}

            {/*
             * The administrator's own account, on the setup screen.
             *
             * Setting a connector up and knowing whether it works are different questions, and the
             * second used to have no answer here: an administrator finished configuring Drive and
             * had to go to their personal settings to find out whether any of it was right. This row
             * answers it in place, and stays honest about being personal — it is this person's
             * connection, not deployment state, and it reaches their documents and nobody else's.
             *
             * It is NOT part of setup. The connector is fully configured without it, which is why it
             * sits below the client and says so rather than reading as the next required step.
             *
             * Shown once a client exists, because there is nothing to consent against before
             * that: a Connect button with no OAuth client behind it can only fail. A vendor with a
             * dynamic client is the exception — there is no client to register in advance, so
             * Connect is shown right away and is itself what creates one.
             */}
            {auth === "user-oauth" &&
            (server?.hasCredential || server?.dynamicClient) ? (
              <>
                <Separator />
                <Item size="sm">
                  <ItemContent>
                    <ItemTitle>{t("admin-b.plugin.yourAccount")}</ItemTitle>
                    <ItemDescription>
                      {youConnected
                        ? t("admin-b.plugin.yourAccountConnected", { title })
                        : t("admin-b.plugin.yourAccountDescription")}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    {youConnected ? (
                      <>
                        {/* Decorative: the word beside it already says which. */}
                        <span
                          aria-hidden="true"
                          className="size-1.5 rounded-full bg-emerald-500"
                        />
                        <span className="text-muted-foreground text-xs">
                          {t("admin-b.plugin.connected")}
                        </span>
                      </>
                    ) : (
                      /* The arrow says this leaves OpenBot for the vendor's consent page. It does. */
                      <Button
                        disabled={connectSelf.isPending}
                        onClick={() => {
                          setError(null);
                          connectSelf.mutate(key);
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {t("admin-b.plugin.connect")}
                        <IconArrowUpRight />
                      </Button>
                    )}
                  </ItemActions>
                </Item>
              </>
            ) : null}

            {entry?.perInstance ? (
              <>
                <Separator />
                <Item
                  render={
                    <button
                      onClick={() => setDialog("instance")}
                      type="button"
                    />
                  }
                  size="sm"
                >
                  <ItemContent>
                    <ItemTitle>{t("admin-b.plugin.instanceHost")}</ItemTitle>
                    <ItemDescription>
                      {t("admin-b.plugin.instanceHostDescription")}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <span className="text-muted-foreground text-xs">
                      {server?.url ?? t("admin-b.plugin.notSet")}
                    </span>
                    <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </ItemActions>
                </Item>
              </>
            ) : null}

            {entry?.docsUrl ? (
              <>
                <Separator />
                <Item
                  render={
                    <a href={entry.docsUrl} rel="noreferrer" target="_blank" />
                  }
                  size="sm"
                >
                  <ItemContent>
                    <ItemTitle>
                      {auth === "builtin"
                        ? t("admin-b.plugin.documentation")
                        : t("admin-b.plugin.vendorDocumentation")}
                    </ItemTitle>
                    <ItemDescription>
                      {auth === "builtin"
                        ? t("admin-b.plugin.documentationDescription")
                        : t("admin-b.plugin.vendorDocumentationDescription")}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <IconExternalLink className="size-4 shrink-0 text-muted-foreground" />
                  </ItemActions>
                </Item>
              </>
            ) : null}
          </PageRows>

          {auth === "user-oauth" ? (
            <div className="mt-3 p-3">
              {server?.dynamicClient ? (
                <p className="text-muted-foreground text-sm">
                  {t("admin-b.plugin.redirectDynamic")}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t("admin-b.plugin.redirectInstruction")}
                </p>
              )}
              {!plugins.data?.redirectUri ? (
                <p className="mt-3 text-destructive text-sm" role="alert">
                  {t("admin-b.plugin.noPublicUrl")}
                </p>
              ) : server?.dynamicClient ? null : (
                /* Selectable and monospaced: it is copied by hand into somebody else's console. */
                <code className="mt-3 block select-all break-all rounded bg-muted px-2 py-1 font-mono text-xs">
                  {plugins.data.redirectUri}
                </code>
              )}
            </div>
          ) : null}
        </PageSection>
      ) : null}

      {server ? (
        <PageSection
          /*
           * Beside the heading rather than on the page's own baseline. Refreshing is about this list
           * and nothing else on the screen — it asks the vendor what it offers now — so it belongs
           * where the list is named. Ghost, because it is a maintenance action rather than the thing
           * an administrator came here to do.
           */
          action={
            <div className="flex gap-1.5">
              <Button
                onClick={() => refresh.mutate(key)}
                size="sm"
                type="button"
                variant="ghost"
              >
                {t("admin-b.plugin.refreshTools")}
              </Button>
              {/*
               * Outline where refresh is ghost: granting is the thing an administrator came to
               * this section to do. Hidden rather than disabled with nothing to grant — a dialog
               * over an empty list could only explain its own emptiness.
               */}
              {server.tools.length > 0 && bots.length > 0 ? (
                <Button
                  onClick={() => {
                    setSelectedBots(new Set());
                    setSelectedRefs(new Set());
                    setDialog("grant");
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("admin-b.plugin.grantTools")}
                </Button>
              ) : null}
            </div>
          }
          description={t("admin-b.plugin.toolsDescription")}
          title={t("admin-b.plugin.tools")}
        >
          {server.tools.length === 0 ? (
            <PageEmpty>
              {server.lastError ?? t("admin-b.plugin.toolsEmpty")}
            </PageEmpty>
          ) : (
            <PageRows>
              {server.tools.map((tool, index) => (
                <React.Fragment key={tool.ref}>
                  {/* A real link with no children: children passed to `render` replace the row's own. */}
                  <Item
                    render={
                      <Link
                        params={{ key, tool: tool.name }}
                        to="/admin/plugins/$key/tools/$tool"
                      />
                    }
                    size="sm"
                  >
                    <ItemContent>
                      <ItemTitle className="font-mono text-xs">
                        {tool.name}
                      </ItemTitle>
                      <ItemDescription>{tool.description}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      {/*
                       * How many Bots hold it, not which. The names were here as a chip each and
                       * turned every row into a wrapping cluster of controls — twenty-four of them
                       * across this list — with the tool's own name losing the fight for attention.
                       * A count is what a reader scanning for "what is exposed, and how widely" is
                       * actually asking, and the names are one click away where they can be switched
                       * one at a time.
                       */}
                      <span className="text-muted-foreground text-xs">
                        {grantSummary(t, tool.grantedTo.length, bots.length)}
                      </span>
                      {/*
                       * The effect, not a description. It is what a boundary written about writes
                       * evaluates, and an operator writing that rule has no other way to know.
                       */}
                      <span
                        className={
                          tool.effect === "write"
                            ? "text-amber-600 text-xs dark:text-amber-500"
                            : "text-muted-foreground text-xs"
                        }
                      >
                        {tool.effect === "write"
                          ? t("admin-b.plugin.changesThings")
                          : t("admin-b.plugin.reads")}
                      </span>
                      <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </ItemActions>
                  </Item>
                  {index !== server.tools.length - 1 && <Separator />}
                </React.Fragment>
              ))}
            </PageRows>
          )}
        </PageSection>
      ) : null}

      {/*
       * Only when there is something to say. An empty section here would teach a reader to scroll past
       * a heading that is usually blank, which is the opposite of the point.
       *
       * Its own section rather than rows inside Tools, because these are not tools: they are not
       * listed by the vendor, there is no page to open for one, and putting them in the same list
       * would make the count above it wrong.
       */}
      {server && server.withdrawn.length > 0 ? (
        <PageSection
          description={t("admin-b.plugin.withdrawnDescription")}
          title={t("admin-b.plugin.withdrawn")}
        >
          <PageRows>
            {server.withdrawn.map((held, index) => (
              <React.Fragment key={held.ref}>
                <Item size="sm">
                  <ItemContent>
                    <ItemTitle className="font-mono text-xs">
                      {held.name}
                    </ItemTitle>
                    <ItemDescription>
                      {t(
                        server.toolsRefreshedAt
                          ? "admin-b.plugin.notListedByAsOf"
                          : "admin-b.plugin.notListedBy",
                        { title },
                      )}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <span className="text-muted-foreground text-xs">
                      {grantSummary(t, held.grantedTo.length, bots.length)}
                    </span>
                  </ItemActions>
                </Item>
                {index !== server.withdrawn.length - 1 && <Separator />}
              </React.Fragment>
            ))}
          </PageRows>
        </PageSection>
      ) : null}

      <Dialog
        onOpenChange={(open) => setDialog(open ? dialog : null)}
        open={
          dialog === "token" || dialog === "client" || dialog === "instance"
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === "client"
                ? t("admin-b.plugin.oauthClientFor", { title })
                : dialog === "instance"
                  ? t("admin-b.plugin.instanceHostFor", { title })
                  : t("admin-b.plugin.accessTokenFor", { title })}
            </DialogTitle>
            <DialogDescription>
              {dialog === "client"
                ? t("admin-b.plugin.oauthClientDialogDescription")
                : dialog === "instance"
                  ? t("admin-b.plugin.instanceHostDialogDescription")
                  : t("admin-b.plugin.accessTokenDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="mt-4">
            <FieldGroup>
              {dialog === "client" ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="client-id">
                      {t("admin-b.plugin.clientId")}
                    </FieldLabel>
                    <Input
                      id="client-id"
                      onChange={(event) =>
                        setClient((c) => ({
                          ...c,
                          clientId: event.target.value,
                        }))
                      }
                      value={client.clientId}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="client-secret">
                      {t("admin-b.plugin.clientSecret")}
                    </FieldLabel>
                    <Input
                      id="client-secret"
                      onChange={(event) =>
                        setClient((c) => ({
                          ...c,
                          clientSecret: event.target.value,
                        }))
                      }
                      type="password"
                      value={client.clientSecret}
                    />
                  </Field>
                </>
              ) : dialog === "instance" ? (
                <Field>
                  <FieldLabel htmlFor="instance-host">
                    {t("admin-b.plugin.instanceHost")}
                  </FieldLabel>
                  <Input
                    id="instance-host"
                    onChange={(event) => setInstanceHost(event.target.value)}
                    placeholder={t("admin-b.plugin.instanceHostPlaceholder")}
                    value={instanceHost}
                  />
                </Field>
              ) : (
                <Field>
                  <FieldLabel htmlFor="access-token">
                    {t("admin-b.plugin.accessToken")}
                  </FieldLabel>
                  <Input
                    id="access-token"
                    onChange={(event) => setToken(event.target.value)}
                    type="password"
                    value={token}
                  />
                </Field>
              )}
            </FieldGroup>
          </DialogBody>
          <DialogFooter className="mt-4">
            <Button onClick={() => setDialog(null)} size="sm" variant="ghost">
              {t("admin-b.plugin.cancel")}
            </Button>
            <Button
              onClick={() => {
                if (!server) {
                  void add();
                  return;
                }
                if (dialog === "client") {
                  registerClient.mutate({ serverId: key, ...client });
                }
                setDialog(null);
              }}
              size="sm"
            >
              {t("admin-b.plugin.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/*
       * Who first, then what: the decision arrives as "set this Bot up", not as a list of tools
       * looking for an owner. Both groups get a select-all; the amber heading and the footer's
       * "N of which change things" are what keep a bulk write grant a read decision, not a blind one.
       */}
      {server ? (
        <Dialog
          onOpenChange={(open) => setDialog(open ? dialog : null)}
          open={dialog === "grant"}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin-b.plugin.grantDialogTitle")}</DialogTitle>
              <DialogDescription>
                {t("admin-b.plugin.grantDialogDescription")}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="mt-4 space-y-5">
              {/*
               * Each set of tickboxes is a group named by its own heading, so a screen reader
               * reaching a bare tool name is told which list it is in. "Changes things" is the whole
               * warning on those, and it is a heading a sighted reader cannot miss and a listener
               * would otherwise never hear.
               *
               * A `fieldset` because that is what a group of tickboxes is, named by the heading
               * already on screen rather than by a `legend` duplicating it. `min-w-0` undoes the
               * one thing a fieldset brings that a div did not: a min-content floor that a long
               * tool name would push the dialog out to.
               */}
              <fieldset aria-labelledby="grant-to-heading" className="min-w-0">
                <p className="mb-2 font-medium text-sm" id="grant-to-heading">
                  {t("admin-b.plugin.grantTo")}
                </p>
                {/* Grouped by workspace and searchable: 273 tickboxes in a column were not a choice. */}
                <BotGrantPicker
                  bots={bots}
                  control="checkbox"
                  held={(botId) => selectedBots.has(botId)}
                  onChange={(botId) =>
                    setSelectedBots((previous) => toggled(previous, botId))
                  }
                />
              </fieldset>
              <div className="max-h-64 space-y-5 overflow-y-auto">
                {reads.length > 0 ? (
                  <fieldset
                    aria-labelledby="grant-reads-heading"
                    className="min-w-0"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <p
                        className="font-medium text-sm"
                        id="grant-reads-heading"
                      >
                        {t("admin-b.plugin.readsHeading")}
                      </p>
                      <Button
                        onClick={() =>
                          setSelectedRefs((previous) => {
                            const next = new Set(previous);
                            for (const tool of reads) next.add(tool.ref);
                            return next;
                          })
                        }
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        {t("admin-b.plugin.selectAll")}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {reads.map((tool) => (
                        <div className="flex items-center gap-2" key={tool.ref}>
                          <Checkbox
                            checked={selectedRefs.has(tool.ref)}
                            id={`grant-tool-${tool.ref}`}
                            onCheckedChange={() =>
                              setSelectedRefs((previous) =>
                                toggled(previous, tool.ref),
                              )
                            }
                          />
                          <label
                            className="font-mono text-xs"
                            htmlFor={`grant-tool-${tool.ref}`}
                          >
                            {tool.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </fieldset>
                ) : null}
                {writes.length > 0 ? (
                  <fieldset
                    aria-labelledby="grant-writes-heading"
                    className="min-w-0"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <p
                        className="font-medium text-amber-600 text-sm dark:text-amber-500"
                        id="grant-writes-heading"
                      >
                        {t("admin-b.plugin.changesThingsHeading")}
                      </p>
                      <Button
                        onClick={() =>
                          setSelectedRefs((previous) => {
                            const next = new Set(previous);
                            for (const tool of writes) next.add(tool.ref);
                            return next;
                          })
                        }
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        {t("admin-b.plugin.selectAll")}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {writes.map((tool) => (
                        <div className="flex items-center gap-2" key={tool.ref}>
                          <Checkbox
                            checked={selectedRefs.has(tool.ref)}
                            id={`grant-tool-${tool.ref}`}
                            onCheckedChange={() =>
                              setSelectedRefs((previous) =>
                                toggled(previous, tool.ref),
                              )
                            }
                          />
                          <label
                            className="font-mono text-xs"
                            htmlFor={`grant-tool-${tool.ref}`}
                          >
                            {tool.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </fieldset>
                ) : null}
              </div>
            </DialogBody>
            <DialogFooter className="mt-4 items-center">
              {/* What is about to happen, in one sentence, before it does. */}
              {selectedRefs.size > 0 && chosenNames.length > 0 ? (
                <p className="flex-1 text-muted-foreground text-xs">
                  {t("admin-b.plugin.grantSummarySentence", {
                    names: chosenNames.join(", "),
                    tools: t(
                      selectedRefs.size === 1
                        ? "admin-b.plugin.grantSummaryToolsOne"
                        : "admin-b.plugin.grantSummaryToolsOther",
                      { count: selectedRefs.size },
                    ),
                    writes:
                      chosenWrites > 0
                        ? t(
                            chosenWrites === 1
                              ? "admin-b.plugin.grantSummaryWritesOne"
                              : "admin-b.plugin.grantSummaryWritesOther",
                            { count: chosenWrites },
                          )
                        : "",
                  })}
                </p>
              ) : null}
              <Button onClick={() => setDialog(null)} size="sm" variant="ghost">
                {t("admin-b.plugin.cancel")}
              </Button>
              <Button
                disabled={
                  granting !== null ||
                  selectedBots.size === 0 ||
                  selectedRefs.size === 0
                }
                onClick={() => void grantSelected()}
                size="sm"
              >
                {/* The one in flight, not the ones finished: a count that starts at zero of twelve reads as nothing happening. */}
                {granting
                  ? t("admin-b.plugin.granting", {
                      done: Math.min(granting.done + 1, granting.total),
                      total: granting.total,
                    })
                  : t("admin-b.plugin.grant")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {/*
       * Switching the vendor off deletes every grant on its tools, and switching it back on does not
       * bring them back. A Switch has no room for that sentence, so it is asked here, with the count.
       */}
      {server ? (
        <Dialog
          onOpenChange={(open) => setDialog(open ? dialog : null)}
          open={dialog === "disable"}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t("admin-b.plugin.disableTitle", { title })}
              </DialogTitle>
              <DialogDescription>
                {grantCount === 0
                  ? t("admin-b.plugin.disableNothingLost")
                  : t(
                      grantCount === 1
                        ? "admin-b.plugin.disableLossOne"
                        : "admin-b.plugin.disableLossOther",
                      {
                        grants: t(
                          grantCount === 1
                            ? "admin-b.plugin.disableGrantsOne"
                            : "admin-b.plugin.disableGrantsOther",
                          { count: grantCount },
                        ),
                        bots: t(
                          grantedBots === 1
                            ? "admin-b.plugin.disableBotsOne"
                            : "admin-b.plugin.disableBotsOther",
                          { count: grantedBots },
                        ),
                      },
                    )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button onClick={() => setDialog(null)} size="sm" variant="ghost">
                {t("admin-b.plugin.cancel")}
              </Button>
              <Button
                disabled={remove.isPending}
                onClick={() => {
                  remove.mutate(key);
                  setDialog(null);
                }}
                size="sm"
                variant="destructive"
              >
                {t("admin-b.plugin.disableConfirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </PageShell>
  );
}
