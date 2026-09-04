/**
 * Workspaces: één per NOTOS-klant, in de tabel `deployment_packages` (bouwplan stap 2).
 *
 * OpenBot laadde precies één tenantpakket per proces. Hier is het pakket de workspace: de rij
 * draagt de NOTOS `client_id`, de naam, het model en de locatie, en alles wat bij een klant hoort
 * (bots, kanalen, routines, threads) wijst ernaar. Wie erin mag staat niet hier maar in NOTOS:
 * ZUID-adressen zien alles, een klantgast ziet wat `client_members` zegt. Seats worden hier nooit
 * geschreven.
 */
import { and, eq, notInArray, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { deploymentPackages } from "../../db/schema";

export type WorkspaceRole = "zuid" | "lead" | "specialist" | "viewer";

export type Workspace = {
  id: string;
  /** De NOTOS `client_id`; wat in elke `/w/:workspace`-URL staat. */
  slug: string;
  displayName: string;
  kind: string;
  currency: string;
  vertexLocation: string;
  defaultModel: string;
  driveRootIds: Record<string, unknown>;
  enabled: boolean;
};

export type WorkspaceMembership = { workspace: Workspace; role: WorkspaceRole };

/** Wat NOTOS over een klant vertelt; de vorm van `ClientSummary` in mge-platform. */
export type NotosClient = {
  client_id: string;
  display_name: string;
  is_mock?: boolean;
  kind?: string;
  currency?: string;
};

export type WorkspaceStore = {
  /** Alle ingeschakelde workspaces, op naam. */
  list(): Promise<Workspace[]>;
  bySlug(slug: string): Promise<Workspace | null>;
  byId(id: string): Promise<Workspace | null>;
  /** Maak of werk bij vanuit wat NOTOS meldt. `sourcePath` is de pakketmap die erbij hoort. */
  upsertFromClient(client: NotosClient, sourcePath: string): Promise<Workspace>;
  /** Alles wat NOTOS niet meer noemt gaat uit, nooit weg. Geeft het aantal uitgezette terug. */
  disableExcept(slugs: readonly string[]): Promise<number>;
  /** De workspaces van deze persoon, met rol. Intern: alles als `zuid`. Extern: `client_members`. */
  listForActor(actor: ActorLike): Promise<WorkspaceMembership[]>;
  membership(
    actor: ActorLike,
    slug: string,
  ): Promise<WorkspaceMembership | null>;
  /** Mag deze persoon iets lezen dat bij deze workspace-id hoort. */
  mayRead(actor: ActorLike, workspaceId: string | null): Promise<boolean>;
  updateSettings(
    id: string,
    settings: Partial<
      Pick<Workspace, "vertexLocation" | "defaultModel" | "driveRootIds">
    >,
  ): Promise<void>;
};

/** Wat de store van een actor nodig heeft: is het ZUID, en anders welke klanten met welke rol. */
export type ActorLike = {
  isInternal?: boolean | undefined;
  memberships?: Partial<Record<string, WorkspaceRole>> | undefined;
};

const toWorkspace = (
  row: typeof deploymentPackages.$inferSelect,
): Workspace => ({
  id: row.id,
  slug: row.notosClientId ?? row.tenantId,
  displayName: row.displayName ?? row.tenantId,
  kind: row.kind,
  currency: row.currency,
  vertexLocation: row.vertexLocation,
  defaultModel: row.defaultModel,
  driveRootIds: row.driveRootIds as Record<string, unknown>,
  enabled: row.enabled,
});

export function createWorkspaceStore(database: Database): WorkspaceStore {
  const list = async () =>
    (
      await database
        .select()
        .from(deploymentPackages)
        .where(eq(deploymentPackages.enabled, true))
        .orderBy(deploymentPackages.displayName, deploymentPackages.tenantId)
    ).map(toWorkspace);

  const bySlug = async (slug: string) => {
    const [row] = await database
      .select()
      .from(deploymentPackages)
      .where(eq(deploymentPackages.notosClientId, slug))
      .limit(1);
    return row ? toWorkspace(row) : null;
  };

  const roleFor = (
    actor: ActorLike,
    workspace: Workspace,
  ): WorkspaceRole | null => {
    if (!workspace.enabled) return null;
    if (actor.isInternal) return "zuid";
    return actor.memberships?.[workspace.slug] ?? null;
  };

  return {
    list,
    bySlug,
    async byId(id) {
      const [row] = await database
        .select()
        .from(deploymentPackages)
        .where(eq(deploymentPackages.id, id))
        .limit(1);
      return row ? toWorkspace(row) : null;
    },

    async upsertFromClient(client, sourcePath) {
      const slug = client.client_id;
      const kind = client.kind ?? (client.is_mock ? "demo" : "real");
      const [row] = await database
        .insert(deploymentPackages)
        .values({
          tenantId: slug,
          notosClientId: slug,
          displayName: client.display_name,
          kind,
          currency: client.currency ?? "EUR",
          sourcePath,
          // Het pakket zelf zet de echte checksum zodra het gesynchroniseerd is.
          checksum: "",
          enabled: true,
        })
        .onConflictDoUpdate({
          target: deploymentPackages.tenantId,
          set: {
            notosClientId: slug,
            displayName: client.display_name,
            kind,
            currency: client.currency ?? "EUR",
            enabled: true,
          },
        })
        .returning();
      if (!row) throw new Error(`Workspace ${slug} could not be written`);
      return toWorkspace(row);
    },

    async disableExcept(slugs) {
      const rows = await database
        .update(deploymentPackages)
        .set({ enabled: false })
        .where(
          and(
            eq(deploymentPackages.enabled, true),
            slugs.length > 0
              ? notInArray(deploymentPackages.tenantId, [...slugs])
              : sql`true`,
          ),
        )
        .returning({ id: deploymentPackages.id });
      return rows.length;
    },

    async listForActor(actor) {
      const all = await list();
      return all.flatMap((workspace) => {
        const role = roleFor(actor, workspace);
        return role ? [{ workspace, role }] : [];
      });
    },

    async membership(actor, slug) {
      const workspace = await bySlug(slug);
      if (!workspace) return null;
      const role = roleFor(actor, workspace);
      return role ? { workspace, role } : null;
    },

    async mayRead(actor, workspaceId) {
      // Een rij van vóór de workspaces (null) is van niemand in het bijzonder; alleen ZUID leest die.
      if (workspaceId === null) return actor.isInternal === true;
      const [row] = await database
        .select()
        .from(deploymentPackages)
        .where(eq(deploymentPackages.id, workspaceId))
        .limit(1);
      return row ? roleFor(actor, toWorkspace(row)) !== null : false;
    },

    async updateSettings(id, settings) {
      await database
        .update(deploymentPackages)
        .set({
          ...(settings.vertexLocation
            ? { vertexLocation: settings.vertexLocation }
            : {}),
          ...(settings.defaultModel
            ? { defaultModel: settings.defaultModel }
            : {}),
          // NOTOS (stap 8): { roots: [...] }; an empty list is a deliberate "no folder".
          ...(settings.driveRootIds
            ? { driveRootIds: settings.driveRootIds }
            : {}),
        })
        .where(eq(deploymentPackages.id, id));
    },
  };
}

/** NOTOS (stap 8): the folder ids out of the jsonb, whatever shape an older row has. */
export function driveRootsOf(
  value: Record<string, unknown> | null | undefined,
): string[] {
  const roots = value?.roots;
  if (!Array.isArray(roots)) return [];
  return roots.filter(
    (id): id is string => typeof id === "string" && /^[\w-]{10,}$/.test(id),
  );
}

/** A Drive folder link or a bare id, to the id; null when it is neither. */
export function driveFolderIdFrom(input: string): string | null {
  const trimmed = input.trim();
  const fromLink = trimmed.match(/\/folders\/([\w-]{10,})/);
  if (fromLink?.[1]) return fromLink[1];
  return /^[\w-]{10,}$/.test(trimmed) ? trimmed : null;
}
