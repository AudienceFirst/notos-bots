// NOTOS: /mint maakt de rij in `threads` aan; de statuscheck leest dezelfde tabel (stap 0).
import type { MiddlewareHandler } from "hono";
import { isModelProvider } from "../notos/model";
import { Hono } from "hono";
import type { AppVariables } from "../auth/guards";
import type { ThreadIdentity } from "./thread-identity";

/**
 * A thread id for a conversation this deployment keeps no channel for.
 *
 * The direct Bot chat is CopilotKit's own component, and left to itself it generates an id in the
 * browser that says nothing about where the conversation came from. Minting it here puts those
 * threads in the same namespace as every channel's, so one project shared by two deployments can
 * still tell whose conversations are whose.
 *
 * Behind the session guard because a thread id is the name of somewhere a conversation will be
 * stored, and there is no reason for anybody signed out to be handed one.
 */

/**
 * Answers whether this deployment still has a given thread for a given person.
 *
 * Two outcomes only, and deliberately not a third: `"known"` means the thread is there, `"unknown"`
 * means Intelligence has clearly said it is not. A check that failed to get either answer — a
 * timeout, a 5xx, a client that was never configured right — is not a value this type can hold; the
 * function that implements it throws instead, so `GET /:threadId` below can tell "this thread is
 * gone" from "this thread could not be checked" and answer 502 for the second rather than quietly
 * reporting it as gone.
 */
export type ThreadReader = (
  threadId: string,
  userId: string,
) => Promise<"known" | "unknown">;

/**
 * A UUID-shaped string, nothing more. Not the format `thread-identity.ts` mints — this route also
 * has to answer for a thread a *different* deployment minted, or one minted before this deployment
 * had a name, and `identity.owns` is false for both of those without either meaning the thread is
 * gone. The only question this route can honestly ask is Intelligence's own; the shape check exists
 * only to keep a string that could not possibly be a thread id from reaching Intelligence at all.
 */
const PLAUSIBLE_THREAD_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createThreadRoutes(
  identity: ThreadIdentity,
  requireUser: MiddlewareHandler<{ Variables: AppVariables }>,
  /**
   * Absent when this deployment has no way to ask Intelligence about a thread — no client, or a
   * caller that chose not to build one. `GET /:threadId` is then not registered at all, rather than
   * registered and answering 502 to everyone: a route that cannot possibly succeed should not exist.
   * `POST /mint` needs no reader and is unaffected either way.
   */
  readThread?: ThreadReader,
  /**
   * NOTOS: where the minted thread gets its row, with the person who asked as its owner (stap 0).
   * Absent leaves `POST /mint` handing out an id and nothing else, as upstream did.
   */
  threads?: {
    ensure(input: {
      id: string;
      ownerUserId?: string;
      workspaceId?: string;
    }): Promise<void>;
    /** NOTOS: the /bot page's thread carries its own model choice. */
    get?(threadId: string): Promise<{
      ownerUserId: string | null;
      model: { provider: string; location: string; name: string } | null;
    } | null>;
    setModel?(
      threadId: string,
      model: { provider: string; location: string; name: string } | null,
    ): Promise<void>;
  },
  /** NOTOS: whether a keyed provider can run for this actor; absent = accept any. */
  modelAvailable?: (
    actor: AppVariables["actor"],
    provider: string,
  ) => Promise<boolean>,
) {
  const routes = new Hono<{ Variables: AppVariables }>();

  routes.post("/mint", requireUser, async (context) => {
    const threadId = identity.mint();
    await threads?.ensure({
      id: threadId,
      ownerUserId: context.var.actor.id,
      // NOTOS: under /api/w/:workspace the guard put the workspace on the actor (stap 2).
      workspaceId: context.var.actor.workspace?.id,
    });
    return context.json({ threadId });
  });

  if (readThread) {
    /*
     * What this buys the browser: proof, before it sends a single message, that a thread id it
     * remembers from last time is one Intelligence still has. If the answer is no, it can start a
     * fresh thread knowing there is provably nothing left in the old one to lose. Without this route
     * that is not what happens — the browser sends anyway, Intelligence silently starts a new, empty
     * thread under the remembered id, and the person is answered as though the conversation were new
     * with nothing on screen to say their history is gone.
     */
    routes.get("/:threadId", requireUser, async (context) => {
      const threadId = context.req.param("threadId");
      if (!PLAUSIBLE_THREAD_ID.test(threadId)) {
        return context.json({ error: "Not a thread id." }, 400);
      }

      try {
        const status = await readThread(threadId, context.var.actor.id);
        const thread = await threads?.get?.(threadId).catch(() => null);
        return context.json({
          known: status === "known",
          model: thread?.model ?? null,
        });
      } catch {
        // The reader throws for everything short of a clean known/unknown answer, and what it threw
        // may name an upstream host or otherwise be unfit for a browser to see, so only its kind is
        // logged, not its content. The browser gets "the check failed", which is exactly as much as
        // it is owed: enough to know not to trust `known: false`, nothing that was not already true
        // before this request.
        console.error(
          JSON.stringify({
            type: "thread-status-check-failed",
            note: "Could not determine whether Intelligence still has this thread.",
          }),
        );
        return context.json({ error: "Could not check thread status." }, 502);
      }
    });
  }

  if (threads?.setModel && threads.get) {
    const read = threads.get;
    const write = threads.setModel;
    routes.put("/:threadId/model", requireUser, async (context) => {
      const threadId = context.req.param("threadId");
      if (!PLAUSIBLE_THREAD_ID.test(threadId)) {
        return context.json({ error: "Not a thread id." }, 400);
      }
      const thread = await read(threadId);
      if (!thread || thread.ownerUserId !== context.var.actor.id) {
        return context.json({ error: "Not your thread." }, 404);
      }
      const body = (await context.req.json().catch(() => null)) as {
        model?: unknown;
      } | null;
      const given = body?.model as
        | { provider?: unknown; location?: unknown; name?: unknown }
        | null
        | undefined;
      let choice: { provider: string; location: string; name: string } | null =
        null;
      if (given) {
        if (!isModelProvider(given.provider)) {
          return context.json({ error: "That is not a model provider." }, 400);
        }
        const name = typeof given.name === "string" ? given.name.trim() : "";
        if (!name) return context.json({ error: "Name a model." }, 400);
        const location =
          typeof given.location === "string" ? given.location.trim() : "";
        if (
          given.provider === "vertex" &&
          !["europe-west4", "global"].includes(location)
        ) {
          return context.json(
            { error: "A Vertex model runs in europe-west4 or global." },
            400,
          );
        }
        if (
          modelAvailable &&
          !(await modelAvailable(context.var.actor, given.provider))
        ) {
          return context.json(
            {
              error:
                "No key for that provider is reachable here, so it cannot run.",
            },
            409,
          );
        }
        choice = {
          provider: given.provider,
          name,
          location: given.provider === "vertex" ? location : "",
        };
      }
      await write(threadId, choice);
      return context.json({ model: choice });
    });
  }
  return routes;
}
