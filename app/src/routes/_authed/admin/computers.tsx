import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { InlineCode } from "@/components/admin/inline-code";
import {
  PageEmpty,
  PageRows,
  PageSection,
  PageShell,
} from "@/components/layout/page-shell";
import { StaggerItem } from "@/components/layout/stagger";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { formatDateTime, useT } from "@/i18n";
import { useBotNames } from "@/lib/agents/bot-names";
import { setComputerStateMutationOptions } from "@/lib/computers/mutations";
import { computerFleetQueryOptions } from "@/lib/computers/queries";
import { deploymentCapabilitiesQueryOptions } from "@/lib/deployment/queries";
import { queryClient } from "@/query-client";

export const Route = createFileRoute("/_authed/admin/computers")({
  component: ComputersPage,
});

function ComputersPage() {
  const t = useT();
  /** Bot id currently running a stop/reset request. */
  const [busy, setBusy] = useState<string | null>(null);
  /** Reset deletes the browser profile, so it requires confirmation. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const nameFor = useBotNames();

  /** The same sentence in every state, so the page never loses what it is for. */
  const title = t("admin-a.computers.title");
  const description = t("admin-a.computers.description");

  /*
   * NOTOS: whether Bots have computers at all. Without them there is no fleet route, and asking for
   * one is a 404 dressed as a failure — which this page then reported twice. The list is not asked
   * for until the answer is in.
   */
  const capabilities = useQuery(deploymentCapabilitiesQueryOptions());
  const computersOn = capabilities.data?.computers === true;
  const fleet = useQuery({
    ...computerFleetQueryOptions(),
    enabled: computersOn,
  });
  const setState = useMutation(setComputerStateMutationOptions(queryClient));

  const computers = fleet.data?.computers ?? null;
  const isolation = fleet.data?.isolation ?? null;
  /*
   * One line for any failure. A list that could not be read and an action that was refused are both
   * "this did not work", and the page has one place to say so.
   */
  const problem = fleet.error
    ? t("admin-a.computers.listFailed")
    : setState.error
      ? setState.error.message
      : capabilities.error
        ? capabilities.error.message
        : null;

  const run = (botId: string, action: "stop" | "reset") => {
    setBusy(botId);
    setConfirming(null);
    setState.mutate({ action, botId }, { onSettled: () => setBusy(null) });
  };

  if (capabilities.data?.computers === false) {
    return (
      <PageShell description={description} title={title}>
        <PageEmpty>{t("admin-a.computers.off")}</PageEmpty>
      </PageShell>
    );
  }

  return (
    <PageShell description={description} title={title}>
      {problem ? (
        <p
          className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
          role="alert"
        >
          {problem}
        </p>
      ) : null}

      {isolation === "shared" ? (
        <p className="mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <span className="font-medium">
            {t("admin-a.computers.sharedTitle")}
          </span>{" "}
          <InlineCode text={t("admin-a.computers.sharedText")} />
        </p>
      ) : isolation === "per-bot" ? (
        <p className="mt-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-muted-foreground text-sm">
          {t("admin-a.computers.perBot")}
        </p>
      ) : null}

      <PageSection title={t("admin-a.computers.sectionTitle")}>
        {/* The banner above has already said when the list could not be read; nothing here repeats it. */}
        {computers === null ? null : computers.length === 0 ? (
          <PageEmpty>{t("admin-a.computers.empty")}</PageEmpty>
        ) : (
          <PageRows>
            {computers.map((computer, index) => (
              <StaggerItem index={index} key={computer.botId}>
                <Item size="sm">
                  <ItemContent>
                    <ItemTitle title={computer.botId}>
                      {nameFor(computer.botId)}
                    </ItemTitle>
                    <ItemDescription>
                      {computer.running
                        ? t("admin-a.computers.runningSince", {
                            time: formatDateTime(computer.startedAt ?? "", {
                              timeStyle: "short",
                            }),
                          })
                        : t("admin-a.computers.notRunning")}
                      {" · "}
                      {computer.egress === undefined
                        ? t("admin-a.computers.egressUnknown")
                        : computer.egress === null
                          ? t("admin-a.computers.egressDirect")
                          : t("admin-a.computers.egressVia", {
                              egress: computer.egress,
                            })}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      disabled={busy === computer.botId || !computer.running}
                      onClick={() => void run(computer.botId, "stop")}
                      size="sm"
                      variant="outline"
                    >
                      {busy === computer.botId
                        ? t("admin-a.computers.working")
                        : t("admin-a.computers.stopBrowser")}
                    </Button>
                    <Button
                      disabled={busy === computer.botId}
                      onClick={() => setConfirming(computer.botId)}
                      size="sm"
                      variant="outline"
                    >
                      {t("admin-a.computers.reset")}
                    </Button>
                  </ItemActions>
                </Item>
                {index !== computers.length - 1 && <Separator />}
              </StaggerItem>
            ))}
          </PageRows>
        )}
      </PageSection>

      {/*
       * A DIALOG RATHER THAN AN INLINE CONFIRM. Resetting signs a Bot out of everything it has ever
       * logged into and cannot be undone, and the row it was confirmed on was one of several
       * identical-looking rows. The dialog names the Bot, so the sentence somebody agrees to says
       * which computer it destroys.
       */}
      <Dialog
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        open={confirming !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("admin-a.computers.resetTitle", {
                name: confirming ? nameFor(confirming) : "",
              })}
            </DialogTitle>
            <DialogDescription>
              {t("admin-a.computers.resetDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setConfirming(null)}
              size="sm"
              variant="ghost"
            >
              {t("admin-a.computers.cancel")}
            </Button>
            <Button
              disabled={busy === confirming}
              onClick={() => {
                if (confirming) void run(confirming, "reset");
              }}
              size="sm"
              variant="destructive"
            >
              {busy === confirming
                ? t("admin-a.computers.resetting")
                : t("admin-a.computers.resetIt")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Only beside rows that carry the two buttons it explains. */}
      {computers && computers.length > 0 ? (
        <p className="mt-4 text-muted-foreground text-sm">
          <strong>{t("admin-a.computers.helpStop")}</strong>{" "}
          {t("admin-a.computers.helpStopText")}{" "}
          <strong>{t("admin-a.computers.helpReset")}</strong>{" "}
          {t("admin-a.computers.helpResetText")}{" "}
          <Link className="underline" to="/admin/audit">
            {t("admin-a.computers.auditLink")}
          </Link>
          {t("admin-a.computers.helpAfter")}
        </p>
      ) : null}
    </PageShell>
  );
}
