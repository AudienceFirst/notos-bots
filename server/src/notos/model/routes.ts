// NOTOS: welke modellen hier kunnen werken, voor de kiezer in een gesprek (Mitch, 5 september 2026).
import { Hono, type MiddlewareHandler } from "hono";
import type { AppVariables } from "../../auth/guards";
import type { WorkspaceStore } from "../workspaces/store";
import type { ModelKeyStore } from "./keys";
import {
  KEYED_PROVIDERS,
  type ModelProvider,
  MODEL_PROVIDERS,
} from "./providers";

/** The little an availability check needs of an actor: which workspace the request is in. */
export type ActorScope = { workspace?: { id: string } | null | undefined };

/**
 * Whether a provider can run for this actor's workspace: Vertex always (the server's own Google
 * credentials); a keyed provider only when a key is reachable in scope, which is the person's own
 * key in their personal space, the workspace's, or the deployment's. The list the browser shows is
 * built from exactly this answer, and the same check guards the PUT, so a choice never breaks a run.
 */
export function createModelAvailability(
  keys: ModelKeyStore,
  workspaces: WorkspaceStore,
) {
  return async (actor: ActorScope, provider: string): Promise<boolean> => {
    if (provider === "vertex") return true;
    if (!(MODEL_PROVIDERS as readonly string[]).includes(provider))
      return false;
    const workspaceId = actor.workspace?.id ?? null;
    const workspace = workspaceId ? await workspaces.byId(workspaceId) : null;
    return (
      keys.resolve(provider as Exclude<ModelProvider, "vertex">, {
        workspaceId,
        personalOwnerId: workspace?.personalOwnerId ?? null,
      }) !== null
    );
  };
}

export function createModelRoutes(
  guard: MiddlewareHandler<{ Variables: AppVariables }>,
  keys: ModelKeyStore,
  workspaces: WorkspaceStore,
) {
  const available = createModelAvailability(keys, workspaces);
  const routes = new Hono<{ Variables: AppVariables }>();
  routes.use("*", guard);

  routes.get("/available", async (context) => {
    const actor = context.var.actor;
    const providers: Record<string, boolean> = { vertex: true };
    for (const provider of KEYED_PROVIDERS) {
      providers[provider] = await available(actor, provider);
    }
    const workspace = actor.workspace
      ? await workspaces.byId(actor.workspace.id)
      : null;
    return context.json({
      providers,
      workspaceDefault: workspace
        ? {
            provider: workspace.modelProvider,
            location: workspace.vertexLocation,
            name: workspace.defaultModel,
          }
        : null,
    });
  });

  return routes;
}
