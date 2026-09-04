# NOTOS Bots: wat hier anders is dan OpenBot

Deze repo is een fork van [CopilotKit/openbot](https://github.com/CopilotKit/openbot), gepind op
commit `d00f65c` (3 september 2026, versie 0.0.5, MIT). Het bouwplan staat in de NOTOS-repo onder
`docs/bouwplan-bots/`; dit bestand is de plek waar de fork zelf uitlegt wat van ons is en wat van
upstream.

## De pin

- Remote `upstream` = `https://github.com/CopilotKit/openbot.git`, vast op `d00f65c`.
- Al ons werk staat op branch `notos`. `main` blijft gelijk aan upstream en krijgt nooit een push.
- Een upstream-merge is een bewuste actie: eerst `git fetch upstream`, dan `git log d00f65c..upstream/main`
  lezen, dan pas mergen. `CHANGELOG.md` had op het moment van forken 349 regels onder "Unreleased";
  upstream beweegt snel.

## De regel `// NOTOS:`

Elke wijziging aan een bestand van OpenBot krijgt bovenaan dat bestand één regel
`// NOTOS: <waarom>` (in YAML en shell `# NOTOS:`). Zo is bij een latere upstream-merge in één
grep te zien welke bestanden van ons afwijken:

```
grep -rln "NOTOS:" --include=*.ts --include=*.tsx --include=*.yml --include=*.yaml --include=*.sh .
```

Nieuwe code komt niet tussen de upstream-code maar in eigen mappen:

- `server/src/notos/`
- `app/src/notos/`
- `agent-langgraph/src/notos/`

Nooit een upstream-bestand herschrijven als een laag ernaast volstaat.

## Wat we uit upstream niet gebruiken

Staat er nog, is bewust niet verwijderd. Verwijderen gebeurt in de stap die het noemt.

| Map of onderdeel | Waarom niet | Wat ermee gebeurt |
|---|---|---|
| `agent-bot/` | Proof-of-concept-bot op OpenAI; wij draaien op Vertex AI | Weg in stap 3 |
| `spire/` | SPIFFE/SPIRE-identiteit voor Kubernetes; wij draaien op Cloud Run met een serviceaccount | Blijft staan, ongebruikt |
| `supervisor/` | Start een browser-container per bot via een Docker-socket; Cloud Run heeft die niet | Blijft staan tot computers aan gaan (niet in v1) |
| `examples/fintech` | Voorbeeld-tenantpakket met verzonnen bots; NOTOS-regel "geen verzonnen data" | Weg in stap 2 |
| `charts/` | Helm-chart voor Kubernetes; wij deployen op Cloud Run | Blijft staan; de Helm-CI-jobs slaan de branch `notos` over |
| CopilotKit Intelligence | Gehoste threads, geheugen en licentie met seat-cap; wij houden gesprekken in eigen Postgres | Weg in stap 0 |
| Better Auth | Tweede identiteitsbron naast de NOTOS-sessie | Weg in stap 1 |

## Telemetrie

Staat uit via `.env.example`: `COPILOTKIT_TELEMETRY_DISABLED=true` en `DO_NOT_TRACK=1`. Beide
namen komen letterlijk voor in `@copilotkit/runtime` (`dist/v2/runtime/telemetry/telemetry-client.mjs`).
Zet ze ook in elke Cloud Run-omgeving; een `.env` op de server is er niet.

## Nulmeting op de schone checkout (4 september 2026, stap −1)

Machine: macOS, Bun 1.3.14, Docker Desktop, lokale Postgres 16 op poort 5432 (daarom draait de
test-Postgres op 5433).

| Controle | Uitkomst | Duur |
|---|---|---|
| `bun install --frozen-lockfile` | 2271 pakketten | 82 s |
| `bun run format:check` | 515 bestanden, geen wijzigingen | 2 s |
| `bun run lint` | 518 bestanden, geen meldingen | 1 s |
| `bun run typecheck` | app, server, worker groen | 10 s |
| `bun test` zonder database | 1765 geslaagd, 23 overgeslagen, 320 gefaald, 1 fout | 10 s |
| `bun run test:ci` met database | 2206 geslaagd, 23 overgeslagen, 1 gefaald (2230 tests in 181 bestanden) | 21 s |

De 320 fouten zonder database zijn allemaal "Failed query" op de integratietests plus één
`Cannot find module '@langchain/core/messages'` (agent-langgraph heeft een eigen lockfile). Met de
CI-opzet nagebouwd verdwijnen ze:

```
POSTGRES_PORT=5433 docker compose up -d postgres
(cd agent-bot && bun install --frozen-lockfile)
(cd agent-langgraph && bun install --frozen-lockfile)
export DATABASE_URL=postgres://openbot:openbot@localhost:5433/openbot
(cd server && bunx drizzle-kit migrate --config=drizzle.config.ts)
bun run test:ci
```

Eén test faalt deterministisch op de schone checkout (drie keer herhaald, drie keer rood):
`server/tests/channel-activity.integration.test.ts:347`, "sorts by recency and leaves silent
channels below, not absent". De twee kanalen komen in omgekeerde volgorde terug. Niet gefixt in
stap −1 (regel: noteren, niet fixen). Vermoedelijk tijdstempel-resolutie of sortering op de
lokale Postgres 17-container; nog niet uitgezocht.

De migratie meldde bij het aanmaken van de schone database
`trigger "audit_events_no_truncate" for relation "audit_events" does not exist, skipping`; dat is
een `DROP TRIGGER IF EXISTS` in een upstream-migratie en geen fout.

## Lokaal ontwikkelen

- `origin` wijst naar `https://ZUIDcontent@github.com/AudienceFirst/notos-bots.git`; de gebruikersnaam
  in de URL laat `gh` het juiste account kiezen (er staan meerdere GitHub-accounts op deze machine).
- Poorten zoals upstream: app op 3010, API op 3001. Postgres via Docker op 5433 (zie boven).
