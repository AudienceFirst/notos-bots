// NOTOS: campagnes per workspace: lijst, aanmaken, brief en status (Mitch, 5 september 2026).
import { Hono, type MiddlewareHandler } from "hono";
import type { AppVariables } from "../../auth/guards";
import { type AuditStore, recordAuditEvent } from "../../audit";
import { CampaignRefusedError, type CampaignStore } from "./store";

/** Who may make or change a campaign: ZUID, and the client's lead. Viewers and specialists read. */
const mayManage = (role: string | undefined) =>
  role === "zuid" || role === "lead";

export function createCampaignRoutes(
  store: CampaignStore,
  guard: MiddlewareHandler<{ Variables: AppVariables }>,
  auditStore?: AuditStore,
) {
  const routes = new Hono<{ Variables: AppVariables }>();
  routes.use("*", guard);

  routes.get("/", async (context) => {
    const workspace = context.var.actor.workspace;
    if (!workspace) return context.json({ campaigns: [] });
    const includeArchived = context.req.query("archived") === "1";
    return context.json({
      campaigns: await store.list(workspace.id, includeArchived),
    });
  });

  routes.get("/:id", async (context) => {
    const workspace = context.var.actor.workspace;
    if (!workspace) return context.json({ error: "No such campaign." }, 404);
    const campaign = await store.get(workspace.id, context.req.param("id"));
    if (!campaign) return context.json({ error: "No such campaign." }, 404);
    return context.json({ campaign });
  });

  routes.post("/", async (context) => {
    const workspace = context.var.actor.workspace;
    if (!workspace) return context.json({ error: "No workspace." }, 400);
    if (!mayManage(workspace.role)) {
      return context.json(
        {
          error:
            "Only somebody from ZUID or the client's lead can start a campaign.",
        },
        403,
      );
    }
    const body = (await context.req.json().catch(() => null)) as {
      name?: unknown;
      brief?: unknown;
    } | null;
    if (typeof body?.name !== "string") {
      return context.json({ error: "A name is required." }, 400);
    }
    try {
      const campaign = await store.create({
        workspaceId: workspace.id,
        name: body.name,
        ...(typeof body.brief === "string" ? { brief: body.brief } : {}),
        createdBy: context.var.actor.id,
      });
      if (auditStore) {
        await recordAuditEvent(auditStore, {
          actorUserId: context.var.actor.id,
          eventType: "configuration.changed",
          targetType: "campaign",
          targetId: campaign.id,
          payload: {
            setting: "campaign.created",
            workspace: workspace.id,
            name: campaign.name,
          },
        }).catch(() => undefined);
      }
      return context.json({ campaign }, 201);
    } catch (error) {
      if (error instanceof CampaignRefusedError) {
        return context.json({ error: error.message }, 400);
      }
      throw error;
    }
  });

  routes.put("/:id", async (context) => {
    const workspace = context.var.actor.workspace;
    if (!workspace) return context.json({ error: "No such campaign." }, 404);
    if (!mayManage(workspace.role)) {
      return context.json(
        {
          error:
            "Only somebody from ZUID or the client's lead can change a campaign.",
        },
        403,
      );
    }
    const body = (await context.req.json().catch(() => null)) as {
      name?: unknown;
      brief?: unknown;
      status?: unknown;
    } | null;
    const patch: {
      name?: string;
      brief?: string;
      status?: "active" | "archived";
    } = {};
    if (typeof body?.name === "string") patch.name = body.name;
    if (typeof body?.brief === "string") patch.brief = body.brief;
    if (body?.status === "active" || body?.status === "archived") {
      patch.status = body.status;
    }
    try {
      const campaign = await store.update(
        workspace.id,
        context.req.param("id"),
        patch,
      );
      if (!campaign) return context.json({ error: "No such campaign." }, 404);
      if (auditStore) {
        await recordAuditEvent(auditStore, {
          actorUserId: context.var.actor.id,
          eventType: "configuration.changed",
          targetType: "campaign",
          targetId: campaign.id,
          payload: {
            setting: "campaign.updated",
            workspace: workspace.id,
            fields: Object.keys(patch),
          },
        }).catch(() => undefined);
      }
      return context.json({ campaign });
    } catch (error) {
      if (error instanceof CampaignRefusedError) {
        return context.json({ error: error.message }, 400);
      }
      throw error;
    }
  });

  return routes;
}
