import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { eq, inArray, like } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { Hono } from "hono";
import type { AppVariables } from "../../src/auth/guards";
import { createDatabase } from "../../src/db/client";
import {
  agents,
  agentProfiles,
  channels,
  deploymentPackages,
  skills,
} from "../../src/db/schema";
import {
  clientsFromFile,
  createRequireWorkspace,
  createWorkspaceStore,
  createWorkspaceSync,
  loadWorkspacePackage,
} from "../../src/notos/workspaces";
import { TEST_POOL } from "../support/database";

/**
 * NOTOS: workspaces = NOTOS clients, seats = what the actor brought from `client_members` (stap 2).
 *
 * Against the real database: the sync writes packages, and whether a guest sees one workspace
 * and gets 403 on another is the whole point. The client list is a file here, in the shape the
 * NOTOS endpoint answers with.
 */

const database = createDatabase(
  process.env.DATABASE_URL ??
    "postgres://openbot:openbot@localhost:5432/openbot",
  TEST_POOL,
);
const store = createWorkspaceStore(database);
const PREFIX = `t${Date.now().toString(36)}`;
const ZUID = `${PREFIX}-zuid`;
const ZOOVER = `${PREFIX}-zoover`;
const GONE = `${PREFIX}-gone`;
const packagesRoot = resolve(import.meta.dir, "../../../workspaces");
let clientsFile = "";

beforeAll(async () => {
  const dir = await mkdtemp(join(tmpdir(), "notos-clients-"));
  clientsFile = join(dir, "clients.json");
  await writeFile(
    clientsFile,
    JSON.stringify([
      { client_id: ZUID, display_name: "ZUID", kind: "real", currency: "EUR" },
      {
        client_id: ZOOVER,
        display_name: "Zoover",
        kind: "onboarding",
        currency: "EUR",
      },
    ]),
  );
});

afterAll(async () => {
  const ids = (
    await database
      .select({ id: deploymentPackages.id })
      .from(deploymentPackages)
      .where(like(deploymentPackages.tenantId, `${PREFIX}-%`))
  ).map((row) => row.id);
  if (ids.length > 0) {
    await database
      .delete(agentProfiles)
      .where(like(agentProfiles.agentId, `${PREFIX}-%`));
    await database.delete(agents).where(inArray(agents.packageId, ids));
    await database.delete(channels).where(inArray(channels.packageId, ids));
    await database.delete(skills).where(like(skills.slug, `${PREFIX}-%`));
    await database
      .delete(deploymentPackages)
      .where(inArray(deploymentPackages.id, ids));
  }
  await database.$client.end({ timeout: 5 });
});

const zuidPerson = { isInternal: true };
const guest = { isInternal: false, memberships: { [ZOOVER]: "lead" as const } };
const stranger = { isInternal: false, memberships: {} };

describe("syncing workspaces from NOTOS", () => {
  test("every client becomes a workspace with the default package, prefixed per workspace", async () => {
    const sync = createWorkspaceSync({
      database,
      store,
      clients: clientsFromFile(clientsFile),
      packagesRoot,
      model: {
        credentialSecretRef: "openai-api-key",
        defaultModel: "gpt-test",
      },
    });
    // A client NOTOS no longer names, from an earlier sync.
    await store.upsertFromClient(
      { client_id: GONE, display_name: "Gone" },
      packagesRoot,
    );

    const report = await sync();
    expect(report.failed).toEqual([]);
    expect(report.synced.sort()).toEqual([ZUID, ZOOVER].sort());
    // At least the one this test planted; a local database may hold older packages NOTOS never named.
    expect(report.disabled).toBeGreaterThanOrEqual(1);

    const zoover = await store.bySlug(ZOOVER);
    expect(zoover).toMatchObject({
      slug: ZOOVER,
      displayName: "Zoover",
      kind: "onboarding",
      enabled: true,
    });
    const bots = await database
      .select({ id: agents.id, workspaceId: agents.workspaceId })
      .from(agents)
      .where(eq(agents.packageId, zoover?.id ?? ""));
    expect(bots.map((bot) => bot.id).sort()).toEqual(
      [
        "media-manager",
        "sea-specialist",
        "meta-specialist",
        "seo-specialist",
        "copywriter",
        "data-analytics",
      ]
        .map((id) => `${ZOOVER}--${id}`)
        .sort(),
    );
    expect(bots.every((bot) => bot.workspaceId === zoover?.id)).toBe(true);
    expect((await store.bySlug(GONE))?.enabled).toBe(false);
  });

  test("the same package twice is the same package", async () => {
    const workspace = await store.bySlug(ZOOVER);
    if (!workspace) throw new Error("workspace missing");
    const model = {
      credentialSecretRef: "openai-api-key",
      defaultModel: "gpt-test",
    };
    const first = await loadWorkspacePackage(packagesRoot, workspace, model);
    const second = await loadWorkspacePackage(packagesRoot, workspace, model);
    expect(first.checksum).toBe(second.checksum);
    expect(first.agents.map((agent) => agent.id)).toEqual(
      second.agents.map((agent) => agent.id),
    );
  });
});

describe("who sees which workspace", () => {
  test("ZUID sees every enabled workspace as zuid; a guest sees theirs with their role; a stranger none", async () => {
    const forZuid = await store.listForActor(zuidPerson);
    expect(forZuid.map((m) => m.workspace.slug)).toEqual(
      expect.arrayContaining([ZUID, ZOOVER]),
    );
    expect(forZuid.every((m) => m.role === "zuid")).toBe(true);
    expect(forZuid.some((m) => m.workspace.slug === GONE)).toBe(false);

    const forGuest = await store.listForActor(guest);
    expect(forGuest.map((m) => [m.workspace.slug, m.role])).toEqual([
      [ZOOVER, "lead"],
    ]);

    expect(await store.listForActor(stranger)).toEqual([]);
    expect(await store.membership(guest, ZUID)).toBeNull();
    expect(await store.membership(guest, GONE)).toBeNull();
  });

  test("the guard answers 403 outside the set and puts the workspace on the actor inside it", async () => {
    const app = new Hono<{ Variables: AppVariables }>();
    const asGuest: MiddlewareHandler<{ Variables: AppVariables }> = async (
      context,
      next,
    ) => {
      context.set("actor", {
        id: "g",
        email: "g@client.nl",
        role: "user",
        ...guest,
      });
      await next();
    };
    app.get(
      "/w/:workspace/whoami",
      asGuest,
      createRequireWorkspace(store),
      (context) => context.json({ workspace: context.var.actor.workspace }),
    );
    const refused = await app.request(`http://x/w/${ZUID}/whoami`);
    expect(refused.status).toBe(403);
    await expect(refused.json()).resolves.toEqual({
      error: "geen toegang tot deze workspace",
    });

    const allowed = await app.request(`http://x/w/${ZOOVER}/whoami`);
    expect(allowed.status).toBe(200);
    await expect(allowed.json()).resolves.toMatchObject({
      workspace: { slug: ZOOVER, role: "lead" },
    });
    expect((await app.request(`http://x/w/${GONE}/whoami`)).status).toBe(403);
  });
});
