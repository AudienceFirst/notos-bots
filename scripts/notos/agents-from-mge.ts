/**
 * NOTOS: het standaard-botspakket, gegenereerd uit de MGE-rollen (bouwplan stap 2).
 *
 * Bron is `AGENT_PERSONAS` in `mge-platform/src/api/chat_agent.py`: de systeemprompts waarmee de
 * NOTOS-chat vandaag per rol praat. Niet met de hand gekopieerd maar gelezen met Python's `ast`
 * (standaardbibliotheek, dus geen afhankelijkheden van mge-platform nodig), zodat een gewijzigde
 * persona één herdraai is. Twee keer draaien geeft byte voor byte hetzelfde bestand.
 *
 *   MGE_PLATFORM_DIR=~/Code/mge-platform bun scripts/notos/agents-from-mge.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { stringify } from "yaml";

const root = resolve(import.meta.dir, "../..");
const mgeDir = resolve(
  (process.env.MGE_PLATFORM_DIR ?? "~/Code/mge-platform").replace(
    /^~/,
    homedir(),
  ),
);
const source = resolve(mgeDir, "src/api/chat_agent.py");

/** Welke rollen een workspace standaard krijgt, en hoe ze in de zijbalk heten. Volgorde = volgorde. */
const ROLES: {
  persona: string;
  id: string;
  name: string;
  title: string;
}[] = [
  {
    persona: "media_manager",
    id: "media-manager",
    name: "Media Manager",
    title: "Kanaalmix en budget",
  },
  {
    persona: "sea_specialist",
    id: "sea-specialist",
    name: "SEA Specialist",
    title: "Google Ads",
  },
  {
    persona: "meta_strategist",
    id: "meta-specialist",
    name: "Meta Specialist",
    title: "Meta Ads",
  },
  {
    persona: "seo_specialist",
    id: "seo-specialist",
    name: "SEO Specialist",
    title: "Organische vindbaarheid",
  },
  {
    persona: "copywriter",
    id: "copywriter",
    name: "Copywriter",
    title: "Advertentieteksten en creatie",
  },
  {
    persona: "data_analytics",
    id: "data-analytics",
    name: "Data Analytics",
    title: "Meten en attributie",
  },
];

const reader = `
import ast, json, sys
tree = ast.parse(open(sys.argv[1], encoding="utf-8").read())
for node in ast.walk(tree):
    targets = node.targets if isinstance(node, ast.Assign) else [node.target] if isinstance(node, ast.AnnAssign) else []
    if any(getattr(t, "id", None) == "AGENT_PERSONAS" for t in targets) and node.value is not None:
        print(json.dumps(ast.literal_eval(node.value), ensure_ascii=False))
        break
else:
    sys.exit("AGENT_PERSONAS niet gevonden")
`;

const python = Bun.spawnSync(["python3", "-c", reader, source]);
if (python.exitCode !== 0) {
  console.error(python.stderr.toString());
  process.exit(1);
}
const personas = JSON.parse(python.stdout.toString()) as Record<string, string>;

/** De eerste zin van de persona, zonder markdown-vet, als rolbeschrijving voor de kaart. */
function roleDescription(persona: string): string {
  const firstSentence = persona.split(/(?<=\\.)\\s/)[0] ?? persona;
  return firstSentence.replace(/\\*\\*/g, "").trim();
}

const missing = ROLES.filter((role) => !(role.persona in personas));
if (missing.length > 0) {
  console.error(
    `Persona's ontbreken in ${source}: ${missing.map((role) => role.persona).join(", ")}`,
  );
  process.exit(1);
}

const agents = ROLES.map((role) => ({
  id: role.id,
  name: role.name,
  title: role.title,
  role_description: roleDescription(personas[role.persona] ?? ""),
  avatar_seed: role.id,
  type: "built-in",
  system_prompt: personas[role.persona],
}));

const header = [
  "# Gegenereerd door scripts/notos/agents-from-mge.ts uit AGENT_PERSONAS in",
  "# mge-platform/src/api/chat_agent.py. Niet met de hand bewerken: draai het script opnieuw.",
  "#",
  "# Dit is het pakket dat elke workspace krijgt die geen eigen map onder workspaces/ heeft.",
  "",
].join("\n");

await mkdir(resolve(root, "workspaces/_default"), { recursive: true });
await writeFile(
  resolve(root, "workspaces/_default/agents.yaml"),
  header + stringify({ agents }, { lineWidth: 0 }),
);
console.log(
  `workspaces/_default/agents.yaml: ${agents.length} bots uit ${source}`,
);
