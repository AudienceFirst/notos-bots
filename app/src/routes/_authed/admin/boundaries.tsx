import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { InlineCode } from "@/components/admin/inline-code";
import {
  PageEmpty,
  PageSection,
  PageShell,
} from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime, useT } from "@/i18n";
import { saveActionPolicyMutationOptions } from "@/lib/computers/mutations";
import {
  type ActionPolicy,
  actionPolicyQueryOptions,
  type DryRunReport,
  dryRunActionPolicy,
  type PolicyMode,
} from "@/lib/computers/queries";
import { deploymentCapabilitiesQueryOptions } from "@/lib/deployment/queries";
import { queryClient } from "@/query-client";

/**
 * CEL computer-action boundary editor. Rules are shown as the gateway evaluates them, and denied
 * actions are recorded in Audit with the matching rule.
 */

/**
 * Presets are concrete CEL rules, not a separate policy language. The label and the cost are
 * dictionary keys, translated where the preset is drawn.
 */
const PRESETS: { labelKey: string; rule: string; costKey?: string }[] = [
  {
    labelKey: "admin-a.boundaries.presetNoSubmitLabel",
    // `key` is guarded by tool name so the clause short-circuits before it on actions that have no
    // keypress in them. Both tools that can press Enter are named: `computer_type` takes a `submit`
    // flag that presses it once the text is in, and a rule naming only `computer_key` left that door
    // open.
    rule: '(intent == "activate" && contains(element.name, "submit")) || ((tool.name == "computer_key" || tool.name == "computer_type") && key == "Enter")',
    costKey: "admin-a.boundaries.presetNoSubmitCost",
  },
  {
    labelKey: "admin-a.boundaries.presetNoPasswordLabel",
    rule: 'intent == "type" && contains(element.name, "password")',
    costKey: "admin-a.boundaries.presetNoPasswordCost",
  },
  {
    labelKey: "admin-a.boundaries.presetNoSocialLabel",
    rule: 'intent == "navigate" && (contains(page.host, "facebook.com") || contains(page.host, "x.com"))',
    costKey: "admin-a.boundaries.presetNoSocialCost",
  },
];

export const Route = createFileRoute("/_authed/admin/boundaries")({
  component: BoundariesPage,
});

function BoundariesPage() {
  const t = useT();
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState("");

  const [tested, setTested] = useState<{
    rule: string;
    report: DryRunReport;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  /*
   * NOTOS: whether Bots have computers at all. Without them there is no policy route, and asking
   * for one is a 404 dressed as a failure; the page says the plain thing instead, and does not ask
   * until the answer is in.
   */
  const capabilities = useQuery(deploymentCapabilitiesQueryOptions());
  const computersOn = capabilities.data?.computers === true;
  const stored = useQuery({
    ...actionPolicyQueryOptions(),
    enabled: computersOn,
  });
  const savePolicy = useMutation(saveActionPolicyMutationOptions(queryClient));

  /*
   * The saved policy wins while a save is in flight and after it lands: the server normalises what
   * it stores, so what came back is the policy, not what was sent.
   */
  const policy = savePolicy.data ?? stored.data ?? null;
  const saving = savePolicy.isPending;

  const save = (next: ActionPolicy) => {
    setSaved(false);
    setProblem(null);
    savePolicy.mutate(next, {
      onError: (thrown: Error) => setProblem(thrown.message),
      onSuccess: () => setSaved(true),
    });
  };

  /* The same sentence in every state, so the page never loses what it is for. */
  const title = t("admin-a.boundaries.title");
  const description = (
    <>
      {t("admin-a.boundaries.descriptionBefore")}{" "}
      <Link className="underline" to="/admin/audit">
        {t("admin-a.boundaries.auditLink")}
      </Link>{" "}
      {t("admin-a.boundaries.descriptionAfter")}
    </>
  );

  if (capabilities.data?.computers === false) {
    return (
      <PageShell description={description} title={title}>
        <PageEmpty>{t("admin-a.boundaries.computersOff")}</PageEmpty>
      </PageShell>
    );
  }

  /*
   * A read that failed is shown the same way as a save that failed. It used to be dropped, which
   * left the page blank under its heading with the reason sitting unread in the query.
   */
  const failure =
    problem ?? stored.error?.message ?? capabilities.error?.message ?? null;

  if (failure && !policy) {
    return (
      <PageShell description={description} title={title}>
        <p className="mt-4 text-destructive text-sm" role="alert">
          {failure}
        </p>
      </PageShell>
    );
  }

  /* Nothing until the policy is known: a rule list that guesses is worse than a blank. */
  if (!policy) {
    return (
      <PageShell description={description} title={title}>
        {null}
      </PageShell>
    );
  }

  const addRule = (rule: string) => {
    const trimmed = rule.trim();
    if (!trimmed || policy.deny.includes(trimmed)) return;
    void save({ ...policy, deny: [...policy.deny, trimmed] });
    setDraft("");
    setTested(null);
  };

  /*
   * The rule as it would be in force — the current policy plus this draft — replayed over recent
   * recorded actions. Nothing is saved and nothing is decided; the reply names the actions the
   * addition would have decided differently, so the rule's real reach is known before it starts
   * refusing anybody.
   */
  const testRule = async (rule: string) => {
    const trimmed = rule.trim();
    if (!trimmed) return;
    setProblem(null);
    setTesting(true);
    try {
      const report = await dryRunActionPolicy({
        ...policy,
        deny: [...policy.deny, trimmed],
      });
      setTested({ rule: trimmed, report });
    } catch (thrown) {
      setProblem((thrown as Error).message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <PageShell description={description} title={title}>
      {/*
       * NOTOS (stap 5): what every workspace runs on before anybody writes rules here. The rules
       * below are the deployment's own, for the computer and for Bots from before the workspaces.
       */}
      <PageSection
        description={t("admin-a.boundaries.workspacesDescription")}
        title={t("admin-a.boundaries.workspacesTitle")}
      >
        <pre className="mt-3 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs">
          deny: mcp.effect == &apos;write&apos; &amp;&amp; !approval.granted
        </pre>
      </PageSection>
      <PageSection
        description={t("admin-a.boundaries.modeDescription")}
        title={t("admin-a.boundaries.modeTitle")}
      >
        <div className="mt-2 flex gap-2">
          {(["enforce", "dry-run"] as PolicyMode[]).map((mode) => (
            <Button
              key={mode}
              aria-pressed={policy.mode === mode}
              className={policy.mode === mode ? "bg-foreground/5" : undefined}
              disabled={saving}
              onClick={() => void save({ ...policy, mode })}
              size="sm"
              variant="outline"
            >
              {mode === "enforce"
                ? t("admin-a.boundaries.modeEnforce")
                : t("admin-a.boundaries.modeDryRun")}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {policy.mode === "enforce"
            ? t("admin-a.boundaries.modeEnforceNote")
            : t("admin-a.boundaries.modeDryRunNote")}
        </p>
      </PageSection>

      <PageSection
        description={
          <InlineCode text={t("admin-a.boundaries.denyDescription")} />
        }
        title={t("admin-a.boundaries.denyTitle")}
      >
        {policy.deny.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("admin-a.boundaries.noRules")}
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-md border border-border">
            {policy.deny.map((rule) => (
              <li
                className="flex items-center justify-between gap-4 px-3 py-2"
                key={rule}
              >
                <code className="min-w-0 break-all font-mono text-xs">
                  {rule}
                </code>
                <Button
                  disabled={saving}
                  onClick={() =>
                    void save({
                      ...policy,
                      deny: policy.deny.filter((one) => one !== rule),
                    })
                  }
                  size="sm"
                  variant="ghost"
                >
                  {t("admin-a.boundaries.remove")}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex gap-2">
          <Input
            aria-label={t("admin-a.boundaries.ruleAriaLabel")}
            className="min-w-0 flex-1 font-mono text-xs"
            onChange={(event) => {
              setDraft(event.target.value);
              setSaved(false);
              setTested(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") addRule(draft);
            }}
            /* A CEL example, the same in every language. */
            placeholder='tool.name == "computer_click" && contains(element.name, "submit")'
            value={draft}
          />
          <Button
            disabled={testing || draft.trim().length === 0}
            onClick={() => void testRule(draft)}
            size="sm"
            variant="outline"
          >
            {testing
              ? t("admin-a.boundaries.testing")
              : t("admin-a.boundaries.testFirst")}
          </Button>
          <Button
            disabled={saving || draft.trim().length === 0}
            onClick={() => addRule(draft)}
            size="sm"
          >
            {t("admin-a.boundaries.addRule")}
          </Button>
        </div>

        {tested ? <DryRunResult report={tested.report} /> : null}

        <ul className="mt-3 space-y-2">
          {PRESETS.map((preset) => (
            <li className="flex items-start gap-3" key={preset.rule}>
              <Button
                className="shrink-0"
                disabled={saving || policy.deny.includes(preset.rule)}
                onClick={() => addRule(preset.rule)}
                size="sm"
                variant="outline"
              >
                {t(preset.labelKey)}
              </Button>
              {preset.costKey ? (
                <span className="pt-1 text-xs text-muted-foreground">
                  {t(preset.costKey)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </PageSection>

      <PageSection
        description={t("admin-a.boundaries.allowDescription")}
        title={t("admin-a.boundaries.allowTitle")}
      >
        <ul className="mt-2 space-y-1">
          {policy.allow.map((rule) => (
            <li className="font-mono text-xs text-muted-foreground" key={rule}>
              {rule === "true" ? t("admin-a.boundaries.allowTrue") : rule}
            </li>
          ))}
        </ul>
      </PageSection>

      <p className="mt-8 text-muted-foreground text-xs">
        {problem ? (
          <span className="text-destructive" role="alert">
            {problem}
          </span>
        ) : saved ? (
          t("admin-a.boundaries.saved")
        ) : (
          t("admin-a.boundaries.unsavedNote")
        )}
      </p>
    </PageShell>
  );
}

/**
 * What the tested rule would have done to actions already on the trail.
 *
 * Says the number over everything scanned first, because the list below it is capped and a reader
 * who stops at the rows should not believe the rows are the whole answer.
 */
function DryRunResult({ report }: { report: DryRunReport }) {
  const t = useT();
  if (report.scanned === 0) {
    return (
      <p className="mt-2 text-xs text-muted-foreground" role="status">
        {t("admin-a.boundaries.noActions")}
      </p>
    );
  }

  return (
    <div className="mt-2" role="status">
      <p className="text-xs text-muted-foreground">
        {report.wouldRefuse === 0
          ? t("admin-a.boundaries.testedNone", { scanned: report.scanned })
          : t("admin-a.boundaries.testedSome", {
              scanned: report.scanned,
              wouldRefuse: report.wouldRefuse,
            })}
      </p>
      {report.changes.length > 0 ? (
        <ul className="mt-2 divide-y divide-border rounded-md border border-border">
          {report.changes.map((change) => (
            <li className="px-3 py-2" key={change.id}>
              <p className="text-xs">
                <span className="font-medium">
                  {change.would === "refused"
                    ? t("admin-a.boundaries.wouldRefuse")
                    : t("admin-a.boundaries.wouldAllow")}
                </span>{" "}
                <code className="font-mono">{change.action}</code>
                {change.element?.name ? (
                  <>
                    {" "}
                    {t("admin-a.boundaries.onElement", {
                      name: change.element.name,
                    })}
                  </>
                ) : null}
                {change.command ? (
                  <>
                    {" "}
                    {t("admin-a.boundaries.running")}{" "}
                    <code className="font-mono">{change.command}</code>
                  </>
                ) : null}
                {change.file ? (
                  <>
                    {" "}
                    {t("admin-a.boundaries.touching", { file: change.file })}
                  </>
                ) : null}
              </p>
              <p className="mt-0.5 text-muted-foreground text-xs">
                {change.bot}
                {change.page ? <> · {change.page}</> : null} ·{" "}
                {formatDateTime(change.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {report.wouldRefuse > report.changes.length ? (
        <p className="mt-1 text-muted-foreground text-xs">
          {t("admin-a.boundaries.showingFirst", {
            count: report.changes.length,
          })}
        </p>
      ) : null}
    </div>
  );
}
