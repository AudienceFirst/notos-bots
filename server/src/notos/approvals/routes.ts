// NOTOS: routes waarmee een mens ja of nee zegt tegen een schrijvende tool-call (stap 5).
import { Hono, type MiddlewareHandler } from "hono";
import type { AppVariables } from "../../auth/guards";
import { type AuditStore, recordAuditEvent } from "../../audit";
import type { ApprovalStore } from "./store";

/**
 * Who may say yes: anybody from ZUID in the workspace, and a client's lead. A specialist or a viewer
 * sees the card and gets a 403 on the button; the rule lives here and not in the interface, because
 * the interface is not what the gateway trusts.
 */
export function mayDecide(role: string | undefined): boolean {
  return role === "zuid" || role === "lead";
}

export function createApprovalRoutes(
  approvals: ApprovalStore,
  guard: MiddlewareHandler<{ Variables: AppVariables }>,
  auditStore?: AuditStore,
) {
  const routes = new Hono<{ Variables: AppVariables }>();
  routes.use("*", guard);

  const ownRow = async (
    context: Parameters<MiddlewareHandler<{ Variables: AppVariables }>>[0],
  ) => {
    const row = await approvals.get(context.req.param("id") ?? "");
    const workspace = context.var.actor.workspace;
    // Only the row's own workspace answers; a row from before the workspaces is ZUID's.
    if (!row) return null;
    if (row.workspaceId === null)
      return context.var.actor.isInternal ? row : null;
    return workspace && workspace.id === row.workspaceId ? row : null;
  };

  routes.get("/", async (context) => {
    const workspace = context.var.actor.workspace;
    if (!workspace) return context.json({ approvals: [] });
    const threadId = context.req.query("threadId");
    return context.json({
      approvals: await approvals.listOpen(workspace.id, threadId || undefined),
    });
  });

  routes.get("/:id", async (context) => {
    const row = await ownRow(context);
    if (!row) return context.json({ error: "No such approval." }, 404);
    return context.json(row);
  });

  routes.post("/:id/decide", async (context) => {
    const row = await ownRow(context);
    if (!row) return context.json({ error: "No such approval." }, 404);
    const role = context.var.actor.workspace?.role;
    if (!mayDecide(role)) {
      return context.json(
        {
          error:
            "Only somebody from ZUID or the client's lead can approve this.",
        },
        403,
      );
    }
    const body = (await context.req.json().catch(() => null)) as {
      decision?: unknown;
    } | null;
    const decision = body?.decision;
    if (decision !== "granted" && decision !== "denied") {
      return context.json(
        { error: "A decision of granted or denied is required." },
        400,
      );
    }
    // The address, for the card ("Approved by mitch@zuid.com"); the audit row keeps the id.
    const decidedBy = context.var.actor.email || context.var.actor.id;
    const decided = await approvals.decide(row.id, decision, decidedBy);
    if (!decided) return context.json({ error: "No such approval." }, 404);
    if (
      auditStore &&
      decided.decision === decision &&
      decided.decidedBy === decidedBy
    ) {
      await recordAuditEvent(auditStore, {
        eventType:
          decision === "granted" ? "approval.granted" : "approval.denied",
        targetType: "approval",
        targetId: decided.id,
        actorUserId: context.var.actor.id,
        payload: {
          bot: decided.botId,
          tool: decided.toolRef,
          approval: decided.id,
          ...(decided.workspaceId ? { workspace: decided.workspaceId } : {}),
        },
      });
    }
    return context.json(decided);
  });

  return routes;
}
