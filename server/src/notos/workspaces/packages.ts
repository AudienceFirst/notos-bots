/**
 * Het botspakket van een workspace: `workspaces/<slug>/` of anders `workspaces/_default/`.
 *
 * Zelfde bestanden en zelfde schema als OpenBot's tenantpakket (`agents.yaml`, `channels.yaml`,
 * `skills.yaml`), dus `validateTenantPackage` blijft de validator. `brand.yaml`, `model.yaml` en
 * `knowledge.yaml` bestaan niet meer per workspace: de naam komt van NOTOS, het model staat op de
 * workspace-rij (stap 3), en `knowledge.yaml` werd door niets gelezen. Ze worden hier synthetisch
 * aangeleverd zodat de validator ongewijzigd kan blijven.
 *
 * Elke id uit het pakket krijgt de workspace als voorvoegsel (`zoover--media-manager`): bots,
 * kanalen en skills zijn deployment-breed uniek, en twee workspaces delen hetzelfde pakket.
 */
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  expandEnvironment,
  type LoadedTenantPackage,
  validateTenantPackage,
} from "../../tenant-package";
import type { Workspace } from "./store";

const DEFAULT_DIR = "_default";

export const prefixed = (slug: string, id: string) => `${slug}--${id}`;

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Eerst de map van de workspace, dan `_default`; ontbreekt het daar ook, dan een lege waarde. */
async function packageFile(
  root: string,
  slug: string,
  filename: string,
  empty: string,
): Promise<string> {
  for (const dir of [slug, DEFAULT_DIR]) {
    const path = join(root, dir, filename);
    if (await exists(path)) {
      return expandEnvironment(await readFile(path, "utf8"), filename);
    }
  }
  return empty;
}

/** Welke map het pakket van deze workspace levert, voor `deployment_packages.source_path`. */
export async function packageDirFor(
  root: string,
  slug: string,
): Promise<string> {
  return (await exists(join(root, slug)))
    ? join(root, slug)
    : join(root, DEFAULT_DIR);
}

export async function loadWorkspacePackage(
  root: string,
  workspace: Workspace,
  /** Het model dat de ingebouwde bots nu nog krijgen; stap 3 haalt dit van de workspace-rij. */
  model: { credentialSecretRef: string; defaultModel: string },
): Promise<LoadedTenantPackage> {
  const slug = workspace.slug;
  const [agents, channels, skills] = await Promise.all([
    packageFile(root, slug, "agents.yaml", "agents: []\n"),
    packageFile(root, slug, "channels.yaml", "channels: []\n"),
    packageFile(root, slug, "skills.yaml", ""),
  ]);
  const brand = `tenant:\n  id: ${JSON.stringify(slug)}\n  product_name: ${JSON.stringify(workspace.displayName)}\n`;
  const modelYaml = `model:\n  provider: openai\n  credential_secret_ref: ${JSON.stringify(model.credentialSecretRef)}\n  default_model: ${JSON.stringify(model.defaultModel)}\n`;
  const knowledge = "sources: []\n";

  const validated = validateTenantPackage({
    brand,
    agents,
    channels,
    model: modelYaml,
    knowledge,
    skills,
    themeCss: "",
  });

  const skillSlug = (value: string) => prefixed(slug, value);
  return {
    ...validated,
    agents: validated.agents.map((agent) => ({
      ...agent,
      id: prefixed(slug, agent.id),
      avatarSeed: agent.avatarSeed ?? agent.id,
      skills: agent.skills.map(skillSlug),
    })),
    channels: validated.channels.map((channel) => ({
      ...channel,
      id: prefixed(slug, channel.id),
      permittedAgents: channel.permittedAgents.map((id) => prefixed(slug, id)),
    })),
    skills: validated.skills.map((skill) => ({
      ...skill,
      slug: skillSlug(skill.slug),
    })),
    sourcePath: await packageDirFor(root, slug),
    checksum: createHash("sha256")
      .update([agents, channels, skills, brand, modelYaml].join("\n"))
      .digest("hex"),
  };
}
