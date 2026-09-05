// NOTOS: threads/run-lock in eigen Postgres (stap 0); identiteit is de Supabase-sessie van NOTOS, Better Auth eruit (stap 1).
import { randomUUID } from "node:crypto";
import type { AgentRunnerRunRequest } from "@copilotkit/runtime/v2";
import { serve } from "bun";
import { eq } from "drizzle-orm";
import { COMPUTER_GUIDANCE } from "../../shared/bot-prompt";
import { mintRunAssertion, readRunAssertion } from "./agents/callback-token";
import { createAgentFetch } from "./agents/endpoint";
import { askTheirOwnPerson, escalationTool } from "./agents/escalation";
import { createHandoffDesk, HANDOFF_KIND } from "./agents/handoff";
import { createHandoffDelivery } from "./agents/handoff-delivery";
import { createHandoffRunner } from "./agents/handoff-runner";
import { handoffTool } from "./agents/handoff-tool";
import { createAgentProfileStore } from "./agents/profile-store";
import type { ActorWorkspace, AgentActor } from "./agents/profile-types";
import { createRuntimeAgentLoader } from "./agents/runtime-agents";
import { createApp } from "./app";
import { createAuditReader, createAuditStore, recordAuditEvent } from "./audit";
import { startRetentionSweeps } from "./audit-retention";
import { DEV_ACTOR, initializeDevActorUser } from "./auth/dev-actor";
import { createRoleRepository } from "./auth/guards";
import { createIdentityProviderStore } from "./auth/identity-provider-store";
import type { OpenBotRole } from "./auth/roles";
import {
  createChannelEventHub,
  startChannelActivityListener,
} from "./channels/events";
import { createChannelStore } from "./channels/routes";
import { websocket as channelSocket } from "./channels/socket";
import { createStallGuard } from "./channels/stall-guard";
import { createThreadIdentity } from "./channels/thread-identity";
import { createSandboxedStore } from "./components/sandboxed";
import { createComponentStore } from "./components/store";
import { createComputerGateway } from "./computer/gateway";
import { createApprovalStore } from "./notos/approvals";
import { createWorkspacePolicyStore } from "./notos/policy";
import { createSweepCallerVerifier } from "./notos/routines/sweep-route";
import { dispatchClaimedRoutines, offerDueRoutines } from "./routines/sweep";
import { driveRootsOf } from "./notos/workspaces";
import { campaignPrompt, createCampaignStore } from "./notos/campaigns/store";
import { createMemberStore } from "./notos/workspaces/members";
import { createPageFrameStore } from "./computer/page-frames";
import { startPolicyListener } from "./computer/policy-listener";
import {
  createPolicyStore,
  DEFAULT_ACTION_POLICY,
} from "./computer/policy-store";
import {
  createComputerProvider,
  describeComputerIsolation,
} from "./computer/provider";
import { createSnapshotStore } from "./computer/snapshot-store";
import { loadConfig } from "./config";
import {
  type IdentifyActor,
  mountCopilotRuntime,
  resolveRuntimeAgents,
  type ToolSelection,
  setRunContextProvider,
} from "./copilot";
import {
  createCredentialAdminService,
  createCredentialStore,
} from "./credentials";
import { createDatabase } from "./db/client";
import { createListenClient } from "./db/listen";
import { agents, intelligenceChannelMappings } from "./db/schema";
import {
  createActorResolver,
  createNotosIdentity,
  createSupabaseVerifier,
  type NotosIdentity,
  RevokedError,
} from "./notos/auth";
import { createModelKeyStore, createModels } from "./notos/model";
import {
  createThreadLock,
  createThreadStore,
  PostgresAgentRunner,
  startThreadBus,
} from "./notos/runner";
import {
  clientsFromFile,
  clientsFromNotos,
  createWorkspaceStore,
  createWorkspaceSync,
} from "./notos/workspaces";
import { createOnboardingStore } from "./people/onboarding";
import { createPeopleStore } from "./people/store";
import { useRoutineTools } from "./plugins/builtin-routines";
import { redirectUriFor } from "./plugins/oauth";
import { createPluginStore } from "./plugins/store";
import { grantedSkills, grantedTools } from "./plugins/tools";
import { createTurnRunner } from "./routines/run-turn";
import { createRoutineRunner } from "./routines/runner";
import { createRoutineStore } from "./routines/store";
import { createIntentRouter } from "./routing/classify";
import { createModelCompleter } from "./routing/model";
import { createPackageStatusReader } from "./tenant-package";
import { repeatAfterEach } from "./work/loop";
import {
  createWorkQueue,
  startWorkOfferedListener,
  type WorkOfferedListener,
} from "./work/queue";

/**
 * Who is asking, for a CopilotKit request.
 *
 * One resolver, because a run has two questions to answer about the same person: whose threads and
 * memory these are, and which coworkers they may run. Answering them from different places is how
 * one person ends up running another's private coworker, or reading their thread.
 */
async function resolveRequestActor(request: Request): Promise<{
  id: string;
  name: string;
  role: OpenBotRole;
  workspace?: ActorWorkspace;
}> {
  const actor = config.singleUser
    ? DEV_ACTOR
    : await identity?.actorFor(request).catch((error: unknown) => {
        if (error instanceof RevokedError) return null;
        throw error;
      });
  if (!actor) {
    throw new Error("A CopilotKit run requires a signed-in user.");
  }
  /*
   * NOTOS: the runtime has no `/api/w/:workspace` prefix, so the app names the workspace in a
   * header and the same membership check applies (stap 2). No header means no workspace, which a
   * ZUID caller may do and a client guest may not: the Bots they are offered are filtered on it.
   */
  const slug = request.headers.get("x-notos-workspace")?.trim();
  let workspace: ActorWorkspace | undefined;
  if (slug) {
    const found = await workspaceStore.membership(actor, slug);
    if (!found) throw new Error("geen toegang tot deze workspace");
    workspace = {
      id: found.workspace.id,
      slug: found.workspace.slug,
      role: found.role,
    };
  } else if (actor.isInternal !== true) {
    throw new Error("geen toegang tot deze workspace");
  }
  return {
    id: actor.id,
    name: actor.name ?? actor.email,
    role: actor.role,
    ...(workspace ? { workspace } : {}),
  };
}

/**
 * The authorization projection of the same person: agent visibility is decided from this.
 *
 * An unauthenticated request resolves to a person who owns nothing rather than an error, so the
 * runtime can still describe itself, `/info` reports the licence and the public roster, which is
 * what a deployment check reads to tell "the licence is invalid" apart from "chat is silently
 * broken". It grants nothing: this actor matches no private profile and is not an administrator,
 * and a run still fails in `identifyUser`, which has no anonymous case because a thread must belong
 * to somebody.
 */
const ANONYMOUS_ACTOR = { id: "", role: "user" } as const;

const identifyActor: IdentifyActor = async (request) => {
  try {
    const { id, role, workspace } = await resolveRequestActor(request);
    return { id, role, ...(workspace ? { workspace } : {}) };
  } catch {
    return ANONYMOUS_ACTOR;
  }
};

const config = loadConfig();
// Read with the rest of the configuration, where an empty variable is an absent one. See
// `serverPort` in config.ts for what `process.env.PORT ?? …` did with `PORT=` instead.
const port = config.port;
// NOTOS: a bounded pool (DATABASE_POOL_MAX). Supabase's session pooler allows 15 clients per
// role, and four LISTEN connections (bus, queue, policy, events) sit outside this pool.
const database = createDatabase(config.databaseUrl, {
  max: config.databasePoolMax,
});
/*
 * NOTOS: threads, their events and the run lock live in this database (stap 0). One runner for the
 * process: the runtime runs on it, a routine's headless turn drives it, and a hop between Bots runs
 * through it, so "is somebody already running in this conversation" is one question with one answer.
 * The bus is how a second replica hears about a run here; without it, it polls.
 */
const threadStore = createThreadStore(database);
const threadLock = createThreadLock(database);
const threadRunner = new PostgresAgentRunner({
  threads: threadStore,
  lock: threadLock,
});
// NOTOS: one LISTEN connection for every topic (bus, work, policy, channel activity).
const listenClient = createListenClient(config.databaseUrl);
const threadBus = await startThreadBus(listenClient, database);
threadRunner.attachBus(threadBus);
await initializeDevActorUser(database, config.singleUser);
// The vault, built before the agent store because a customer's agent may sit behind a key and that
// key belongs here rather than on the agent row. See agents/auth-header.ts.
const credentialStore = createCredentialStore(database);
const agentVault = {
  store: credentialStore,
  reader: credentialStore,
  encryptionKey: config.keyEncryptionKey,
};
const agentProfileStore = createAgentProfileStore(
  database,
  config.managedAgent?.endpoint,
  agentVault,
);
/*
 * NOTOS: no tenant package (stap 2). Workspaces come from NOTOS, their Bots from `workspaces/`,
 * and the deployment names its threads after itself. The model is deployment-wide until stap 3.
 */
const threadIdentity = createThreadIdentity(
  config.deploymentId ?? "notos-bots",
);
const deploymentModel = {
  provider: "vertex" as const,
  defaultModel: config.model.defaultModel,
  defaultLocation: config.model.defaultLocation,
};
// NOTOS: Gemini on Vertex AI through ADC; the one factory every Bot, the router and the skill choice use (stap 3).
// NOTOS (5 September 2026): API keys for Anthropic, OpenAI, OpenRouter and Google AI Studio, per
// deployment, workspace or person; read into memory at boot and refreshed every minute.
const modelKeys = createModelKeyStore(database, config.keyEncryptionKey);
await modelKeys.warm().catch((error) => {
  console.warn(
    `model keys could not be read: ${error instanceof Error ? error.message : String(error)}`,
  );
});
modelKeys.startRefresh(60_000);
const modelFor = createModels(
  {
    project: config.model.project,
    location: config.model.defaultLocation,
    name: config.model.defaultModel,
  },
  (provider, scope) => modelKeys.resolve(provider, scope),
);
const workspaceStore = createWorkspaceStore(database);
// NOTOS: campaigns inside a workspace (their brief reaches every run in them) and the members an
// administrator adds on top of what NOTOS says.
const campaignStore = createCampaignStore(database);
const memberStore = createMemberStore(database);
setRunContextProvider(async (threadId) => {
  if (!threadId) return null;
  const campaign = await campaignStore.forThread(threadId);
  return campaign ? campaignPrompt(campaign) : null;
});
const syncWorkspaces = createWorkspaceSync({
  database,
  store: workspaceStore,
  clients: config.workspaces.clientsFile
    ? clientsFromFile(config.workspaces.clientsFile)
    : config.workspaces.notosApiUrl
      ? clientsFromNotos(config.workspaces.notosApiUrl)
      : async () => {
          throw new Error(
            "Set NOTOS_API_URL (the NOTOS API, read as the service account) or NOTOS_CLIENTS_FILE (a JSON export of its client list)",
          );
        },
  packagesRoot: config.workspaces.dir,
  model: {
    credentialSecretRef: "vertex-adc",
    defaultModel: config.model.defaultModel,
  },
});
const channelStore = createChannelStore(
  database,
  agentProfileStore,
  threadIdentity,
);
const channelEvents = createChannelEventHub();
/**
 * Which components each Bot may answer with.
 *
 * Nothing is seeded here. The catalogue is a fact about the build; a fork that ships four components
 * of its own should start with four rows, and the only thing that can enumerate them is
 * the app that compiled them. It announces itself on load; this process learns what exists from that,
 * and owns only what may be done with it.
 */
const componentStore = createComponentStore(database);
// Its own connection is held for the life of the process; announced activity from any instance
// arrives here and is fanned out to connected members.
const channelActivityListener = await startChannelActivityListener(
  listenClient,
  channelEvents,
);
const roleRepository = createRoleRepository(database);
const loadAgentsForActor = createRuntimeAgentLoader(
  database,
  agentVault,
  config.managedAgent,
);
/*
 * At boot, and every hour after. A boot without NOTOS keeps what it had: the workspaces of the last
 * successful sync are still there, and a bots server that refuses to start is worse than one with
 * a list an hour old. The failure is said in the log, not swallowed.
 */
try {
  const report = await syncWorkspaces();
  console.info(JSON.stringify({ type: "workspaces-synced", ...report }));
} catch (error) {
  console.error(
    "[workspaces] could not sync with NOTOS at boot; keeping what is there:",
    error instanceof Error ? error.message : error,
  );
}
/*
 * Built before `auth`, because the deny list is consulted during sign-in and the store is what
 * holds it. It needs the administrator list too, so it can tell the screen which people the
 * deployment's configuration has already decided about.
 */
const peopleStore = createPeopleStore(
  database,
  // NOTOS: no configured administrators; NOTOS' team_members decides, on every request (stap 1).
  [],
  /*
   * Removing somebody retires the credentials they granted this deployment.
   *
   * A closure rather than the method itself, because the plugin store is built further down: this
   * has to exist before `auth` does, and that one needs the vault and the policy. Nothing calls this
   * during module initialisation — it runs when an administrator removes somebody, over HTTP — so by
   * then the binding is there.
   */
  (userId, by) => pluginStore.retireConnectionsFor(userId, by),
);
const identityProviderStore = createIdentityProviderStore(database);
/*
 * Built before `auth` for the same reason the people store is: sign-in writes to the trail, and the
 * store that receives those rows has to exist before anything can sign in.
 */
/*
 * NOTOS: identity is the Supabase session of NOTOS (stap 1). The verifier checks the JWT against
 * the project's public JWKS; the resolver turns it into the actor OpenBot expects, reading
 * `team_members` for the role and writing `users` and `user_roles` so everything upstream keeps
 * working. Absent under OPENBOT_SINGLE_USER, where every visitor is the one administrator.
 */
const identity: NotosIdentity | undefined = config.auth
  ? createNotosIdentity(
      createActorResolver({
        extraMemberships: (email) => memberStore.membershipsFor(email),
        verify: createSupabaseVerifier({
          issuer: config.auth.issuer,
          audience: config.auth.audience,
          jwksUrl: config.auth.jwksUrl,
        }),
        supabaseUrl: config.auth.supabaseUrl,
        publishableKey: config.auth.publishableKey,
        internalDomains: config.auth.internalDomains,
        database,
        isRevoked: (email) => peopleStore.isRevoked(email),
      }),
    )
  : undefined;
const computerProvider = config.computer
  ? createComputerProvider(config.computer)
  : undefined;

if (computerProvider?.warm) {
  void computerProvider.warm();
}
// What Bots may do on their computers. Configuration supplies the deployment's default; an
// administrator can change it while running, and a restart returns to the configured one.
const policyStore = createPolicyStore(
  config.computer?.policy ?? DEFAULT_ACTION_POLICY,
  database,
);
// A boundary an administrator set is read back before the first action is decided, so a restart no
// longer silently returns to the configured default.
const policySource = await policyStore.load();
/*
 * And kept current afterwards.
 *
 * A boundary an administrator changes arrives at one server. Without this, every other server keeps
 * enforcing what it read at boot, so a new deny rule stops roughly one action in N while the screen
 * and the audit row both report success. See policy-listener.ts.
 */
const policyListener = await startPolicyListener(listenClient, policyStore);

/*
 * Record which boundary this process started with.
 *
 * The trail records the boundary a process starts with, so later audit reads can distinguish the
 * configured default from any administrator-updated policy that was persisted before restart.
 *
 * Not awaited and never fatal. A deployment must not fail to start because its audit trail is
 * unavailable, and the row is a note for a reader rather than something the server depends on.
 */
const bootAuditStore = createAuditStore(database);
// One store: the gateway writes through it, a route reads it, and the sweep below takes the old ones out.
const pageFrameStore = createPageFrameStore(database);
// Housekeeping on a schedule: audit rows when asked for, screenshots always, one timer. See audit-retention.ts.
const retentionSweeps = startRetentionSweeps(
  config.databaseUrl,
  config.auditRetentionDays,
  pageFrameStore,
);
const computerGateway = computerProvider
  ? createComputerGateway({
      provider: computerProvider,
      auditStore: bootAuditStore,
      policy: () => policyStore.get(),
      // In Postgres, so the ref a click carries resolves against the snapshot that produced it even
      // when the snapshot was taken by another server. A Map here would be blank on every replica
      // but the one that snapshotted, and the boundary would decide with no element to look at.
      snapshots: createSnapshotStore(database),
      // So wiping a profile takes the pictures of its signed-in pages with it, which is what the
      // sentence on that button already promised.
      pageFrames: pageFrameStore,
      allowPrivateHosts: config.computer?.allowPrivateHosts,
      token: config.computer?.token,
    })
  : undefined;

/**
 * What a Bot can reach beyond its own computer.
 *
 * Built here rather than beside the component store because it needs the policy, and it needs the
 * same policy the computer gateway enforces rather than one of its own. A deployment that has said
 * "this Bot may not change anything in Jira" has said one thing, and it should not matter whether
 * the change would arrive through a browser or through a tool call.
 */
const sandboxedStore = createSandboxedStore(database, bootAuditStore);

/*
 * NOTOS (stap 5): tool calls are judged by the policy of the Bot's workspace, and a write waits for
 * a person. The deployment-wide `policyStore` stays for the computer gateway and the Boundaries
 * screen; a workspace without rules of its own runs on DEFAULT_WORKSPACE_POLICY.
 */
const workspacePolicy = createWorkspacePolicyStore(database);
const approvalStore = createApprovalStore(database);
const workspaceIdOf = async (botId: string): Promise<string | null> => {
  const [row] = await database
    .select({ workspaceId: agents.workspaceId })
    .from(agents)
    .where(eq(agents.id, botId))
    .limit(1);
  return row?.workspaceId ?? null;
};

const pluginStore = createPluginStore({
  database,
  auditStore: bootAuditStore,
  credentials: credentialStore,
  encryptionKey: config.keyEncryptionKey,
  policy: async ({ botId }) =>
    workspacePolicy.policyFor(await workspaceIdOf(botId)),
  approvals: approvalStore,
  workspaceOf: workspaceIdOf,
  driveRootsOf: async (botId) => {
    const workspaceId = await workspaceIdOf(botId);
    if (!workspaceId) return [];
    const workspace = await workspaceStore.byId(workspaceId);
    return driveRootsOf(workspace?.driveRootIds);
  },
  /*
   * Where a vendor sends people back, for a vendor whose client this deployment registers itself.
   *
   * The same value the connect and callback routes build, from the same config field, because it has
   * to match what was registered character for character. Undefined without a public URL, which is
   * the honest state: there is nowhere for a consent flow to come back to, so there is nothing worth
   * registering.
   */
  redirectUri: config.publicUrl ? redirectUriFor(config.publicUrl) : undefined,
});

/**
 * Routines, and the one moment its tools are told what to act on.
 *
 * The builtin transport is reached as a MODULE — `transportFor` maps a kind to one — so there is no
 * constructor to hand a store to and no request-time seam either: the transport registry is built at
 * import time, long before there is a database. So the store is installed here, once, from the place
 * that already owns building stores. Without this call the four tools are advertised and every one of
 * them refuses, which is the honest behaviour for a deployment that never wired it, and would be a
 * silent outage for this one.
 */
const routineStore = createRoutineStore(database);
useRoutineTools(routineStore);

/**
 * Where a Bot handing work to another gets decided.
 *
 * The queue is the one #216 shipped, shared with the idle-computer culler and with routines: durable
 * work claimed by whichever replica gets to it, leased so a dead replica's work comes back. A hop is
 * that, because the Bot being addressed will very likely run on a different pod from the Bot that
 * addressed it, and a hop held in memory is lost the moment either is rescheduled.
 */
const handoffDesk = createHandoffDesk({
  queue: createWorkQueue(database),
  profiles: agentProfileStore,
  // Read per hop and never held, so revoking a grant applies to the next hop rather than after a
  // restart.
  mayAddress: async (fromBotId, toBotId) =>
    (
      await pluginStore
        .botsReachableFrom(fromBotId)
        // A grant that cannot be read is not a grant. Failing closed here costs a hop; failing open
        // would let a Bot address one nobody gave it because the database blinked.
        .catch(() => [] as string[])
    ).includes(toBotId),
  /*
   * Deferred rather than passed directly, because `actorFor` is defined further down with the rest
   * of the run-building collaborators. It is only ever called during a hop, long after this module
   * has finished loading.
   */
  actorFor: (userId) =>
    // Null rather than a throw: see the seam's own note. A role that cannot be read is not a role,
    // and the hop is refused with a sentence rather than ending the run in silence.
    actorFor(userId).catch(() => null),
  auditStore: bootAuditStore,
  caps: config.handoff,
});

void recordAuditEvent(bootAuditStore, {
  eventType: "computer.policy_loaded",
  targetType: "policy",
  payload: {
    ...policyStore.get(),
    source:
      policySource === "the database"
        ? "an administrator, saved in this deployment"
        : config.computer?.policy
          ? "configuration"
          : "the built-in default",
    note:
      policySource === "the database"
        ? "Set while running and kept. A restart returns to this."
        : "The deployment default. Anything an administrator sets from here is kept.",
  },
}).catch(() => undefined);

/*
 * Record whether each Bot has a computer of its own.
 *
 * A shared provider is a fine way to run on a laptop, but the shared isolation state must be visible
 * rather than inferred.
 */
const isolation = describeComputerIsolation(computerProvider);

void recordAuditEvent(bootAuditStore, {
  eventType: "computer.isolation_loaded",
  targetType: "computer",
  payload: {
    isolation: isolation.isolation,
    note: isolation.note,
  },
}).catch(() => undefined);

console.info(
  JSON.stringify({
    type: "computer-isolation",
    provider: computerProvider ? computerProvider.name : "none",
    isolation: isolation.isolation,
    ...(isolation.warning ? { warning: isolation.warning } : {}),
  }),
);
/**
 * One Bot's endpoint must not take down the platform.
 *
 * Restarting a remote agent while a run is in flight resets the socket. The rejection reaches the top
 * of the process, and Bun kills the whole server: every other person's conversation, every other Bot
 * and the admin surface go with it, because somebody redeployed their own agent.
 *
 * That blast radius is created by design the moment people can register their own endpoints,
 * so it belongs to that feature. A remote agent is untrusted infrastructure: it will restart, it will
 * time out, it will close a stream halfway through, and none of that is exceptional.
 *
 * Logged loudly rather than swallowed. A process that hides unhandled rejections is worse than one
 * that dies, so this prints the full reason and keeps serving; what it must never do is stay quiet.
 */
process.on("unhandledRejection", (reason) => {
  console.error(
    JSON.stringify({
      type: "unhandled-rejection",
      message: reason instanceof Error ? reason.message : String(reason),
      code:
        reason && typeof reason === "object" && "code" in reason
          ? String((reason as { code: unknown }).code)
          : undefined,
      note: "The server kept running. A remote agent's connection failing must not stop everyone else.",
    }),
  );
});

/**
 * The watch on Bot streams, built once and shared by every run.
 *
 * It has to outlive the request that opens a stream: the sweep that notices a silent one is still
 * running long after the run request has been answered, because in Intelligence mode that request is
 * answered in about a second and the Bot keeps writing for as long as it has something to say.
 *
 * The same audit store as everything else, so a Bot that hangs is recorded beside what Bots do.
 */
const stallGuard = createStallGuard({
  stallMs: config.agentStallTimeoutMs,
  auditStore: bootAuditStore,
});

const intentRouter = createIntentRouter({
  complete: createModelCompleter({ modelFor }),
});

/**
 * Pass one of tool selection: which skills a message needs, on the deployment's own model.
 *
 * Built once rather than per request, because it holds nothing about a person: the key is resolved
 * on every call, so a credential rotated a moment ago is used by the next run.
 */
const chooseSkills = createModelCompleter({ modelFor });

/*
 * WHY THESE ARE NAMED CONSTANTS RATHER THAN ARGUMENTS WRITTEN INLINE.
 *
 * Two callers now build a Bot: a person's chat request, through `mountCopilotRuntime` below, and a
 * routine's headless turn, through `buildAgentFor` further down. They have to build the SAME Bot. A
 * routine that resolved its tools, its run assertion or its endpoint dialling through a second,
 * slightly different set of collaborators would be a Bot that behaves one way when a person asks and
 * another way at three in the morning, with nothing to point at. So each of these is written once and
 * passed to both.
 */

// Tools run here, not in the browser. Each one still executes through the plugin store, so the
// grant, the policy and the audit row are exactly where they were.
const loadToolsForActor = (actorId: string) => (botId: string) =>
  grantedTools({ store: pluginStore, botId, actorId });

/*
 * What the deployment tells a remote Bot about the run it is starting.
 *
 * Signed here, where the encryption key lives, so the runtime module never holds a secret. The Bot
 * hands this back when it calls a tool, and it is where the Bot id and the person's name come
 * from: its own token proves which agent is calling, this proves who it is calling for, and
 * neither is read out of the request body any more.
 */
const signRunForActor =
  (actorId: string) => (botId: string, runId: string, threadId?: string) =>
    mintRunAssertion(
      { botId, actorId, runId, threadId },
      config.keyEncryptionKey,
    );

/*
 * Which vendors this deployment connects to, held by a Bot or not.
 *
 * A Bot holding no grants used to be told nothing about connectors at all, so it treated a
 * connected vendor as an ordinary website and browsed to it: a Bot with no Drive grant opened
 * Google's sign-in page and asked a person to sign in to an account the deployment had already
 * connected. Naming them lets it say which one it has not been granted instead.
 *
 * Read per request rather than held, because a connector added a minute ago has to count, and
 * failing is the same as having none: a Bot that cannot be told loses a sentence, not a run.
 */
const loadVendors = async () => {
  try {
    return (await pluginStore.listServers()).map((server) => server.id);
  } catch {
    return [];
  }
};

/*
 * How a run's tools are narrowed to the ones it is about.
 *
 * A model picks the right tool reliably out of about ten, and a deployment of this template
 * clears that as soon as it connects a second vendor. Past it the wrong tool gets called, or
 * none does and the answer comes from memory, and neither says so. So a Bot holding more than a
 * handful is offered the tools of the skills that match the message rather than everything at
 * once. See `plugins/selection.ts`.
 *
 * This narrows the offer and nothing else. What a Bot may call is the grant, checked in
 * `callTool` with the policy and the audit row exactly as before, so every path through here can
 * be wrong without a Bot gaining anything. That is also why every failure below is silent and
 * lands on the whole catalogue: the narrowing is worth an accuracy point, never a capability.
 */
const selectionForActor = (actorId: string): ToolSelection => ({
  loadSkills: (botId) => grantedSkills({ store: pluginStore, botId }),
  // The deployment's own model and key, the same pair the intent router uses, so selection is
  // never a second thing to configure. It throws on a missing key, which reads as "could not
  // choose" and leaves the whole catalogue offered.
  choose: chooseSkills,
  record: async (botId, selection) => {
    await recordAuditEvent(bootAuditStore, {
      eventType: "mcp.tools_discovered",
      targetType: "bot",
      targetId: botId,
      actorUserId: actorId,
      payload: {
        bot: botId,
        reason: selection.reason,
        granted: selection.granted,
        offered: selection.offered.length,
        skills: selection.skills,
      },
    });
  },
});

// Every run dials the stored endpoint again, so the check that was applied when it was
// registered has to be applied to wherever it redirects now.
// Absent computer configuration means nothing opted into private hosts, which is the safe
// reading and the same one `createApp` takes.
const agentFetch = createAgentFetch({
  allowPrivateHosts: config.computer?.allowPrivateHosts === true,
  // Named addresses are reachable on every hop, not only the one that was registered.
  allowedHosts: config.agentEndpointAllowedHosts,
  // The refusal is what the run already knows; this is what the deployment knows. Written here
  // rather than in `endpoint.ts` so that file keeps deciding and nothing else, the way the
  // target check it reuses does.
  onRefusal: ({ address, reason }) => {
    void recordAuditEvent(bootAuditStore, {
      eventType: "agent.dial_refused",
      targetType: "agent_endpoint",
      targetId: address,
      payload: { address, reason },
    }).catch((error) => {
      // A trail that cannot be written must not take a refusal down with it: the request is
      // already refused by the time this runs, and the alternative to a logged failure here is
      // an unhandled rejection.
      console.error("Could not record a refused agent dial.", error);
    });
  },
});

/**
 * Who a routine acts as, resolved the way {@link resolveRequestActor} resolves it.
 *
 * THE ROLE IS READ, NOT ASSUMED. Which coworkers exist is decided per person and an administrator
 * sees Bots a user does not, so hardcoding `role: "user"` here would hide an administrator's own Bots
 * from their own routine — the routine would fail with "that Bot is no longer registered" for a Bot
 * sitting in front of them in chat. This asks the same repository the request path asks, so a routine
 * sees exactly the coworkers its owner sees.
 */
const actorFor = async (ownerUserId: string): Promise<AgentActor> => {
  // One person, and they are an administrator. The id stays the routine owner's rather than being
  // rewritten to DEV_ACTOR's: in this mode they are the same person, and if they ever were not,
  // silently borrowing the dev actor's identity would be worse than finding nothing.
  if (config.singleUser) return { id: ownerUserId, role: DEV_ACTOR.role };
  const roles = await roleRepository.rolesForUser(ownerUserId);
  if (!roles.includes("admin") && !roles.includes("user")) {
    throw new Error("A routine requires an authorized owner.");
  }
  return {
    id: ownerUserId,
    role: roles.includes("admin") ? "admin" : "user",
  };
};

/**
 * One Bot, built for a routine's turn, as its owner.
 *
 * Per turn rather than per boot, for the same reason the request path rebuilds: a Bot registered or
 * edited since the last firing has to count, and a private coworker must be absent for everybody but
 * its owner. No header and no request are involved — the owner is asserted by construction, from the
 * routine row — which is the whole point of doing it here rather than adding an impersonation path to
 * a public route.
 */
const buildAgentFor = async ({
  ownerUserId,
  agentId,
}: {
  ownerUserId: string;
  agentId: string;
}) => {
  const owner = await actorFor(ownerUserId);
  /*
   * NOTOS: a routine's turn runs inside the workspace of its Bot (stap 2). Looked up from the Bot
   * rather than trusted from anywhere else, so the roster the owner is offered is that workspace's.
   */
  const [botRow] = await database
    .select({ workspaceId: agents.workspaceId })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);
  const botWorkspace = botRow?.workspaceId
    ? await workspaceStore.byId(botRow.workspaceId)
    : null;
  const actor: AgentActor = botWorkspace
    ? {
        ...owner,
        workspace: {
          id: botWorkspace.id,
          slug: botWorkspace.slug,
          role: "zuid",
        },
      }
    : owner;
  const runtimeAgents = await resolveRuntimeAgents(
    () => loadAgentsForActor(actor),
    deploymentModel,
    modelFor,
    stallGuard,
    loadToolsForActor(actor.id),
    signRunForActor(actor.id),
    config.computer ? COMPUTER_GUIDANCE : undefined,
    loadVendors,
    selectionForActor(actor.id),
    agentFetch,
    undefined,
    // Only the Bot this routine names. Same reason as the hop delivery: the roster is still read in
    // full so a Bot this owner cannot see is still absent, but the other Bots are neither built nor
    // asked what they hold.
    agentId,
  );
  const agent = runtimeAgents[agentId];
  if (!agent) {
    /*
     * Named, and raised rather than swallowed. The routine's Bot was deleted, or made private by
     * somebody else, or the owner lost the role that could see it. The runner turns this into a
     * failed run row with this sentence on it, the first failure is said once in the channel, and
     * the fatigue rule switches the routine off after ten — which is exactly the right handling for
     * a routine pointed at something that is not coming back.
     */
    const error = new Error(
      `That Bot is no longer registered, so this routine has nothing to run: ${agentId}.`,
    );
    error.name = "RoutineBotNotRegistered";
    throw error;
  }
  return agent;
};

// NOTOS (stap 9): one TurnRunner for routines and for a turn started from outside; the same
// runner, store and lock the runtime uses (see notos/runner).
const runTurn = createTurnRunner({
  threads: threadStore,
  lock: threadLock,
  runner: threadRunner,
  buildAgentFor,
});
const routineRunner = createRoutineRunner({
  routineStore,
  channelStore,
  runTurn,
});

/*
 * NOTOS (stap 9): the sweep upstream's worker ran in a loop, as one call. Dispatch is in-process:
 * the runner lives here. Cloud Scheduler calls it every minute with an identity token of one of
 * this deployment's own service accounts; the worker secret still works for a local call.
 */
const sweepQueue = createWorkQueue(database);
const sweepOwner = `routines/${process.env.HOSTNAME ?? randomUUID().slice(0, 8)}`;
const routineSweep = {
  run: async () => {
    const options = {
      routineStore,
      queue: sweepQueue,
      dispatch: (routineRunId: string) => routineRunner.run(routineRunId),
      owner: sweepOwner,
    };
    const offered = await offerDueRoutines(options);
    const dispatched = await dispatchClaimedRoutines(options);
    return {
      considered: dispatched.considered,
      offered: offered.offered.length,
      dispatched: dispatched.fired.length,
      fired: dispatched.fired,
    };
  },
  verifyCaller: createSweepCallerVerifier({
    ...(config.workerSharedSecret
      ? { sharedSecret: config.workerSharedSecret }
      : {}),
    audiences: [
      ...(config.publicUrl ? [config.publicUrl] : []),
      ...(process.env.SWEEP_AUDIENCE ? [process.env.SWEEP_AUDIENCE] : []),
    ],
    serviceAccounts: (
      process.env.SWEEP_SERVICE_ACCOUNTS ??
      "notos-worker@mge-zuid.iam.gserviceaccount.com,notos-bots@mge-zuid.iam.gserviceaccount.com"
    )
      .split(",")
      .map((address) => address.trim())
      .filter(Boolean),
  }),
};
const botVisible = async (actor: AgentActor, botId: string) =>
  (await loadAgentsForActor(actor)).some((agent) => agent.id === botId);

/**
 * The runtime, and the two things beside it a hop needs.
 *
 * `agentFor` builds the addressed Bot exactly the way a person's run builds it, and `history` reads
 * the conversation through the same client. Taken from here rather than assembled again, because a
 * Bot built by parallel wiring drifts the first time one of these arguments changes, and the drift is
 * invisible: it runs, and quietly holds different tools or a different role from the one the person
 * is talking to.
 */
const copilotRuntime = mountCopilotRuntime(
  config,
  deploymentModel,
  loadAgentsForActor,
  modelFor,
  identifyActor,
  stallGuard,
  threadRunner,
  loadToolsForActor,
  signRunForActor,
  undefined,
  loadVendors,
  selectionForActor,
  agentFetch,
  /*
   * What a Bot may reach past itself for: another Bot, and a person. Made per run and per person.
   *
   * Per person because which Bots may be reached is decided against the roster that person can
   * see: a Bot must never be able to address one they cannot, or this becomes a way around agent
   * visibility. Per run because the caps need to know how deep the chain already is and where an
   * answer belongs, and both of those are the deployment's own statement about the run rather than
   * anything the model can edit.
   */
  (actorId) => async (botId, input) => {
    const from = readRunAssertion(
      (input.forwardedProps as { openbotRun?: unknown } | undefined)
        ?.openbotRun,
      config.keyEncryptionKey,
    );
    const run = {
      botId,
      actorId,
      runId: input.runId,
      threadId: input.threadId,
      depth: from?.depth ?? 0,
    };
    /*
     * The caps are checked BEFORE the grants query, not inside the tool that would discard it.
     *
     * `handoffTool` short-circuits on all three of these, but only after being handed a
     * `hasSomebodyToAsk` that costs a query. So a deployment which switched the capability off
     * still paid one grants read per run of every Bot, for a tool it was never going to be offered,
     * and a run already at the cap paid it again.
     */
    const couldHandOn =
      config.handoff.maxDepth > 0 &&
      config.handoff.maxPerRun > 0 &&
      run.depth < config.handoff.maxDepth;

    const passing = couldHandOn
      ? handoffTool({
          desk: handoffDesk,
          /*
           * How deep this run already is comes from the assertion the deployment signed when it handed
           * this work on. A run a person started carries none, and none means zero.
           *
           * NOT `from.botId`. The assertion proves what this run is, and the Bot is whichever one the
           * runtime is building right now: on a hop those agree, and taking the id from the signed
           * value rather than from the build would let a stale assertion aim the next hop at the
           * wrong Bot's grants.
           */
          from: run,
          // Read now rather than at boot, so a grant made a minute ago counts and one revoked a
          // minute ago stops counting.
          hasSomebodyToAsk:
            (
              await pluginStore
                .botsReachableFrom(botId)
                .catch(() => [] as string[])
            ).length > 0,
          maxDepth: config.handoff.maxDepth,
          maxPerRun: config.handoff.maxPerRun,
        })
      : null;
    /*
     * The way to stop and ask is offered whether or not there is a Bot to hand to.
     *
     * It is the cheaper of the two and the one a Bot should reach for first: asking the person who
     * is already in the conversation spends nothing and cannot be aimed anywhere they cannot see.
     * A deployment that offered only the expensive exit would push every unanswerable question
     * sideways into another run.
     */
    const asking = escalationTool({
      from: run,
      route: askTheirOwnPerson,
      auditStore: bootAuditStore,
    });
    return passing ? [passing, asking] : [asking];
  },
  // A run started or ended on a thread; light the channel it belongs to. Fire-and-forget, keyed by
  // thread, and a scratch thread maps to no channel and signals nowhere.
  (input) => {
    void channelStore.signalBusy(input.threadId, input.busy).catch(() => {});
  },
);

/**
 * Delivering hops, on every replica.
 *
 * A loop rather than a schedule, because a hop is somebody waiting for an answer rather than
 * housekeeping: the culler's minute-granularity CronJob would be an unexplainable pause in a
 * conversation. Every replica sweeps, and the queue decides which of them gets which hop, so adding a
 * replica adds delivery capacity rather than contention.
 *
 * Only where the capability is switched on. A deployment with a depth cap of zero never has a hop to
 * deliver, and a loop polling for work that cannot exist is a query a second for nothing.
 */
/*
 * Both zeros switch the capability off, so both have to stop the loop.
 *
 * Gated on the depth alone, a deployment that set the fan-out cap to zero still swept every two
 * seconds for hops that can never be offered: roughly forty thousand claim transactions per replica
 * per day, for a feature it had turned off.
 */
/**
 * The queue's own wake-up, when handing work between Bots is switched on at all.
 *
 * Held at module scope so the shutdown below can give its connection back. Undefined on a
 * deployment with the capability off, which is a deployment that never started one.
 */
let workOfferedListener: WorkOfferedListener | undefined;

if (config.handoff.maxDepth > 0 && config.handoff.maxPerRun > 0) {
  const runner = createHandoffRunner({
    queue: createWorkQueue(database),
    owner: `handoff/${process.env.HOSTNAME ?? randomUUID().slice(0, 8)}`,
    auditStore: bootAuditStore,
    /*
     * The signed statement of the run the addressed Bot is about to start, carrying how deep the
     * chain has gone. Minted here, where the key lives, and one deeper than the run that asked.
     */
    sign: (work) =>
      mintRunAssertion(
        {
          botId: work.toBotId,
          actorId: work.actorId,
          runId: randomUUID(),
          threadId: work.threadId,
          depth: work.depth,
        },
        config.keyEncryptionKey,
      ),
    delivery: createHandoffDelivery({
      /*
       * Built as the person, WITH THEIR ROLE. The desk resolved it to decide the hop was allowed; a
       * delivery that then rebuilt them as an ordinary user could not find the Bot the desk had just
       * agreed to, and the person was told it never answered.
       */
      agentFor: async ({ actorId, botId }) => {
        const actor = await actorFor(actorId).catch(() => null);
        if (!actor) {
          throw new Error(
            "who this is for could not be confirmed, so the Bot was not run",
          );
        }
        return copilotRuntime.agentFor({ actor, botId });
      },
      history: copilotRuntime.history,
      lock: copilotRuntime.threadLock,
      /*
       * A scratch thread of the addressed Bot's own, one per hop.
       *
       * An Intelligence thread has exactly one agent, so a second Bot cannot answer inside the first
       * Bot's conversation however it asks. Its turn runs here instead, unmapped to any channel, and
       * what it said comes back to the conversation that asked through the relay — in the asking
       * Bot's voice, which is the only voice that thread admits. Minted with the deployment's own
       * identity, like every thread this deployment starts.
       */
      mintThreadId: () => threadIdentity.mint(),
      /*
       * The roster, told that a relayed answer landed. The delivery knows only the thread it ran
       * in; this resolves which channel shows that thread — a scratch thread maps to nothing and
       * announces nowhere, which is the point of a scratch thread.
       */
      announce: async (input) => {
        const [mapped] = await database
          .select({ channelId: intelligenceChannelMappings.channelId })
          .from(intelligenceChannelMappings)
          .where(eq(intelligenceChannelMappings.threadId, input.threadId))
          .limit(1);
        if (!mapped) return;
        const actor = await actorFor(input.actorId).catch(() => null);
        if (!actor) return;
        await channelStore.recordActivity(actor, mapped.channelId, {
          text: input.text,
          agentId: input.agentId,
          at: new Date(),
        });
      },
      // The asking conversation shown as working while a hop runs in it. Keyed by thread, resolved
      // to its channel by the store; a scratch thread maps to none and signals nowhere.
      setBusy: (input) => channelStore.signalBusy(input.threadId, input.busy),
      newRunId: () => randomUUID(),
      // The same runner the runtime runs on, so a hop takes the lock a person's turn takes. The
      // delivery types its request loosely (`input: unknown`) so it needs no runtime import; the
      // runner's own request type is what actually arrives.
      runner: {
        run: (request) =>
          copilotRuntime.runner.run(request as AgentRunnerRunRequest),
      },
    }),
  });

  const sweep = async () => {
    try {
      const report = await runner.sweep();
      if (report.delivered.length > 0 || report.skipped.length > 0) {
        console.info(JSON.stringify({ type: "bot-handoff", ...report }));
      }
    } catch (error) {
      // A sweep that failed must not take the loop with it: the next one may find the database back.
      console.warn(
        "[handoff] a sweep could not run:",
        error instanceof Error ? error.message : error,
      );
    }
  };

  /*
   * ONE SWEEP AT A TIME ON THIS REPLICA, from both callers below. A sweep poked while one is
   * running is remembered rather than started, and runs once the current one ends — a wake-up
   * that arrived mid-sweep may be for a hop the running sweep's claim already missed.
   */
  let sweeping = false;
  let sweepAgain = false;
  const kick = async () => {
    if (sweeping) {
      sweepAgain = true;
      return;
    }
    sweeping = true;
    try {
      do {
        sweepAgain = false;
        await sweep();
      } while (sweepAgain);
    } finally {
      sweeping = false;
    }
  };

  /*
   * Woken by the queue itself, from any replica: a person is waiting through every hop, and the
   * poll below would spend up to two seconds per leg doing nothing. The poll stays as the
   * backstop — a notification is a latency optimisation, and one lost in transit costs one
   * interval, never the work. See repeatAfterEach for why an interval must not be used: an
   * interval would start another sweep every two seconds while a five-minute delivery runs, each
   * claiming a different batch, and this replica's concurrent agent runs would grow with the
   * backlog rather than stopping at the limit it was asked for.
   */
  workOfferedListener = await startWorkOfferedListener(listenClient, (kind) => {
    if (kind === HANDOFF_KIND) void kick();
  });
  repeatAfterEach(kick, 2_000);
}

/*
 * And dropping the hops that are over, whether or not the capability is switched on.
 *
 * OUTSIDE THE GATE ABOVE, deliberately. A deployment that switches handing work off still has
 * whatever it made while it was on, and rows that stop being reaped are rows that stay at the head
 * of the queue: switched back on a month later, the first thing that happens is a month-old question
 * being delivered to somebody who has long since stopped waiting. Reaping is housekeeping about the
 * past rather than part of the feature.
 *
 * Every replica reaps; the statement is a delete by age, so two doing it is the same as one doing it.
 * Its own loop rather than a phase of the sweep, so an hour of failing to reap never delays an answer.
 */
// NOTOS: workspaces follow NOTOS every hour (stap 2). A failed sync keeps what is there.
repeatAfterEach(
  async () => {
    try {
      const report = await syncWorkspaces();
      if (report.failed.length > 0 || report.disabled > 0) {
        console.info(JSON.stringify({ type: "workspaces-synced", ...report }));
      }
    } catch (error) {
      console.warn(
        "[workspaces] hourly sync with NOTOS failed; keeping what is there:",
        error instanceof Error ? error.message : error,
      );
    }
  },
  60 * 60 * 1_000,
);

const reaper = createHandoffRunner({
  queue: createWorkQueue(database),
  owner: `reaper/${process.env.HOSTNAME ?? randomUUID().slice(0, 8)}`,
  sign: () => "",
  auditStore: bootAuditStore,
  // Never called: `reap` deletes rows by age and claims nothing.
  delivery: {
    deliver: async () => {
      throw new Error("the reaper does not deliver hops");
    },
  },
});
repeatAfterEach(
  async () => {
    try {
      const purged = await reaper.reap();
      if (purged > 0) {
        console.info(JSON.stringify({ type: "bot-handoff-reaped", purged }));
      }
    } catch (error) {
      console.warn(
        "[handoff] hops that are over could not be dropped:",
        error instanceof Error ? error.message : error,
      );
    }
  },
  60 * 60 * 1_000,
);

const app = createApp(
  config,
  identity,
  roleRepository,
  createAuditReader(database),
  createCredentialAdminService(
    config.keyEncryptionKey,
    credentialStore,
    createAuditStore(database),
  ),
  createPackageStatusReader(database),
  // The runtime call: the model, per-actor agent loading, and the two identity
  // functions are how a run is attributed to a person.
  copilotRuntime.handler,
  // The only path to an acting call.
  computerGateway,
  policyStore,
  // Bots as durable objects, and the channels they run in.
  agentProfileStore,
  channelStore,
  channelEvents,
  // The same store the boot row uses, so a Bot's own refusal lands in the trail beside its actions.
  bootAuditStore,
  componentStore,
  // MCP servers and packaged skills. Judged by the same policy the computer actions are, read
  // fresh on every call for the same reason: a rule added a moment ago applies to the next call.
  pluginStore,
  // Components authored in the browser. Their governance is the component store's; this owns only
  // the source, which is the part a rebuild would otherwise have owned.
  sandboxedStore,
  // How a thread that has no channel is named, so the direct Bot chat is in the same namespace.
  threadIdentity,
  // Who has signed in, and what an administrator may do about them.
  peopleStore,
  // The enterprise identity providers registered here. Read as facts about the deployment rather
  // than through Better Auth's own listing, which answers per person. See identity-provider-store.ts.
  identityProviderStore,
  // Chooses the coworker for an untagged message, on the deployment's own model and key.
  intentRouter,
  // What a browsing turn's screen looked like when it finished, so the transcript can show it later.
  pageFrameStore,
  // What a due routine actually does: a turn, run as its owner, into the thread they will open.
  routineRunner,
  // A person's own standing instructions: the list, and a switch to stop one.
  routineStore,
  // Where each person is in first-run onboarding, read by /api/me and written by the wizard.
  createOnboardingStore(database),
  // NOTOS: where threads live: the mint route, the status check and the history route read it.
  threadStore,
  // NOTOS: workspaces, and who may enter them (stap 2).
  workspaceStore,
  // NOTOS: where a person says yes or no to a Bot's write (stap 5).
  approvalStore,
  // NOTOS (stap 9): the sweep for Cloud Scheduler, and one turn from outside.
  routineSweep,
  runTurn,
  botVisible,
  // NOTOS: campaigns and workspace members.
  campaignStore,
  memberStore,
  // NOTOS: API keys for keyed model providers.
  modelKeys,
);

/**
 * The live screen, proxied.
 *
 * Proxied rather than connected directly. `agent-computer` authenticates its callers with a
 * shared token, not with a person's session, and it must never be reachable from a browser. So the
 * socket terminates here, behind the same session guard as every other route, and this process opens
 * a second socket inward carrying the token.
 *
 * Not a Hono route because an upgrade is not a request/response: Bun hands it over before Hono sees a
 * body, so it is handled in `fetch` ahead of the app.
 */
const toStreamUrl = (baseUrl: string, botId: string) =>
  // The Bot travels in the query, because a websocket upgrade carries no custom header for the
  // computer to read and every call it serves is per Bot. The secret travels the same way and for the
  // same reason, this socket is the one a person can type into, so it is the last thing that should
  // be reachable without it.
  `${baseUrl.replace(/^http/, "ws").replace(/\/$/, "")}/stream?bot=${encodeURIComponent(botId)}&token=${encodeURIComponent(config.computer?.token ?? "")}`;

/**
 * Which Bot's screen. The Bot is named in the path and its computer is located the same way every
 * other call locates it, so the live stream cannot point at a different Bot's browser.
 */
const streamPathBotId = (pathname: string): string | null => {
  const match = pathname.match(/^\/api\/computers\/([^/]+)\/stream$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
};

/** What each proxied socket carries: where to connect inward, and the socket once opened. */
type StreamData = { upstream: string; inward?: WebSocket };

/**
 * Bun takes exactly one WebSocket handler for the server, and two features need one: the app proxies
 * the computer stream, and it pushes channel activity through Hono's adapter. So this one
 * dispatches on what the upgrade attached, a proxy socket carries `upstream`, a Hono socket does
 * not, rather than either feature quietly taking the slot and breaking the other on connect.
 */
type ChannelSocket = Parameters<typeof channelSocket.open>[0];
type SocketData = StreamData | ChannelSocket["data"];

const isProxiedStream = (data: SocketData): data is StreamData =>
  typeof (data as StreamData).upstream === "string";

// Hono owns the socket's data once it has upgraded it; this hands its own back to it.
const asChannelSocket = (ws: { data: SocketData }) =>
  ws as unknown as ChannelSocket;

serve<SocketData>({
  port,
  /*
   * NOTOS: a run streams over SSE now (stap 0) and a model may think longer than Bun's default of
   * ten seconds before its first token; Bun then closes the response and the browser sits on
   * "Thinking" for ever. 255 is Bun's maximum. The stall guard, not this, is what ends a dead turn.
   */
  idleTimeout: 255,
  async fetch(request, server) {
    const url = new URL(request.url);
    const streamBotId = streamPathBotId(url.pathname);
    if (
      streamBotId !== null &&
      request.headers.get("upgrade")?.toLowerCase() === "websocket"
    ) {
      if (!config.computer) {
        return new Response("No computer is configured.", { status: 503 });
      }
      // The session guard, applied by hand because middleware does not run on an upgrade. An
      // unauthenticated socket here would be the whole point of the proxy defeated.
      const actor = await resolveRequestActor(request).catch(() => null);
      if (!actor) {
        return new Response("Sign in first.", { status: 401 });
      }
      // And which Bot, which the guard above does not answer. This socket carries that Bot's screen,
      // so signing in is not enough: without this, anybody signed in watches anybody's Bot work.
      if (
        !(await agentProfileStore
          .get({ id: actor.id, role: actor.role }, streamBotId)
          .catch(() => null))
      ) {
        return new Response("There is no such Bot.", { status: 404 });
      }
      /*
       * Through the gateway, not the provider.
       *
       * `gateway.locate` runs checkComputerAddress; `provider.locate` does not, and the URL built
       * below carries COMPUTER_TOKEN in its query string. A provider that answered with a foreign
       * host was handed the deployment's computer token, which is the case that check was written
       * for. Every acting path already went through the gateway; this one did not.
       */
      let upstream: string;
      try {
        const streamBase = computerGateway
          ? await computerGateway.locate(streamBotId)
          : undefined;
        if (!streamBase) {
          return new Response("No computer address is configured.", {
            status: 503,
          });
        }
        upstream = toStreamUrl(streamBase, streamBotId);
      } catch (error) {
        // Said out loud rather than falling back to another Bot's computer, which is the failure this
        // whole path exists to prevent.
        return new Response(
          error instanceof Error
            ? error.message
            : "That Bot's computer could not be reached.",
          { status: 502 },
        );
      }
      if (server.upgrade(request, { data: { upstream } })) {
        return undefined as unknown as Response;
      }
      return new Response("Expected a WebSocket upgrade.", { status: 400 });
    }
    return app.fetch(request, { server });
  },
  websocket: {
    open(ws) {
      if (!isProxiedStream(ws.data)) {
        channelSocket.open(asChannelSocket(ws));
        return;
      }
      const inward = new WebSocket(ws.data.upstream);
      ws.data.inward = inward;
      // Frames outward, input inward. Buffered by neither side: a frame the browser is too slow for
      // should be dropped, not queued, because a stale frame is worse than a missing one.
      inward.onmessage = (event) => {
        try {
          ws.send(String(event.data));
        } catch {
          inward.close();
        }
      };
      inward.onclose = () => ws.close();
      inward.onerror = () => ws.close();
    },
    message(ws, raw) {
      if (!isProxiedStream(ws.data)) {
        channelSocket.message(asChannelSocket(ws), raw);
        return;
      }
      if (ws.data.inward?.readyState === 1) ws.data.inward.send(String(raw));
    },
    close(ws, code, reason) {
      if (!isProxiedStream(ws.data)) {
        channelSocket.close(asChannelSocket(ws), code, reason);
        return;
      }
      ws.data.inward?.close();
    },
  },
});

if (config.singleUser) {
  // Loud, every boot. A server that is not checking who is asking should never be a quiet default.
  console.warn(
    "No identity provider is configured, so every request is treated as " +
      `${DEV_ACTOR.email} (administrator). Configure GOOGLE_OAUTH_*, ` +
      "MICROSOFT_OAUTH_* or OKTA_OAUTH_* before anybody else can reach this.",
  );
}

// Each listener holds a connection of its own for the life of the process. Released on the way out,
// so a watch-mode restart does not leave two behind on every reload.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void Promise.allSettled([
      channelActivityListener.stop(),
      policyListener.stop(),
      // Started only where handing work between Bots is switched on, so it is often not there.
      workOfferedListener?.stop() ?? Promise.resolve(),
      Promise.resolve(retentionSweeps.stop()),
    ]).finally(() => process.exit(0));
  });
}

console.info(`OpenBot server listening on http://localhost:${port}`);
