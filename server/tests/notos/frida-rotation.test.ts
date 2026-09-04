// NOTOS: FRIDA's refresh-token rouleert bij elke ververs; de store bewaart het nieuwe (stap 6).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { createAuditStore } from "../../src/audit";
import { decryptSecret, encryptSecret } from "../../src/credentials";
import { createDatabase } from "../../src/db/client";
import {
  agents,
  credentials,
  mcpServers,
  mcpTools,
  mcpUserCredentials,
  pluginGrants,
  users,
} from "../../src/db/schema";
import { FRIDA_HOST, FRIDA_TOOLS } from "../../src/plugins/catalogue";
import { createPluginStore } from "../../src/plugins/store";
import { TEST_POOL } from "../support/database";

const database = createDatabase(
  process.env.DATABASE_URL ??
    "postgres://openbot:openbot@localhost:5432/openbot",
  TEST_POOL,
);

// 32 bytes, base64: what the store expects of KEY_ENCRYPTION_KEY.
const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
const suite = randomUUID().slice(0, 8);
const botId = `agent_frida_${suite}`;
const mitch = `user_frida_mitch_${suite}`;
const other = `user_frida_other_${suite}`;
const serverId = "frida";
const ref = `${serverId}/whoami`;
const CLIENT = { clientId: `frida-client-${suite}`, clientSecret: "secret" };

/** Every exchange answers with a NEW refresh token, as FRIDA's Supabase does. */
const exchanged: string[] = [];
let mint = 0;
const credentialIds: string[] = [];
const seenTokens: string[] = [];

const store = createPluginStore({
  database,
  auditStore: createAuditStore(database),
  credentials: {
    readSecret: async (id) => {
      const [row] = await database
        .select({
          encryptedValue: credentials.encryptedValue,
          revokedAt: credentials.revokedAt,
        })
        .from(credentials)
        .where(eq(credentials.id, id));
      return row ?? null;
    },
    create: async () => {
      throw new Error("this suite writes credentials directly");
    },
    // The rotation writes through here, on the caller's transaction (it holds the row lock).
    updateSecret: async (id, encryptedValue, executor = database) => {
      await executor
        .update(credentials)
        .set({ encryptedValue, updatedAt: new Date() })
        .where(eq(credentials.id, id));
    },
    revoke: async (id) => {
      const revokedAt = new Date();
      await database
        .update(credentials)
        .set({ revokedAt })
        .where(eq(credentials.id, id));
      return revokedAt;
    },
  },
  encryptionKey: ENCRYPTION_KEY,
  policy: () => ({ mode: "enforce", deny: [], allow: ["true"] }),
  callVendor: async (connection) => {
    seenTokens.push(connection.token ?? "<none>");
    return { text: `whoami as ${connection.token}`, isError: false };
  },
  exchangeRefreshToken: async ({ refreshToken }) => {
    exchanged.push(refreshToken);
    mint += 1;
    // A slow token endpoint, so two callers really overlap on the row lock.
    await new Promise((resolve) => setTimeout(resolve, 60));
    return {
      accessToken: `access-${mint}`,
      refreshToken: `refresh-${suite}-${mint}`,
    };
  },
});

async function storedRefreshToken(userId: string): Promise<string> {
  const [row] = await database
    .select({ credentialId: mcpUserCredentials.credentialId })
    .from(mcpUserCredentials)
    .where(
      and(
        eq(mcpUserCredentials.serverId, serverId),
        eq(mcpUserCredentials.userId, userId),
      ),
    );
  const [credential] = await database
    .select({ encryptedValue: credentials.encryptedValue })
    .from(credentials)
    .where(eq(credentials.id, row?.credentialId ?? ""));
  return decryptSecret(ENCRYPTION_KEY, credential?.encryptedValue ?? "");
}

async function connect(userId: string, refreshToken: string) {
  const [credential] = await database
    .insert(credentials)
    .values({
      kind: "mcp_user_token",
      provider: serverId,
      keyId: userId,
      metadata: {},
      encryptedValue: await encryptSecret(ENCRYPTION_KEY, refreshToken),
    })
    .returning({ id: credentials.id });
  if (!credential) throw new Error("credential was not stored");
  credentialIds.push(credential.id);
  await database
    .insert(mcpUserCredentials)
    .values({
      serverId,
      userId,
      credentialId: credential.id,
      scope: "openid email offline_access",
    })
    .onConflictDoUpdate({
      target: [mcpUserCredentials.serverId, mcpUserCredentials.userId],
      set: { credentialId: credential.id },
    });
}

beforeAll(async () => {
  // A person's connection hangs off a users row, as it does for a real NOTOS session.
  for (const id of [mitch, other]) {
    await database
      .insert(users)
      .values({ id, email: `${id}@zuid.com`, name: id })
      .onConflictDoNothing();
  }
  await database
    .insert(agents)
    .values({ id: botId, name: botId, type: "remote_ag_ui", configuration: {} })
    .onConflictDoNothing();
  await database
    .insert(mcpServers)
    .values({
      id: serverId,
      title: "FRIDA",
      vendor: "ZUID",
      url: `${FRIDA_HOST}/mcp`,
      provenance: "first-party",
    })
    .onConflictDoNothing();
  await database
    .insert(mcpTools)
    .values({ serverId, name: "whoami", description: "Who am I in FRIDA." })
    .onConflictDoNothing();
  // The OAuth client the deployment registered at FRIDA, as the store expects to find it.
  const [client] = await database
    .insert(credentials)
    .values({
      kind: "mcp_oauth_client",
      provider: serverId,
      keyId: "oauth-client",
      metadata: { clientId: CLIENT.clientId },
      encryptedValue: await encryptSecret(
        ENCRYPTION_KEY,
        JSON.stringify(CLIENT),
      ),
    })
    .returning({ id: credentials.id });
  if (!client) throw new Error("client was not stored");
  credentialIds.push(client.id);
  await database
    .update(mcpServers)
    .set({ credentialId: client.id })
    .where(eq(mcpServers.id, serverId));
  await store.grant("mcp", ref, botId, "admin@openbot.local");
});

afterAll(async () => {
  await database
    .delete(mcpUserCredentials)
    .where(
      and(
        eq(mcpUserCredentials.serverId, serverId),
        eq(mcpUserCredentials.userId, mitch),
      ),
    );
  await database
    .delete(mcpUserCredentials)
    .where(
      and(
        eq(mcpUserCredentials.serverId, serverId),
        eq(mcpUserCredentials.userId, other),
      ),
    );
  await database
    .update(mcpServers)
    .set({ credentialId: null })
    .where(eq(mcpServers.id, serverId));
  for (const id of credentialIds) {
    await database.delete(credentials).where(eq(credentials.id, id));
  }
  await database.delete(pluginGrants).where(eq(pluginGrants.agentId, botId));
  await database.delete(agents).where(eq(agents.id, botId));
  for (const id of [mitch, other]) {
    await database.delete(users).where(eq(users.id, id));
  }
  await database.$client.end({ timeout: 5 });
});

describe("FRIDA as the person asking", () => {
  test("the catalogue knows FRIDA as a per-person OAuth connector without write tools", async () => {
    const { catalogueEntry } = await import("../../src/plugins/catalogue");
    const entry = catalogueEntry("frida");
    expect(entry?.auth.kind).toBe("user-oauth");
    expect(entry?.writeTools).toEqual([]);
    expect(FRIDA_TOOLS).toContain("list_mijn_taken");
    if (entry?.auth.kind === "user-oauth") {
      expect(entry.auth.scopes).toContain("offline_access");
      expect(entry.auth.clientRegistration).toBe("dynamic");
    }
  });

  test("somebody who never connected is told to, and no token is spent", async () => {
    await expect(
      store.callTool({ ref, args: {}, botId, actorId: other }),
    ).rejects.toThrow(/connect/i);
    expect(exchanged).toHaveLength(0);
  });

  test("a rotated refresh token is stored in place, and the next call uses it", async () => {
    await connect(mitch, `refresh-${suite}-0`);

    const first = await store.callTool({
      ref,
      args: {},
      botId,
      actorId: mitch,
    });
    expect(first.isError).toBe(false);
    expect(exchanged).toEqual([`refresh-${suite}-0`]);
    expect(await storedRefreshToken(mitch)).toBe(`refresh-${suite}-1`);

    await store.callTool({ ref, args: {}, botId, actorId: mitch });
    expect(exchanged).toEqual([`refresh-${suite}-0`, `refresh-${suite}-1`]);
    expect(await storedRefreshToken(mitch)).toBe(`refresh-${suite}-2`);
  });

  test("two refreshes at once queue on the row and the second uses the first's new token", async () => {
    const before = exchanged.length;
    const stored = await storedRefreshToken(mitch);
    await Promise.all([
      store.callTool({ ref, args: {}, botId, actorId: mitch }),
      store.callTool({ ref, args: {}, botId, actorId: mitch }),
    ]);
    const mine = exchanged.slice(before);
    expect(mine).toHaveLength(2);
    expect(mine[0]).toBe(stored);
    // Not the same token twice: the second exchange only ran after the first had rotated it.
    expect(mine[1]).not.toBe(stored);
    expect(mine[1]).toBe(`refresh-${suite}-${mint - 1}`);
    expect(await storedRefreshToken(mitch)).toBe(`refresh-${suite}-${mint}`);
  });

  test("another person's connection is their own", async () => {
    await connect(other, `refresh-${suite}-other`);
    const result = await store.callTool({
      ref,
      args: {},
      botId,
      actorId: other,
    });
    expect(result.isError).toBe(false);
    expect(exchanged.at(-1)).toBe(`refresh-${suite}-other`);
    // Mitch's stored token did not move.
    expect(await storedRefreshToken(mitch)).toBe(
      `refresh-${suite}-${mint - 1}`,
    );
    // And no credential of either was revoked along the way.
    const live = await database
      .select({ id: credentials.id })
      .from(credentials)
      .where(
        and(
          eq(credentials.provider, serverId),
          eq(credentials.kind, "mcp_user_token"),
          isNull(credentials.revokedAt),
        ),
      );
    expect(live.length).toBeGreaterThanOrEqual(2);
  });
});
