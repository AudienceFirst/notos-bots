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

## Gateway en goedkeuring: schrijven alleen na een mens (stap 5)

De NOTOS-regel "agents schrijven nooit direct" staat als beleid, niet als gewoonte.

- **Beleid per workspace** (`server/src/notos/policy/`): `DEFAULT_WORKSPACE_POLICY` is
  `deny: ["mcp.effect == 'write' && !approval.granted"]`, `allow: ["true"]`, `enforce`. Een
  workspace met eigen regels heeft een rij `action_policy` met id `ws:<workspace id>`. De
  plugin-store vraagt het beleid per bot (`policy: ({ botId }) => …`); upstream's
  deployment-brede `policyStore` blijft voor de computer-gateway en het scherm Boundaries.
- **`approval` in `PolicyContext`**: `{ granted }`. Elke andere context (browser, bestand,
  dry-run) draagt een neutrale `{ granted: false }`, anders gooit CEL op een onbekende naam en
  telt een kapotte deny als match voor álles.
- **Tabel `approvals`** (migratie 0028): één open vraag per (bot, tool, sha256 van de
  argumenten met gesorteerde sleutels). Een ja geldt tien minuten en voor precies één aanroep
  (`used_at`); andere argumenten zijn een nieuwe vraag. Geen blanco toestemming per tool.
- **Pad**: write zonder ja → `PluginRefusedError` met tekst `needs_approval:<id> …` en instructie
  aan de bot (zeg in één zin wat je wilt, stop, roep daarna hetzelfde opnieuw aan), auditrij
  `approval.requested`. De transcript tekent uit die tekst een kaart met de argumenten en
  Ja/Nee (`app/src/components/channels/approval-card.tsx`). Ja → `POST
  /api/w/:workspace/approvals/:id/decide` → auditrij `approval.granted` → de kaart spreekt één
  beurt namens de persoon ("Approved: go ahead …", `lib/copilot/turn-bus.ts`) → de bot roept
  opnieuw aan → de gateway laat de call één keer door en zet `used_at`.
- **Wie mag ja zeggen**: rol `zuid` of `lead` op de workspace (`notos/approvals/routes.ts`);
  `specialist`/`viewer` krijgen 403 en de vraag blijft open. Afgedwongen in de route, niet in
  de UI.
- **Onvolledige write** (verplichte argumenten volgens het toolschema ontbreken) is geen vraag
  voor een mens: weigering met wat ontbreekt, vóór er een kaart "zonder details" verschijnt.
  Gemini riep `create_routine` twee keer leeg aan toen de tools in de dev-database nog geen
  schema hadden (`POST /api/plugins/servers/routines/refresh` herstelt dat).
- **Audit naar NOTOS**: `server/src/notos/audit-export.ts` exporteert één dag (UTC)
  `audit_events` + `approvals` naar BigQuery `mge-zuid.marts.bots_audit` (partitie op
  `occurred_at`, `client_id` = NOTOS-klant via bot → workspace), streaming insert met
  `insertId`. Cloud Run Job + Scheduler 02:30 Europe/Amsterdam: `scripts/notos/audit-export-job.sh`.
  `EXPORT_DRY_RUN=1` telt zonder te schrijven.
- **Admin**: Audit heeft filters "Needs approval" en "Approvals" en toont de tool bij
  goedkeuringsrijen; Boundaries legt de workspace-standaard uit. Zonder computer-provider
  (lokaal) is Boundaries leeg, omdat `/api/computers/policy` dan niet gemount is (upstream).
- Gezien, gelaten: de run-assertie voor ingebouwde bots draagt geen thread-id, dus
  `approvals.thread_id` is null in de browserflow; de kaart hangt aan de transcript en heeft
  het niet nodig · elke nieuwe combinatie van argumenten is een nieuwe vraag, ook als alleen
  een `channelId` erbij kwam (bewust: geen blanco toestemming).

## FRIDA per persoon (stap 6)

Catalogusentry `frida`: MCP op `https://frida.zuid.ai/mcp`, `user-oauth` tegen FRIDA's
Supabase-autorisatieserver (`https://grzydenpjgcydxiujyeg.supabase.co/auth/v1`, publieke metadata
uit `/.well-known/oauth-protected-resource`), dynamische clientregistratie zoals Notion, scopes
`openid email offline_access` (het refresh-token rouleert; de store bewaart het in-place onder de
rij-lock), geen revocation-endpoint (loskoppelen verwijdert de credential), `resource` = de MCP.
`plugins/mcp.ts` stuurt een browser-user-agent naar `*.zuid.ai` (Cloudflare 1010). De
workspace-sync (`notos/workspaces/frida-grants.ts`) maakt de serverrij en verleent de FRIDA-tools
aan elke bot in elke workspace; wie niet gekoppeld heeft, wordt door de store gevraagd te koppelen.
Het secret `frida-notos-oauth` van de nachtelijke kopie blijft onaangeraakt.

## Gmail, Shopify, Webflow per persoon (stap 7)

- `gmail`: `plugins/gmail-rest.ts` (search_messages, get_message, get_thread; create_draft en
  send_message als writes). Een send naar een adres buiten `INTERNAL_DOMAINS` wordt een concept
  ("extern: als concept klaargezet"); dat staat in de code, niet in een prompt.
- `shopify`: per shop (`hostPattern` myshopify.com), `plugins/shopify-rest.ts` alleen lezen, token
  in `X-Shopify-Access-Token`. De OAuth-URL's dragen `{host}`; `authForInstance` vult de shop in
  (store bij refresh, routes bij authorize en code-exchange). Vraagt een Shopify-app
  (client-id/secret via `POST /servers/shopify/oauth-client`).
- `webflow`: officiële remote MCP met OAuth en dynamische registratie (`mcp.webflow.com`), een
  MCP-entry zoals Notion. Omdat de toollijst pas na koppelen bekend is, heeft de entry een
  `writeToolPattern` (create/update/delete/publish/…), en `classifyTool` kent dat veld.
- Standaardgrants per bot: FRIDA alles, Gmail-lees, Drive-lees; Shopify en Webflow niets tot een
  admin het aanzet. Koppelingen-scherm in de volgorde FRIDA, Gmail, Drive, Shopify, Webflow.
- Nog nodig: een Google-OAuth-client met redirect-URI
  `https://notos.zuid.com/api/bots/api/plugins/oauth/callback` (Cloud Console) voor Gmail en Drive.

## De Drive-klantenmap (stap 8)

`deployment_packages.drive_root_ids` = `{ roots: [...] }`, gezet in Admin › Workspaces
(`PUT /api/admin/workspaces/:id/drive`, links of ids). De plugin-store geeft de roots van de
workspace van de bot mee aan `google-drive-rest`; die loopt de mappenboom (roots + submappen, 15
minuten cache), zet op elke zoekopdracht een `parents`-clausule en leest een bestand alleen als
een parent in de boom zit. Zonder map: geen zoekopdracht, wel de zin die naar Admin › Workspaces
wijst. De ZUID-workspace heeft de map NOTOS als root.

## Routines op Cloud Scheduler (stap 9)

`worker/` is weg. `POST /internal/routines/sweep` doet één sweep (offer + dispatch, in-process door
de routine-runner) en accepteert het worker-secret of een Google-ID-token van `notos-worker@` of
`notos-bots@` met als audience `OPENBOT_PUBLIC_URL` of `SWEEP_AUDIENCE` (de Cloud Run-URL).
`scripts/notos/sweep-scheduler.sh` maakt de Scheduler-job (elke minuut, `notos-worker@`). Handmatig
testen: `gcloud auth print-identity-token --impersonate-service-account=notos-worker@… --audiences=<Cloud Run-URL> --include-email`;
zonder `--include-email` mist de e-mailclaim en weigert de server (not-a-known-service-account).
`POST /api/w/:workspace/bots/:bot/runs { prompt, channelId? }` start één beurt als de aanroeper;
dat is de deur voor n8n en NOTOS-knoppen (voorbeeld in `docs/routines.md`). De Routines-pagina
maakt een routine aan met presets; `POST /api/w/:workspace/routines`.

## Campagnes, persoonlijke ruimte en leden (5 september 2026)

- **Campagne = ruimte in de workspace.** `campaigns` (migratie 0029): naam, brief, status;
  `channels.campaign_id`; `agents.scope` (`campaign` of `workspace`, uit `agents.yaml`). De
  Campaigns-pagina (`/w/:ws/campaigns`) maakt, bewerkt en archiveert; ZUID en de lead van de klant
  mogen dat, de rest leest. De zijbalk groepeert kanalen per campagne; een nieuw kanaal met een
  campagne-Bot kiest de campagne ("In:"); workspace-Bots (site, shop, CRM, legal, security, UX,
  design) hebben die keuze niet.
- **De brief bereikt de Bot** als systeembericht per run (`setRunContextProvider` →
  `campaignStore.forThread`). Let op: CopilotKit's `BuiltInAgent` laat systeemberichten uit de
  input standaard vallen; `forwardSystemMessages: true` staat daarom in
  `builtInAgentConfiguration`. Elke run logt `{"type":"run-context","threadId":…,"found":…}`.
- **Persoonlijke ruimte.** `/api/me` maakt per persoon een package met `personal_owner_id`
  ("Mijn ruimte", bovenaan de switcher). Alleen de eigenaar krijgt er een rol; beheerders niet;
  de sync raakt haar niet; Admin › Workspaces toont haar niet.
- **Leden.** `workspace_members` (e-mail + rol) op `/api/admin/workspaces/:id/members`; de
  actor-resolver voegt ze bij de rollen uit NOTOS. Beheerder zijn is nog steeds NOTOS'
  `team_members.role = administrator`.

## Connectors-tab (5 september 2026)

`/w/:ws/connectors` toont de hele catalogus per categorie met status en de juiste knop: **Connect**
(user-oauth, server al aan), **Enable** (beheerder, server nog uit), **Set up** (per-instance of
bearer, via Admin › Plugins), **Ask an administrator**, **Built in**. Beeldmerken uit
`@thesvg/react` (`app/src/components/connectors/marks.tsx`). Catalogus +8: HubSpot (geen
dynamische registratie; beheerder registreert een HubSpot-app), Linear, Stripe, Figma, PayPal,
Cloudflare, monday.com, Klaviyo; auth-adressen live gelezen uit de vendor-metadata.

## Modelproviders met API-keys (5 september 2026)

Naast Gemini op Vertex (ADC) kan een workspace op Anthropic, OpenAI, OpenRouter of Google AI Studio
draaien: `deployment_packages.model_provider` + `default_model`, keys in `model_provider_keys`
(migratie 0030) per scope `deployment` (Admin › Models), `workspace` of `personal` (Settings ›
Models, alleen voor de eigen ruimte), verzegeld met `KEY_ENCRYPTION_KEY`. `notos/model/providers.ts`
bouwt het model per (provider, naam, key-vingerafdruk); `notos/model/keys.ts` houdt de keys in
geheugen (boot + elke minuut) en zoekt persoon → workspace → deployment. Een abonnement (Claude
Max, Gemini CLI) is geen key en werkt niet vanaf een server; beide pagina's zeggen dat.

## Eigen AG-UI-laag in de app (stap 10, 5 september 2026)

De browser praat rechtstreeks AG-UI met de runtime, zonder `@copilotkit/react-core`:
`app/src/notos/agui/core.ts` (RuntimeAgent op `@ag-ui/client`, BotsCore met agents per (Bot, thread),
toolregister en de tool-lus) en `app/src/notos/agui/react.tsx` (provider + hooks met de oude
namen: `useAgent`, `useFrontendTool`, `useHumanInTheLoop`, `useRenderTool`, `useRenderToolCall`).
Runtime-routes: `POST /api/copilotkit/agent/:id/run`, `/connect`, `/stop/:thread`. De tool-lus: na
een run worden de tool-calls die de browser bezit uitgevoerd, het resultaat gaat als toolbericht
terug en de Bot loopt door (max 8 rondes); een beslissing wacht op `respond` uit de kaart.
Activiteitsberichten (generative UI, MCP-apps) hebben geen renderer: beide staan uit. Acceptatie:
`grep -rn "@copilotkit" app/src app/package.json` geeft nul regels; geen banner in de DOM.

## Verbindingsbudget op Supabase (5 september 2026)

De session-pooler geeft de rol `notos_bots` 15 clients, en LISTEN dwingt session-modus af
(`runner/bus.ts`, `work/queue.ts`, `computer/policy-listener.ts`, `channels/events.ts`: vier
vaste verbindingen). Gemeten in rust: 14 backends open, want `createDatabase` kreeg geen `max`
(Bun-standaard 10). Sinds commit 30b51b0: `DATABASE_POOL_MAX` wordt echt doorgegeven (staging 3),
idle verbindingen sluiten na 30 s, `--max-instances 2`. Bij een deploy draaien oud en nieuw even
samen; past het niet, dan sluit je vooraf de idle backends van de oude revisie via de Management
API (`select pg_terminate_backend(pid) from pg_stat_activity where usename = 'notos_bots' and state = 'idle'`),
de oude revisie maakt ze op verzoek weer aan. `scripts/notos/deploy-staging.sh` bouwt niet:
eerst `gcloud builds submit --config cloudbuild.yaml --project mge-zuid .`, dan het script.

## Modelkeuze per gesprek (5 september 2026)

In de kanaalheader en op de bot-pagina staat een kleine modelknop. De keuze blijft staan voor dat
kanaal (`channels.model_provider/model_name/model_location`, migratie 0031) of die thread
(`threads.*`, 0032) tot iemand wisselt; null = het model van de workspace. De lijst bevat alleen
wat kan werken: Vertex altijd, Anthropic/OpenAI/OpenRouter/Google AI Studio alleen met een
bereikbare key (`GET /api/w/:ws/models/available`, dezelfde check weigert een keuze zonder key met
409). Iedereen in het kanaal mag wisselen. Per run zoekt `setRunModelProvider` (copilot.ts) het
model van de thread op; de ingebouwde agent wordt dan met dat model herbouwd (`RunBuiltAgent`), de
key-scope blijft die van de workspace, en het log krijgt `{"type":"run-model",…}`. Remote Bots
houden hun eigen model.

## Grok Bot-inhoud (5 september 2026)

Grok Bot bewaart lokaal geen campagne-objecten; uit de gesprekken (20 aug t/m 4 sep) zijn twee
ZUID-campagnes gereconstrueerd en als campagne in workspace `zuid` gezet (lokaal en staging,
`created_by = grok-bot-import`): "Verover je markt (zomercampagne 2026)" en "Lead Dev vacature",
elk met brief, betrokken Bots en de routines die daar draaiden (hier bewust niet aangezet). De
Bot-prompts uit de Grok-roster verwezen naar 30 lokale paden; die staan nu als bestanden in Drive
(map NOTOS › `4 · Bronnen voor Bots`) en de prompts verwijzen daarnaar.

## Twee talen: Nederlands en Engels (6 september 2026)

De interface volgt de persoon: Settings › Preferences › Language (Zelfde als mijn browser,
Nederlands, English), bewaard in `users.locale` (migratie 0033) via `PUT /api/me/locale`; zonder
keuze beslist de browsertaal. De laag zit in `app/src/i18n/`: `I18nProvider` in de root,
`useT()` in componenten, `tr()` erbuiten, `formatDateTime()`; relatieve tijden volgen mee.
Woordenboeken staan per schermgroep in `i18n/en/` en `i18n/nl/` (admin-a, admin-b, settings,
workspace, channels, components, lib, common) met sleutels `<groep>.<bestand>.<naam>`; een
sleutel die in het Nederlands ontbreekt valt terug op Engels en daarna op de sleutel zelf. Nieuwe
tekst = sleutel in beide woordenboeken. Nederlands volgt de ZUID-schrijfwijze (je/jij, geen u,
geen em dash). Bots antwoorden in de taal waarin je schrijft; dat staat los van de interface.

Drie soorten tekst komen niet uit de app zelf maar staan er wel op:

- **De connectorcatalogus** (`server/src/plugins/catalogue.ts`) houdt één Engelse omschrijving per
  connector aan, want die is een gereviewd broncontract en wordt ook buiten de app gelezen. De
  vertaling staat in `i18n/*/connectors.ts` als `connectors.<key>.summary`; een connector die een
  beheerder zelf toevoegt heeft geen sleutel en houdt de tekst van de server. Gebruik
  `useConnectorSummary()` uit `lib/plugins/catalogue-text.ts`, nooit `entry.summary` rechtstreeks.
- **De zinnen die de server bij een fout terugstuurt** (109 stuks) worden opgezocht op de Engelse
  zin zelf, zoals een po-bestand doet: sleutel `server:<de Engelse zin>` in `i18n/*/server.ts`,
  toegepast in `lib/client.ts` via `serverMessage()`. Namen van velden en waarden die een aanroeper
  letterlijk moet meesturen (`public`, `private`, `admin`, `user`, `granted`, `denied`, `true`,
  `false`, `nl`, `en`, `null`) blijven staan: een vertaalde waarde noemt een waarde die niet
  bestaat. Zinnen die de server uit een naam of getal samenstelt hebben geen sleutel en komen in
  het Engels binnen.
- **De meegeleverde componenten in de galerij**: `componentTitle()` en `componentBlurb()` uit
  `lib/copilot/gallery-registry.ts`. De titel volgt de taal; de regel eronder is er een voor de
  lezer in plaats van de instructie voor het model, maar alleen zolang een omgeving de
  omschrijving niet zelf heeft herschreven. Wat een beheerder schrijft, blijft staan zoals het is.

`app/tests/server-messages.test.ts` bewaakt dit: hij leest de servercode en faalt zodra er een zin
of een connector bij komt, verandert of blijft hangen zonder vertaling. Herschrijf je een zin op de
server, dan valt die test om, en dat is de bedoeling.

Let op bij `detectLocale()`: buiten een browser bestaat `navigator` wel maar kent hij geen talen,
dus elke kandidaat wordt eerst op type gecontroleerd. Zonder dat valt elke test om die iets uit
`lib/` importeert.

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

## Tests op een eigen database (6 september 2026)

De launchd-dienst op de Mac gebruikt `openbot` op de docker-Postgres (poort 5433). Tests draaien
op `openbot_test` in dezelfde Postgres: `DATABASE_URL=postgres://openbot:openbot@localhost:5433/openbot_test
bun run test:ci`. Voorheen liepen ze op `openbot` zelf en lieten ze fixtures achter (21
`testRaced_*`-componenten, 16 `@example.test`-gebruikers, 144 credentials) die in Admin › People,
Components en Credentials zichtbaar waren; die zijn op 6 september opgeruimd. Nieuwe migraties ook
op de testdatabase draaien: `DATABASE_URL=…/openbot_test bun server/src/notos/migrate.ts`.

## Lokaal ontwikkelen

- `origin` wijst naar `https://ZUIDcontent@github.com/AudienceFirst/notos-bots.git`; de gebruikersnaam
  in de URL laat `gh` het juiste account kiezen (er staan meerdere GitHub-accounts op deze machine).
- Poorten zoals upstream: app op 3010, API op 3001. Postgres via Docker op 5433 (zie boven).

## Vier dingen uit de Grok Bot-vergelijking (7 september 2026)

Mitch wees op `b-nnett/grok-bot-0.18-reconstructed`, een reverse-engineered reconstructie van
Anysphere's Grok Bot. Daar is geen code uit overgenomen, wel vier patronen.

**Geheimen wegstrepen bij een goedkeuring** (`notos/approvals/redact.ts`). De vraag toont de
argumenten van de aanroep; zat daar een token in, dan stond dat in de tabel en op het scherm. Er
wordt nu weggestreept vóór het opslaan, op veldnaam en op uitgiftevorm. De hash gaat nog over de
échte argumenten, dus een verleende goedkeuring hoort nog bij dezelfde aanroep. Er wordt vervangen,
niet gewist: een onleesbare vraag klikt iemand blind weg.

**`askHandoff`** (`components/gallery/handoff.tsx`). Een Bot die vastloopt op iets dat alleen een
mens kan (een code op je telefoon, een login bij een leverancier) houdt de beurt vast en vraagt
erom. Twee antwoorden: gedaan of overgeslagen. Registreert zichzelf als `kind: "decision"`, net als
`askApproval` en `askChoice`.

**Verbruik per model** (`notos/model/usage.ts`, migratie 0034). Een laagje om het taalmodel heen
telt elke aanroep mee; opgeteld per model op Beheer › Modellen. Tokens, geen euro's: het tarief
staat hier niet. Let op twee dingen bij onderhoud: `wrapLanguageModel` uit de AI SDK werkt alleen op
v3 en onze Vertex-modellen zijn v2 (beide wegen zitten erin), en een insert van drizzle wordt pas
gedaan als er echt op gewacht wordt, dus `void insert().catch()` doet niets.

**Routines op een gebeurtenis** (`routines/on-message.ts`, migratie 0035). Een routine kan starten
als een Bot genoemd wordt of als een woord in een kanaal valt. Zelfde wachtrij en zelfde
afvuurweg als de klok. Twee regels die moeten blijven gelden: alleen een bericht van een mens vuurt
(anders houden twee Bots elkaar aan de gang), en de sleutel draagt het moment van het bericht, zodat
één bericht één run geeft. De sweep kijkt daarom alleen naar `trigger = 'schedule'`.
