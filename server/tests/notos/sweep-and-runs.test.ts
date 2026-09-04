// NOTOS: de sweep als endpoint en één beurt van buitenaf (bouwplan stap 9).
import { describe, expect, test } from "bun:test";
import type { MiddlewareHandler } from "hono";
import { Hono } from "hono";
import type { AgentActor } from "../../src/agents/profile-types";
import type { AppVariables } from "../../src/auth/guards";
import type { AgentChannel, ChannelStore } from "../../src/channels/routes";
import { createRunsRoutes } from "../../src/notos/routines/runs-route";
import {
  createSweepCallerVerifier,
  createSweepRoutes,
} from "../../src/notos/routines/sweep-route";

const SERVICE = "notos-worker@mge-zuid.iam.gserviceaccount.com";

function verifier(
  verify: (token: string) => Promise<{ email?: string } | null>,
) {
  return createSweepCallerVerifier({
    sharedSecret: "worker-secret",
    audiences: ["https://bots.example"],
    serviceAccounts: [SERVICE],
    verify,
  });
}

describe("who may ask for a sweep", () => {
  test("the worker secret, or a known service account's identity token; nothing else", async () => {
    const check = verifier(async (token) =>
      token === "good"
        ? { email: SERVICE }
        : token === "other"
          ? { email: "x@y" }
          : null,
    );
    expect(await check(undefined)).toEqual({
      ok: false,
      reason: "missing-header",
    });
    expect(await check("Bearer worker-secret")).toEqual({
      ok: true,
      as: "worker-secret",
    });
    expect(await check("Bearer good")).toEqual({ ok: true, as: SERVICE });
    expect((await check("Bearer other")).ok).toBe(false);
    expect((await check("Bearer nonsense")).ok).toBe(false);
  });

  test("the endpoint answers 401 without a caller and the report with one", async () => {
    const refused: string[] = [];
    let sweeps = 0;
    const app = new Hono<{ Variables: AppVariables }>();
    app.route(
      "/",
      createSweepRoutes({
        run: async () => {
          sweeps += 1;
          return { considered: 2, offered: 1, dispatched: 1, fired: ["r1"] };
        },
        verifyCaller: verifier(async () => null),
        audit: async (event) => {
          if (event.eventType === "routines.dispatch_refused") {
            refused.push(String(event.payload.reason));
          }
        },
      }),
    );
    const anonymous = await app.request("http://x/internal/routines/sweep", {
      method: "POST",
    });
    expect(anonymous.status).toBe(401);
    expect(sweeps).toBe(0);
    expect(refused).toEqual(["missing-header"]);

    const withSecret = await app.request("http://x/internal/routines/sweep", {
      method: "POST",
      headers: { authorization: "Bearer worker-secret" },
    });
    expect(withSecret.status).toBe(200);
    expect(await withSecret.json()).toEqual({
      considered: 2,
      offered: 1,
      dispatched: 1,
      fired: ["r1"],
    });
    expect(sweeps).toBe(1);
  });
});

describe("one turn from outside", () => {
  const actor: AgentActor = {
    id: "person_1",
    email: "p@zuid.com",
    role: "user",
    isInternal: true,
    workspace: { id: "w1", slug: "zuid", role: "zuid" },
  } as AgentActor;
  const channel: AgentChannel = {
    id: "channel_direct",
    agentIds: ["zuid--sea-specialist"],
    threadId: "thread_direct",
  } as AgentChannel;
  const turns: { agentId: string; threadId: string; instruction: string }[] =
    [];
  const channelStore = {
    direct: async () => channel,
    get: async (_actor: AgentActor, id: string) =>
      id === channel.id ? channel : null,
  } as unknown as ChannelStore;
  const asPerson: MiddlewareHandler<{ Variables: AppVariables }> = async (
    context,
    next,
  ) => {
    context.set("actor", actor);
    await next();
  };
  const app = new Hono<{ Variables: AppVariables }>();
  app.route(
    "/bots",
    createRunsRoutes({
      channelStore,
      guard: asPerson,
      botVisible: async (_actor, botId) => botId === "zuid--sea-specialist",
      runTurn: async (input) => {
        turns.push(input);
        return { replyText: `done: ${input.instruction}` };
      },
    }),
  );

  test("a prompt to a visible Bot runs one turn in the caller's direct channel", async () => {
    const response = await app.request(
      "http://x/bots/zuid--sea-specialist/runs",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Wat is de CPA van vorige week?" }),
      },
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      channelId: "channel_direct",
      threadId: "thread_direct",
      reply: "done: Wat is de CPA van vorige week?",
    });
    expect(turns).toHaveLength(1);
    expect(turns[0]?.threadId).toBe("thread_direct");
  });

  test("an unknown Bot, an empty prompt and a foreign channel are refused", async () => {
    const unknown = await app.request("http://x/bots/zuid--nobody/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "x" }),
    });
    expect(unknown.status).toBe(404);
    const empty = await app.request("http://x/bots/zuid--sea-specialist/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "   " }),
    });
    expect(empty.status).toBe(400);
    const foreign = await app.request(
      "http://x/bots/zuid--sea-specialist/runs",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "x", channelId: "channel_other" }),
      },
    );
    expect(foreign.status).toBe(404);
    expect(turns).toHaveLength(1);
  });
});
