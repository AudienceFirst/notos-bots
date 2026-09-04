// NOTOS: één beurt van een bot starten van buitenaf: n8n, een knop in NOTOS, een andere bot (stap 9).
/*
 * The same door for everybody: the caller is a person (a NOTOS token, a service user for n8n) in a
 * workspace, the Bot is one of that workspace's, and the turn runs exactly as a routine's does —
 * as the caller, in the caller's own channel with that Bot, through the same TurnRunner, the same
 * gateway and the same approvals. Nothing here bypasses anything; it only starts a turn.
 */
import { Hono, type MiddlewareHandler } from "hono";
import type { AgentActor } from "../../agents/profile-types";
import type { AppVariables } from "../../auth/guards";
import type { ChannelStore } from "../../channels/routes";
import type { TurnRunner } from "../../routines/runner";

const MAX_PROMPT = 8_000;

export function createRunsRoutes(options: {
  channelStore: ChannelStore;
  runTurn: TurnRunner;
  guard: MiddlewareHandler<{ Variables: AppVariables }>;
  /** Whether this Bot is one the actor may talk to in this workspace. */
  botVisible: (actor: AgentActor, botId: string) => Promise<boolean>;
}) {
  const routes = new Hono<{ Variables: AppVariables }>();
  routes.use("*", options.guard);

  routes.post("/:bot/runs", async (context) => {
    const actor = context.var.actor as AgentActor;
    const botId = context.req.param("bot");
    if (!(await options.botVisible(actor, botId))) {
      return context.json({ error: "No such Bot in this workspace." }, 404);
    }
    const body = (await context.req.json().catch(() => null)) as {
      prompt?: unknown;
      channelId?: unknown;
    } | null;
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return context.json({ error: "A prompt is required." }, 400);
    if (prompt.length > MAX_PROMPT) {
      return context.json(
        { error: `A prompt is at most ${MAX_PROMPT} characters.` },
        400,
      );
    }

    const channel =
      typeof body?.channelId === "string" && body.channelId
        ? await options.channelStore.get(actor, body.channelId)
        : await options.channelStore.direct(actor, botId);
    if (!channel?.agentIds.includes(botId)) {
      return context.json(
        { error: "No such channel with this Bot for you." },
        404,
      );
    }

    const { replyText } = await options.runTurn({
      ownerUserId: actor.id,
      agentId: botId,
      threadId: channel.threadId,
      instruction: prompt,
    });
    return context.json(
      {
        channelId: channel.id,
        threadId: channel.threadId,
        reply: replyText,
      },
      201,
    );
  });

  return routes;
}
