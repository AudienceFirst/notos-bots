// NOTOS: de kaart "Mag deze bot dit doen?" bij een schrijvende tool-call (bouwplan stap 5).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  type Approval,
  approvalQueryOptions,
  decideApprovalMutationOptions,
} from "@/lib/approvals/queries";
import { sayFromCard } from "@/lib/copilot/turn-bus";
import { readToolName } from "@/lib/plugins/tool-name";
import { useT } from "@/i18n";

/** The refusal text a write comes back with when a person has to say yes first. */
export const NEEDS_APPROVAL_PREFIX = "needs_approval:";

export function approvalIdFrom(body: string | undefined): string | null {
  if (!body?.startsWith(NEEDS_APPROVAL_PREFIX)) return null;
  const id = body.slice(NEEDS_APPROVAL_PREFIX.length).split(/\s/, 1)[0];
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

/**
 * One question, two answers, and what happened.
 *
 * The person reads exactly what the Bot wanted to do, with the arguments as sent, and answers here
 * rather than in prose: a "yes" typed into the chat is a message, not a decision, and the gateway
 * only opens for the row this card writes. After a yes the card speaks for the person once, so the
 * Bot retries without anybody typing "go ahead".
 */
export function ApprovalCard({
  id,
  toolName,
}: {
  id: string;
  toolName: string;
}) {
  const queryClient = useQueryClient();
  const approval = useQuery(approvalQueryOptions(id));
  const decide = useMutation(decideApprovalMutationOptions(queryClient));
  const t = useT();
  const { label } = readToolName(toolName);

  const row = decide.data ?? approval.data;
  const busy = decide.isPending;

  const answer = (decision: "granted" | "denied") => {
    decide.mutate(
      { id, decision },
      {
        onSuccess: (decided) => {
          if (decided.decision === "granted") {
            sayFromCard(t("channels.approval-card.goAhead", { label }));
          }
        },
      },
    );
  };

  return (
    <div className="my-2 max-w-xl rounded-lg border bg-muted/40 p-3 text-sm">
      <p className="font-medium">
        {t("channels.approval-card.question", { label })}
      </p>
      {row ? (
        <Arguments args={row.args} />
      ) : approval.isError ? (
        <p className="mt-1 text-muted-foreground">
          {t("channels.approval-card.loadFailed")}
        </p>
      ) : null}
      {row?.decision === "granted" ? (
        <p className="mt-2 text-muted-foreground">
          {row.decidedBy
            ? t("channels.approval-card.approvedBy", { name: row.decidedBy })
            : t("channels.approval-card.approved")}
        </p>
      ) : row?.decision === "denied" ? (
        <p className="mt-2 text-muted-foreground">
          {row.decidedBy
            ? t("channels.approval-card.declinedBy", { name: row.decidedBy })
            : t("channels.approval-card.declined")}
        </p>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button
            disabled={busy || !row}
            onClick={() => answer("granted")}
            size="sm"
          >
            {t("channels.approval-card.yes")}
          </Button>
          <Button
            disabled={busy || !row}
            onClick={() => answer("denied")}
            size="sm"
            variant="outline"
          >
            {t("channels.approval-card.no")}
          </Button>
        </div>
      )}
      {decide.isError ? (
        <p className="mt-2 text-destructive" role="alert">
          {decide.error instanceof Error
            ? decide.error.message
            : t("channels.approval-card.decideFailed")}
        </p>
      ) : null}
    </div>
  );
}

/** The arguments as a short list; a person decides on what is sent, not on a summary of it. */
function Arguments({ args }: { args: Approval["args"] }) {
  const t = useT();
  const entries = Object.entries(args).filter(
    ([, value]) => value !== undefined,
  );
  if (entries.length === 0) {
    return (
      <p className="mt-1 text-muted-foreground">
        {t("channels.approval-card.noDetails")}
      </p>
    );
  }
  return (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      {entries.map(([key, value]) => (
        <div className="contents" key={key}>
          <dt className="text-muted-foreground">{key}</dt>
          <dd className="min-w-0 break-words">
            {typeof value === "string" ? value : JSON.stringify(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
