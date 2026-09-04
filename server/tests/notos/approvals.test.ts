// NOTOS: schrijven alleen na een mens (bouwplan stap 5).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { Hono } from "hono";
import { createAuditStore } from "../../src/audit";
import type { AppVariables } from "../../src/auth/guards";
import { createDatabase } from "../../src/db/client";
import {
  agents,
  auditEvents,
  deploymentPackages,
  mcpServers,
  mcpTools,
} from "../../src/db/schema";
import { approvals } from "../../src/db/schema/approvals";
import { createApprovalStore, hashArgs } from "../../src/notos/approvals";
import { createApprovalRoutes } from "../../src/notos/approvals/routes";
import { DEFAULT_WORKSPACE_POLICY } from "../../src/notos/policy";
import { createPluginStore, PluginRefusedError } from "../../src/plugins/store";
import { TEST_POOL } from "../support/database";

const database = createDatabase(
  process.env.DATABASE_URL ??
    "postgres://openbot:openbot@localhost:5432/openbot",
  TEST_POOL,
);

const suite = randomUUID().slice(0, 8);
const botId = `agent_approvals_${suite}`;
const serverId = "routines";
const writeRef = `${serverId}/create_routine`;
const readRef = `${serverId}/list_routines`;
const ARGS = { instruction: `Post the summary ${suite}`, cron: "0 9 * * 1-5" };

const approvalStore = createApprovalStore(database);
const vendorCalls: string[] = [];

const store = createPluginStore({
  database,
  auditStore: createAuditStore(database),
  credentials: {
    readSecret: async () => null,
    create: async () => {
      throw new Error("this suite does not write credentials");
    },
    updateSecret: async () => {
      throw new Error("this suite does not write credentials");
    },
    revoke: async () => new Date(),
  },
  encryptionKey: "x".repeat(44),
  policy: () => DEFAULT_WORKSPACE_POLICY,
  approvals: approvalStore,
  workspaceOf: async () => workspaceId,
  callVendor: async (_connection, toolName) => {
    vendorCalls.push(toolName);
    return { text: `${toolName} done`, isError: false };
  },
});

let workspaceId = "";

beforeAll(async () => {
  const [workspace] = await database
    .insert(deploymentPackages)
    .values({
      tenantId: `t${suite}`,
      sourcePath: "test",
      checksum: "test",
      notosClientId: `t${suite}`,
      displayName: "Approvals test",
    })
    .returning({ id: deploymentPackages.id });
  workspaceId = workspace?.id ?? "";
  await database
    .insert(agents)
    .values({
      id: botId,
      name: botId,
      type: "remote_ag_ui",
      configuration: {},
      workspaceId,
    })
    .onConflictDoNothing();
  await database
    .insert(mcpServers)
    .values({
      id: serverId,
      title: "Routines",
      vendor: "OpenBot",
      url: "builtin://routines/",
      provenance: "first-party",
    })
    .onConflictDoNothing();
  for (const name of ["create_routine", "list_routines"]) {
    await database
      .insert(mcpTools)
      .values({ serverId, name, description: name })
      .onConflictDoNothing();
  }
  await store.grant("mcp", writeRef, botId, "admin@openbot.local");
  await store.grant("mcp", readRef, botId, "admin@openbot.local");
});

afterAll(async () => {
  await database.delete(approvals).where(eq(approvals.botId, botId));
  await database.delete(agents).where(eq(agents.id, botId));
  if (workspaceId) {
    await database
      .delete(deploymentPackages)
      .where(eq(deploymentPackages.id, workspaceId));
  }
  await database.$client.end({ timeout: 5 });
});

async function callWrite(args: Record<string, unknown> = ARGS) {
  return store.callTool({
    ref: writeRef,
    args,
    botId,
    actorId: "asker@client.nl",
    threadId: `thread_${suite}`,
  });
}

async function openRows() {
  return database
    .select()
    .from(approvals)
    .where(and(eq(approvals.botId, botId), eq(approvals.toolRef, writeRef)));
}

describe("a write waits for a person", () => {
  test("a read passes without anybody being asked", async () => {
    const result = await store.callTool({
      ref: readRef,
      args: {},
      botId,
      actorId: "asker@client.nl",
    });
    expect(result.isError).toBe(false);
    expect(vendorCalls).toContain("list_routines");
    expect(await openRows()).toHaveLength(0);
  });

  test("the first write is refused with a question, a row, and a trail", async () => {
    let thrown: unknown;
    try {
      await callWrite();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(PluginRefusedError);
    const message = (thrown as PluginRefusedError).message;
    expect(message.startsWith("needs_approval:")).toBe(true);
    expect((thrown as PluginRefusedError).rule).toBe(
      DEFAULT_WORKSPACE_POLICY.deny[0] as string,
    );
    expect(vendorCalls).not.toContain("create_routine");

    const rows = await openRows();
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row?.decision).toBeNull();
    expect(row?.workspaceId).toBe(workspaceId);
    expect(row?.threadId).toBe(`thread_${suite}`);
    expect(row?.argsHash).toBe(hashArgs(ARGS));
    expect(message).toContain(`needs_approval:${row?.id}`);

    const trail = await database
      .select({ eventType: auditEvents.eventType })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.targetType, "approval"),
          eq(auditEvents.targetId, row?.id ?? ""),
        ),
      );
    expect(trail.map((event) => event.eventType)).toEqual([
      "approval.requested",
    ]);
  });

  test("asking again for the same call reuses the open question", async () => {
    await callWrite().catch(() => undefined);
    expect(await openRows()).toHaveLength(1);
  });

  test("after a yes the same call goes through once, and only once", async () => {
    const [row] = await openRows();
    expect(row).toBeDefined();
    const decided = await approvalStore.decide(
      row?.id ?? "",
      "granted",
      "lead@client.nl",
    );
    expect(decided?.decision).toBe("granted");

    const result = await callWrite();
    expect(result).toEqual({ text: "create_routine done", isError: false });
    expect(
      vendorCalls.filter((name) => name === "create_routine"),
    ).toHaveLength(1);
    const spent = await approvalStore.get(row?.id ?? "");
    expect(spent?.usedAt).not.toBeNull();

    // The yes was for one call. The next one is a new question, not a free pass.
    await expect(callWrite()).rejects.toBeInstanceOf(PluginRefusedError);
    expect(
      vendorCalls.filter((name) => name === "create_routine"),
    ).toHaveLength(1);
    expect((await openRows()).filter((r) => r.decision === null)).toHaveLength(
      1,
    );
  });

  test("a yes for one set of arguments is not a yes for another", async () => {
    const other = { ...ARGS, cron: "0 8 * * 1" };
    await expect(callWrite(other)).rejects.toBeInstanceOf(PluginRefusedError);
    const rows = (await openRows()).filter((r) => r.decision === null);
    expect(rows.map((r) => r.argsHash).sort()).toEqual(
      [hashArgs(ARGS), hashArgs(other)].sort(),
    );
  });

  test("the hash does not care about key order", () => {
    expect(hashArgs({ a: 1, b: { c: [1, 2] } })).toBe(
      hashArgs({ b: { c: [1, 2] }, a: 1 }),
    );
    expect(hashArgs({ a: 1 })).not.toBe(hashArgs({ a: 2 }));
  });
});

describe("who may say yes", () => {
  const appFor = (role: "zuid" | "lead" | "specialist" | "viewer") => {
    const asPerson: MiddlewareHandler<{ Variables: AppVariables }> = async (
      context,
      next,
    ) => {
      context.set("actor", {
        id: `${role}@test`,
        email: `${role}@test`,
        role: "user",
        isInternal: role === "zuid",
        workspace: { id: workspaceId, slug: `t${suite}`, role },
      });
      await next();
    };
    const app = new Hono<{ Variables: AppVariables }>();
    app.route(
      "/approvals",
      createApprovalRoutes(approvalStore, asPerson, createAuditStore(database)),
    );
    return app;
  };

  test("a viewer gets 403 and the question stays open", async () => {
    const [row] = (await openRows()).filter((r) => r.decision === null);
    expect(row).toBeDefined();
    const response = await appFor("viewer").request(
      `http://x/approvals/${row?.id}/decide`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: "granted" }),
      },
    );
    expect(response.status).toBe(403);
    expect((await approvalStore.get(row?.id ?? ""))?.decision).toBeNull();
  });

  test("a lead may decide, and the decision is recorded once", async () => {
    const [row] = (await openRows()).filter((r) => r.decision === null);
    expect(row).toBeDefined();
    const app = appFor("lead");
    const response = await app.request(`http://x/approvals/${row?.id}/decide`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "denied" }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      decision: string;
      decidedBy: string;
    };
    expect(body.decision).toBe("denied");
    expect(body.decidedBy).toBe("lead@test");

    // A second answer changes nothing: the row keeps its first decision and its first decider.
    const again = await appFor("zuid").request(
      `http://x/approvals/${row?.id}/decide`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: "granted" }),
      },
    );
    expect(again.status).toBe(200);
    expect(((await again.json()) as { decision: string }).decision).toBe(
      "denied",
    );

    const trail = await database
      .select({ eventType: auditEvents.eventType })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.targetType, "approval"),
          eq(auditEvents.targetId, row?.id ?? ""),
        ),
      );
    expect(
      trail
        .filter((event) => event.eventType.startsWith("approval."))
        .map((event) => event.eventType)
        .sort(),
    ).toEqual(["approval.denied", "approval.requested"]);
  });

  test("a row from another workspace is not there", async () => {
    const [row] = await openRows();
    const foreign = new Hono<{ Variables: AppVariables }>();
    const asOther: MiddlewareHandler<{ Variables: AppVariables }> = async (
      context,
      next,
    ) => {
      context.set("actor", {
        id: "o@test",
        email: "o@test",
        role: "user",
        isInternal: false,
        workspace: { id: randomUUID(), slug: "other", role: "lead" },
      });
      await next();
    };
    foreign.route("/approvals", createApprovalRoutes(approvalStore, asOther));
    expect(
      (await foreign.request(`http://x/approvals/${row?.id}`)).status,
    ).toBe(404);
  });
});
