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

## Workspaces: NOTOS-klanten, seats uit client_members (stap 2)

- `deployment_packages` is de workspace-tabel: één rij per NOTOS `client_id`, met naam, soort
  (real/demo/onboarding), valuta, `vertex_location`, `default_model`, `drive_root_ids` en `enabled`.
  `agents`, `channels`, `routines`, `threads` en `action_policy` dragen `workspace_id` (migratie
  `0027_workspaces.sql`, met backfill naar het ene pakket dat er was).
- Sync (`server/src/notos/workspaces/sync.ts`): bij boot en elk uur. De klantenlijst komt van
  `GET /api/internal/clients` op mge-cockpit-api, gelezen als `notos-bots@mge-zuid` met een Google
  ID-token (route 1 uit de LEESMIJ; endpoint in `mge-platform/src/api/endpoints/internal_clients.py`,
  nog niet gedeployed). Lokaal: `NOTOS_CLIENTS_FILE` met een JSON-export van dezelfde lijst
  (`.local/clients.json`, gitignored). Een klant die NOTOS niet meer noemt gaat op `enabled=false`.
- Bots per workspace uit `workspaces/<client_id>/` of `workspaces/_default/`, id's met de workspace als
  voorvoegsel (`zoover--media-manager`). `_default/agents.yaml` is gegenereerd uit `AGENT_PERSONAS`
  in mge-platform door `scripts/notos/agents-from-mge.ts`. `examples/fintech` en `TENANT_PACKAGE_DIR`
  zijn weg; het model is deployment-breed (`MODEL_CREDENTIAL_REF`, `MODEL_DEFAULT`) tot stap 3.
- Rechten: `requireWorkspace` (`notos/workspaces/guard.ts`) achter `/api/w/:workspace/...` voor
  channels, routines, agents, route, threads en components; het zet de workspace op de actor en de
  stores filteren erop. Dezelfde routers staan ook op hun oude pad, alleen voor ZUID-adressen; een
  klantgast krijgt daar 403. De CopilotKit-runtime leest de workspace uit de header
  `X-Notos-Workspace` en biedt alleen de bots van die workspace aan. Een gast krijgt zijn workspaces
  uit `client_members` (onder zijn eigen RLS, gefilterd op `notos_tenants.status = 'active'`), een
  ZUID-adres ziet alles. `/api/me` geeft `workspaces: [{ id, notosClientId, displayName, kind, currency, rol }]`.
- App: `/w/:workspace/...` voor alles wat bij een workspace hoort; `client.ts` zet de zes
  workspace-paden automatisch onder `/api/w/<slug>/`; de zijbalk toont de workspace-switcher.
- Niet in deze stap: `action_policy` per workspace in de gateway (kolom bestaat, gateway leest nog
  de deployment-rij; stap 5) en `/admin/people` per persoon de workspaces uit NOTOS (stap 10 raakt
  dat scherm toch).

### Controle stap 2 (4 september 2026)

| Controle | Uitkomst |
|---|---|
| `bun run format:check` · `lint` · `typecheck` · `app build` | groen |
| `bun run test:ci` met database | 2171 geslaagd, 23 overgeslagen, 1 gefaald (bekende kanaalvolgorde-test); app-tests apart 202 geslaagd |
| `tests/notos/workspaces.test.ts` | sync uit een klantenlijst maakt workspaces met geprefixte bots; ZUID ziet alles, gast alleen zijn klant met rol, vreemde niets; guard 403 |
| Boot met `NOTOS_CLIENTS_FILE` (export van de echte lijst) | 12 workspaces gesynchroniseerd, 0 gefaald |
| `/api/w/zoover/agents` · `/api/w/zuid/agents` | zes bots met `zoover--` resp. `zuid--` |
| `/api/w/nope/agents` | 403 "geen toegang tot deze workspace" |
| `POST /api/w/zoover/threads/mint` | rij in `threads` met `workspace_id` van zoover |
| `/api/copilotkit/info` met `X-Notos-Workspace: zoover` · `south` | alleen de bots van die workspace |
| `mge-platform`: `tests/test_internal_clients.py` | 5 geslaagd; ruff schoon |
| `scripts/notos/agents-from-mge.ts` | twee keer draaien identiek |

Niet gedaan: een klantgast lokaal (geen gasttoken; de gastroute is in de test gedekt via
`memberships`); de app in de browser tegen de workspace-routes (typecheck en build wel);
`/api/internal/clients` is niet gedeployed, dus de live sync via ID-token is nog niet
end-to-end getest (het ID-token minten via impersonatie werkt wel).

## Model: Gemini op Vertex AI met ADC (stap 3)

- `server/src/notos/model/vertex.ts`: één `ModelFactory` per proces (`createVertex({ project, location })`
  uit `@ai-sdk/google-vertex`, cache per locatie en model) en een tekst-completer via `generateText`.
- `builtInAgentConfiguration` krijgt de fabriek in plaats van een sleutel en geeft het model als
  `LanguageModel` door (`ModelSpecifier = string | LanguageModel` in `@copilotkit/runtime/agent`);
  de agent-loader joint `deployment_packages` zodat elke bot op de locatie en het model van zijn
  workspace draait. Faalt de fabriek (geen ADC), dan faalt de bot bij de eerste beurt met die reden.
- `routing/model.ts` gebruikt dezelfde fabriek; `/chat/completions` en `OPENAI_BASE_URL` zijn weg.
  In tests krijgt de fabriek een OpenAI-model dat naar de aimock wijst.
- `agent-langgraph`: provider `vertex` (`ChatVertexAI`, `@langchain/google-vertexai`) is de standaard.
- `agent-bot/` (proof-of-concept op OpenAI) is verwijderd, ook uit compose, start.sh en CI.
- Admin › Workspaces (`/api/admin/workspaces`, `PUT …/:id/model`): twee keuzes, EU of global, alleen
  voor een ZUID-beheerder; de wijziging staat in het audit-spoor als `workspace.model_changed`.

### Controle stap 3 (4 september 2026)

| Controle | Uitkomst |
|---|---|
| `bun run format:check` · `lint` · `typecheck` (server, app, worker, agent-langgraph) · app build | groen |
| `grep OPENAI_API_KEY\|GOOGLE_API_KEY server/src agent-langgraph/src` | 0 regels buiten commentaar |
| Boot met ADC van Mitch (`gcloud auth application-default login`), zonder enige modelsleutel | start; `POST /api/w/zuid/route` kiest de SEA Specialist met een reden, geen terugval |
| Chatbeurt via de runtime in workspace zuid (`gemini-2.5-pro`, `europe-west4`) | antwoord "Orchestrator van Managed Growth."; 5 events in `thread_events` |
| `PUT /api/admin/workspaces/<south>/model` naar `global` + `gemini-3.1-pro-preview`, daarna een chatbeurt in south | antwoord op Gemini 3.1 ("…dat ik Gemini ben…"); terug naar EU 200; `us-central1` 400 |
| `agent-langgraph` met `BOT_PROVIDER=vertex` | `/health` meldt provider vertex, een AG-UI-beurt geeft RUN_STARTED…RUN_FINISHED met tekst |
| `tests/copilot.test.ts` · `tool-selection.integration.test.ts` · `compose.test.ts` · agent-langgraph-tests | groen (de aimock spreekt OpenAI; de fabriek geeft de tests een OpenAI-model naar de mock) |

Niet gedaan: een klant-lead die de modelkeuze ziet maar niet kan wijzigen in de app (alleen de
admin-pagina bestaat; de API weigert niet-ZUID met 403). Anthropic op Vertex bewust niet.

## Deployen (stap 4)

Drie commando's, in deze volgorde, altijd eerst staging.

1. **Migratie** (schema `bots_staging` in het NOTOS-Supabase-project, rol `notos_bots`, session-pooler
   poort 5432 omdat `LISTEN/NOTIFY` op de transaction-pooler niet werkt):
   ```
   DATABASE_URL=$(gcloud secrets versions access latest --secret=notos-bots-staging-database-url --project=mge-zuid) \
   DATABASE_SCHEMA=bots_staging bun server/src/notos/migrate.ts
   ```
   Het script herschrijft `"public".` naar het schema en administreert in `<schema>.__drizzle_migrations`.
   Idempotent. Productie: schema `bots` en een tweede secret; nooit automatisch bij boot.
2. **Image en service**:
   ```
   gcloud builds submit --config cloudbuild.yaml --project mge-zuid .
   gcloud run deploy notos-bots-staging --project mge-zuid --region europe-west4 \
     --image europe-west4-docker.pkg.dev/mge-zuid/mge/notos-bots:latest \
     --service-account notos-bots@mge-zuid.iam.gserviceaccount.com --no-allow-unauthenticated \
     --memory 4Gi --cpu 2 --min-instances 0 --max-instances 3 --concurrency 40 --port 3001 \
     --set-env-vars ... --set-secrets ...   (zie de deploy-regel in de terugmelding van stap 4)
   gcloud run services update-traffic notos-bots-staging --region europe-west4 --to-latest
   ```
3. **Worker** (notos-repo, `apps/app`): `BOTS_ORIGIN` in `wrangler.jsonc`, secret `BOTS_INVOKER_KEY`
   (JSON-sleutel van `notos-worker@mge-zuid`, alleen `run.invoker` op de service), dan de gewone
   NOTOS-deploy. De worker stuurt `/bots/*` en `/api/bots/*` door met een Google ID-token en zet het
   Supabase-token van de persoon in `X-Notos-Authorization`.

De app in de image is gebouwd met `VITE_BASE_PATH=/bots/`; rechtstreeks op de Cloud Run-URL werken
de assets dus niet, alleen via de worker. `/api/*` werkt wel rechtstreeks (met een ID-token).

### Controle stap 4 (4 september 2026)

| Controle | Uitkomst |
|---|---|
| `server/src/notos/migrate.ts` lokaal in schema `bots_test` | 36 tabellen, 28 migraties, FK's naar het eigen schema; tweede keer geen wijziging; schema daarna weggegooid |
| Supabase NOTOS-project | rol `notos_bots`, schema's `bots` en `bots_staging`, extensie `vector` in `extensions`; 28 migraties op `bots_staging` (36 tabellen) via de session-pooler (5432) |
| Cloud Build `cloudbuild.yaml` (met `--build-arg TARGETARCH=amd64`) | image `europe-west4-docker.pkg.dev/mge-zuid/mge/notos-bots:latest` |
| Cloud Run `notos-bots-staging` (europe-west4, SA `notos-bots@`, `--no-allow-unauthenticated`, 4Gi/2 cpu, 0–3 instanties) | revisie 00001 Ready, 100 % verkeer |
| Zonder ID-token · met ID-token van `notos-worker@` (run.invoker) | 403 · `/api/capabilities` 200 met `mode: sse`, `authProviders: ["notos"]` |
| `/api/me` en `/api/w/zuid/agents` met alleen het ID-token | 401 "Authentication required." (het Supabase-token van de persoon ontbreekt, zoals het hoort) |
| Boot-log staging | server luistert op 3001; workspace-sync meldt 404 op `/api/internal/clients` (mge-cockpit-api nog zonder dat endpoint), server draait door |

Niet gedaan: de worker-route `/bots` op notos.zuid.com deployen (productie-worker; wacht op een ja van
Mitch en op de JSON-sleutel van `notos-worker@` als worker-secret `BOTS_INVOKER_KEY`); mge-cockpit-api
deployen met `/api/internal/clients` en env `NOTOS_BOTS_AUDIENCE`, waardoor staging nu nog geen
workspaces heeft; de tab "Bots" in NOTOS zichtbaar maken (module en registry staan in de code, beide
repo's niet gedeployed); een echte NOTOS-sessie tegen staging (zonder worker geen zelfde origin);
Cloud Run Job `notos-bots-migrate` (de migratie draait nu vanaf een laptop met het secret).

## Audit na stap 4 (5 september 2026)

Nagelopen tegen de draaiende app; volledige tabel in `~/Code/notos/docs/bouwplan-bots/00-LEESMIJ.md`.
Wat blijvend anders is dan upstream, met de reden:

- `serve({ idleTimeout: 255 })` in `server/src/index.ts`: Bun sluit een response na tien
  seconden zonder bytes. Upstream merkte dat niet, want daar liep elke run over de
  Intelligence-websocket; onze SSE-run (stap 0) brak af zodra Gemini langer nadacht, terwijl
  de events wél in `thread_events` stonden. De stall-guard bewaakt een dode beurt, niet dit.
- `/api/capabilities` meldt `computers` (`config.computer !== undefined`). Zonder computer-provider
  zijn de computer-routes niet gemount; de app pollde ze toch elke drie seconden per open
  kanaal. Nu pollt en toont de app niets over computers als die er niet zijn.
- `shared/bot-prompt.ts` `PROVENANCE_GUIDANCE`: bronvermelding alleen waar iemand op het
  antwoord handelt (cijfer, drempel, deadline, regel van de organisatie), nooit als vaste
  openingszin. "Say so in a line" liet Gemini elk antwoord openen met "Op basis van mijn
  kennis als SEA-specialist.", ook bij gewoon vakadvies.
- Agents-, Skills- en kanaallijst: eerst wat de workspace heeft, persoonlijke items pas als
  ze bestaan; lege staten als één regel. De grote gestreepte boxen van upstream duwden de
  echte inhoud onder de vouw.
- Admin: geen Identity providers in het menu (inloggen is NOTOS, stap 1), geen rol-schakelaar op
  People (de rol komt uit `team_members`); Remove blijft, dat is de enige lokale beslissing.
- App-tekst is Engels, ook de eigen schermen. Eén taal is beter dan twee door elkaar; of de
  hele app Nederlands wordt, is een keuze bij stap 10.
- Testsuite: draai altijd met `DATABASE_URL` naar de Docker-Postgres (5433) en zonder
  draaiende dev-server op diezelfde database. De dev-server veegt anders de handoff-testrijen
  weg (5 rode tests die los groen zijn); zonder `DATABASE_URL` pakt de suite localhost:5432.

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
