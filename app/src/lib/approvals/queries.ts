// NOTOS: goedkeuringen voor schrijvende tool-calls (bouwplan stap 5).
import {
  mutationOptions,
  type QueryClient,
  queryOptions,
} from "@tanstack/react-query";
import { client } from "@/lib/client";
import { tr } from "@/i18n";

export type ApprovalDecision = "granted" | "denied";

/** One write a Bot wanted to do, as the server tells it. */
export type Approval = {
  id: string;
  workspaceId: string | null;
  threadId: string | null;
  botId: string;
  /** `<server>/<tool>`. */
  toolRef: string;
  args: Record<string, unknown>;
  requestedByActor: string | null;
  decidedBy: string | null;
  decision: ApprovalDecision | null;
  createdAt: string;
  decidedAt: string | null;
  usedAt: string | null;
};

export const approvalKeys = {
  all: ["approvals"] as const,
  one: (id: string) => ["approvals", id] as const,
};

export function approvalQueryOptions(id: string) {
  return queryOptions({
    queryKey: approvalKeys.one(id),
    queryFn: async (): Promise<Approval> => {
      const response = await client(`/api/approvals/${id}`, {
        fallback: tr("lib.approvals.loadFailed"),
      });
      return (await response.json()) as Approval;
    },
  });
}

export function decideApprovalMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (input: {
      id: string;
      decision: ApprovalDecision;
    }): Promise<Approval> => {
      const response = await client(`/api/approvals/${input.id}/decide`, {
        method: "POST",
        body: { decision: input.decision },
        fallback: tr("lib.approvals.decideFailed"),
      });
      return (await response.json()) as Approval;
    },
    onSuccess: (approval) => {
      queryClient.setQueryData(approvalKeys.one(approval.id), approval);
    },
  });
}
