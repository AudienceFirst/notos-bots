/**
 * `requireWorkspace`: de `:workspace` uit het pad moet er een zijn waar deze persoon in mag.
 *
 * Achter `requireUser`, want het leest de actor. Bij een treffer krijgt de actor de workspace
 * mee (`actor.workspace`), en daar filtert elke store op. Buiten de set: 403, met één zin die
 * niets verraadt over welke workspaces wel bestaan.
 */
import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "../../auth/guards";
import type { WorkspaceStore } from "./store";

export const NO_ACCESS = "geen toegang tot deze workspace";

export function createRequireWorkspace(
  store: WorkspaceStore,
): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (context, next) => {
    const slug = context.req.param("workspace");
    if (!slug) return context.json({ error: NO_ACCESS }, 403);
    const found = await store.membership(context.var.actor, slug);
    if (!found) return context.json({ error: NO_ACCESS }, 403);
    context.set("actor", {
      ...context.var.actor,
      workspace: {
        id: found.workspace.id,
        slug: found.workspace.slug,
        role: found.role,
      },
    });
    await next();
  };
}
