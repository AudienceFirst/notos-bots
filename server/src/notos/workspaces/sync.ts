import { grantFridaTools } from "./frida-grants";
/**
 * Workspaces bijhouden vanuit NOTOS: bij boot en elk uur.
 *
 * NOTOS is de bron voor wélke klanten er zijn; de repo (`workspaces/`) is de bron voor wat elke
 * klant aan bots krijgt. Een klant die NOTOS niet meer noemt gaat op `enabled = false`; niets
 * wordt verwijderd. Een sync die faalt (NOTOS onbereikbaar) laat staan wat er stond en meldt dat:
 * een bots-server zonder verse lijst is beter dan een die niet start.
 */
import type { Database } from "../../db/client";
import { synchronizeTenantPackage } from "../../tenant-package";
import type { NotosClientSource } from "./notos-client";
import { loadWorkspacePackage, packageDirFor } from "./packages";
import type { Workspace, WorkspaceStore } from "./store";

export type SyncReport = {
  synced: string[];
  disabled: number;
  failed: { slug: string; reason: string }[];
};

export function createWorkspaceSync(options: {
  database: Database;
  store: WorkspaceStore;
  clients: NotosClientSource;
  packagesRoot: string;
  model: { credentialSecretRef: string; defaultModel: string };
}) {
  const { database, store, clients, packagesRoot, model } = options;

  return async function syncWorkspaces(): Promise<SyncReport> {
    const list = await clients();
    const report: SyncReport = { synced: [], disabled: 0, failed: [] };
    for (const client of list) {
      let workspace: Workspace | undefined;
      try {
        workspace = await store.upsertFromClient(
          client,
          await packageDirFor(packagesRoot, client.client_id),
        );
        await synchronizeTenantPackage(
          database,
          await loadWorkspacePackage(packagesRoot, workspace, model),
        );
        // NOTOS (stap 6): every Bot may read FRIDA as the person asking.
        await grantFridaTools(database, workspace.id);
        report.synced.push(workspace.slug);
      } catch (error) {
        report.failed.push({
          slug: client.client_id,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
    // Alleen uitzetten wat NOTOS niet noemt als de lijst zelf compleet aankwam.
    report.disabled = await store.disableExcept(list.map((c) => c.client_id));
    return report;
  };
}
