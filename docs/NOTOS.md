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

## Waarom geen Intelligence (stap 0)

OpenBot `d00f65c` weigerde te starten zonder CopilotKit Intelligence (`config.ts` gooide
"CopilotKit Intelligence is required and is not configured"; `copilot.ts` zei letterlijk "There is
no SSE branch"). Drie feiten waarom dat hier weg is:

1. Intelligence bezat de threads, het geheugen en de licentie. De licentie heeft een seat-cap
   (gratis 1, team 5) en een thread-retentie van 72 uur. Voor een klantworkspace is dat geen optie.
2. De runtime zelf kent een tweede modus: `CopilotRuntime` kiest `CopilotSseRuntime` zodra je geen
   `intelligence` meegeeft en neemt een eigen `runner` aan (`options.runner ?? new InMemoryAgentRunner()`).
   De licentiecontrole wordt alleen in de Intelligence-runtime aangemaakt.
3. `AgentRunner` is een abstracte klasse met vier methoden (`run`, `connect`, `isRunning`, `stop`;
   `dist/v2/runtime/runner/agent-runner.d.mts`). Die vier zijn te bouwen op Postgres.

Wat er nu staat:

- `server/src/db/schema/threads.ts`: tabellen `threads` (met `snapshot` = de berichten na de laatste
  run) en `thread_events` (elke AG-UI-gebeurtenis, `seq` per thread). Migratie `0026_threads.sql`.
- `server/src/notos/runner/`: `thread-store.ts` (opslag), `thread-lock.ts` (run-lock als geleasede
  rij in `work_items`, kind `thread-run`), `bus.ts` (`LISTEN/NOTIFY` op `notos_thread`),
  `postgres-runner.ts` (de `AgentRunner`). Eén runner per proces; runtime, routines en hops delen hem.
- `/api/copilotkit/threads/:id/messages` wordt door `app.ts` zelf bediend uit de snapshot. De
  runtime's eigen thread-endpoints eisen een synchrone runner-interface en die kan een database niet
  bieden. `POST /api/threads/mint` maakt nu de rij aan, met de aanvrager als eigenaar.
- Geen geheugen, geen learning. Dat bestond alleen in Intelligence; "geen geheugen" is eerlijk en
  zichtbaar tot een workspace erom vraagt.
- Bewuste afwijkingen van het stapbestand: `threads.id` is `text` (niet `uuid`), omdat
  `intelligence_channel_mappings.thread_id` al tekst is; de momentopname van berichten staat als
  `snapshot` op de thread-rij in plaats van uit events herleid te worden bij elk openen; de lock is
  een lease-rij en geen advisory lock, omdat een advisory lock aan een verbinding hangt en de pool
  die teruggeeft.
- `stop` op een run die op een andere replica draait gaat via de bus; zonder bus meldt hij `false`.

### Controle stap 0 (4 september 2026)

| Controle | Uitkomst |
|---|---|
| `bun run format:check` · `lint` · `typecheck` | groen |
| `bun run test:ci` met database | 2198 geslaagd, 23 overgeslagen, 1 gefaald: dezelfde kanaalvolgorde-test als in de nulmeting |
| `grep INTELLIGENCE_\|COPILOTKIT_LICENSE_TOKEN\|CopilotKitIntelligence\|IntelligenceAgentRunner server/src` | 0 regels |
| Boot met alleen `DATABASE_URL`, `KEY_ENCRYPTION_KEY`, `OPENBOT_SINGLE_USER`, `TENANT_PACKAGE_DIR`, `OPENAI_API_KEY` | start; `/api/capabilities` geeft `mode: "sse"`, `/api/copilotkit/info` toont twee bots |
| `tests/notos/postgres-runner.test.ts` | 20 events, nieuwe runner-instantie, `connect` geeft dezelfde 20 terug; tweede runner op dezelfde thread krijgt "Thread already running"; meekijkende replica ziet de run eindigen |
| `tests/notos/routine-turn-postgres.test.ts` | routine-beurt door de echte runner en lock: antwoord in `thread_events` en in de snapshot, lock vrij, tweede beurt leest de eerste als historie |

Niet gedaan: een routine handmatig laten vuren via `POST /internal/routines/run` tegen een echt
model. Er is geen OpenAI-sleutel in de secrets-index en stap 3 verhuist het model naar Vertex;
de test hierboven dekt hetzelfde pad met een gescripte bot.

## Identiteit: de Supabase-sessie van NOTOS (stap 1)

Iedereen logt in zoals in NOTOS; deze server vertrouwt alleen de Supabase-JWT. Better Auth is weg
(`server/src/auth/index.ts`, de providers in `config.ts`, de `/api/auth/*`-routes). Wat er staat:

- `server/src/notos/auth/supabase-jwt.ts`: `jose` verifieert ES256 tegen de JWKS van het project,
  met `issuer` en `audience` uit `SUPABASE_*`. Zelfde contract als `mge-platform/src/api/auth.py`.
- `server/src/notos/auth/actor.ts`: rol `admin` als `team_members.role = 'administrator'` (PostgREST
  met het token van de beller, dus onder RLS), anders `user`; `isInternal` op `INTERNAL_DOMAINS`;
  rij in `users` (id = Supabase `sub`) en één rol in `user_roles`; 60 s cache per `session_id`.
- `server/src/notos/auth/guard.ts`: `requireUser` en `actorFor`. Token uit `X-Notos-Authorization`,
  anders `Authorization`, en alleen op een WebSocket-upgrade uit `?access_token=`.
- `app/src/notos/supabase.ts`: dezelfde client, URL en publishable key als NOTOS (via
  `/api/capabilities`, niet uit de build) en dezelfde cookie-op-.zuid.com-opslag als NOTOS, zodat
  de sessie onder `notos.zuid.com/bots/` er al is. `client.ts` en de CopilotKit-provider sturen het
  token mee; de twee sockets zetten het in de query. `/sign` zegt alleen "Log in via NOTOS".
- De tabellen `sessions`, `accounts`, `verifications` en `sso_providers` blijven bestaan (foreign
  keys), niets schrijft er nog in. Het identity-providers-scherm in de app is daarmee dood; stap 10.
- `OPENBOT_SINGLE_USER=true` blijft werken voor lokaal ontwikkelen zonder Supabase.

### Controle stap 1 (4 september 2026)

| Controle | Uitkomst |
|---|---|
| `bun run format:check` · `lint` · `typecheck` | groen |
| `bun run test:ci` met database | 2179 geslaagd, 23 overgeslagen, 1 gefaald (dezelfde kanaalvolgorde-test) |
| `grep -rn "better-auth" server/src app/src` | 0 regels |
| Boot met `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` van het NOTOS-project | `/api/capabilities` toont `authProviders: ["notos"]` en de publieke Supabase-waarden |
| `GET /api/me` zonder token · met een zelf-ondertekend ES256-token van een ander project | 401 · 401 |
| `GET /api/me` met een echt NOTOS-token (mitch@zuid.com, uit zijn eigen browser) | `role: "admin"`, `isInternal: true`, naam uit `user_metadata`; rij in `users` + `user_roles` |
| Zelfde token via `X-Notos-Authorization` · `GET /api/admin/status` | 200 · 200 |
| `GET /api/auth/session` | 404 (routes weg) |
| `tests/notos/supabase-jwt.test.ts` · `tests/notos/identity.test.ts` | ES256/issuer/audience/verloop/vreemde sleutel; tokenbron, 401/403, actor op de context |

Niet gedaan: een tweede ZUID-adres zonder beheerdersrol (geen tweede token beschikbaar); de app
tegen de echte sessie draaien (alleen typecheck, stap 4 brengt de inbedding).

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
