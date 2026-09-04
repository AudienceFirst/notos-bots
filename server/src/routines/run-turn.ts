// NOTOS: herschreven tegen de eigen thread-opslag en run-lock; de Intelligence-client en de ɵ-lockmethoden zijn weg (stap 0).
/**
 * One headless turn, run into the thread the person will open.
 *
 * WRITTEN AGAINST `@copilotkit/runtime` 1.69.0, MIRRORING
 * `node_modules/@copilotkit/runtime/dist/v2/runtime/core/channel-manager.mjs:189-316`
 * (`runCanonicalChannelAgent`, the package's own module-private headless-turn engine). That engine
 * is not exported, so this is a hand copy of it with one addition, `threads.ensure` first, and it
 * has to be re-read against the package whenever the runtime is upgraded.
 *
 * WHAT IS OURS HERE. Upstream drove the Intelligence runner and reached into five `ɵ`-prefixed
 * platform methods for the thread and its lock. Those are gone: the thread is a row in our own
 * `threads` table, the history is the snapshot that row keeps, and the lock is a leased row in
 * `work_items` (`notos/runner/thread-lock.ts`). The runner is our `PostgresAgentRunner`, which
 * takes the same lock again under the same run id and is not refused by it.
 *
 * THE LOCK LIFECYCLE IS OURS TO KEEP CORRECT. In the browser path the runner holds the lock and
 * releases it; here we take it first, so we release it too. A bug in it is not a failed routine, it
 * is a thread the person cannot chat in until the lease lapses; see the `finally` block, which is
 * the single most important thing in this file.
 */
import type {
  AbstractAgent,
  BaseEvent,
  Message,
  RunAgentInput,
} from "@ag-ui/client";
import { EventType } from "@ag-ui/client";
import { sanitizeSeededHistory } from "../agents/history-sanitize";
import type { TurnRunner } from "./runner";

/**
 * The gap between stopping a turn and giving up on it.
 *
 * `abortRun` on `RunSelectedAgent` reaches the agent the run turned into, and that agent does not
 * exist until `build()` resolves (`copilot.ts`): during that window the wrapper has no `inner`, so
 * abort is a no-op and the deadline cannot actually stop anything. This is the backstop that
 * settles the promise anyway, so a firing cannot hang for ever on a build that never finishes.
 *
 * Injectable only so the test can exercise the backstop without waiting five real seconds for it.
 */
const DEFAULT_ABORT_GRACE_MS = 5_000;

/** How long one headless turn may take before it is stopped. */
const DEFAULT_TURN_TIMEOUT_MS = 5 * 60_000;

/**
 * The lock TTL and how often it is renewed.
 *
 * Renew comfortably inside the TTL so one slow request does not drop a lock we still hold. The TTL
 * matters to a person: while it is held, their browser's next message is refused, so a lock leaked
 * by a failed routine locks them out of their own conversation for exactly this long.
 */
const DEFAULT_LOCK_TTL_SECONDS = 20;
const DEFAULT_HEARTBEAT_MS = 15_000;

/**
 * One stored message, loosely typed.
 *
 * The snapshot our store keeps is AG-UI shaped already, but history that came out of Intelligence
 * before the switch (or a store written by a client in that dialect) carries tool calls as
 * `{ id, name, args }`. Both are accepted and normalised in {@link toAgentMessage}.
 */
export type StoredMessage = {
  id: string;
  role: string;
  content?: unknown;
  activityType?: string;
  toolCalls?: readonly (
    | { id: string; name: string; args: string }
    | {
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }
  )[];
  toolCallId?: string;
};

/** The thread store, named by the two methods this file calls. */
export type ThreadsLike = {
  ensure(input: {
    id: string;
    ownerUserId?: string;
    agentId?: string;
  }): Promise<void>;
  messages(threadId: string): Promise<readonly StoredMessage[]>;
};

/** The run lock, named by the three methods this file calls. See `notos/runner/thread-lock.ts`. */
export type LockLike = {
  acquire(input: {
    threadId: string;
    runId: string;
    userId?: string;
    agentId?: string;
    ttlSeconds?: number;
  }): Promise<boolean>;
  renew(input: {
    threadId: string;
    runId: string;
    ttlSeconds?: number;
  }): Promise<boolean>;
  release(input: { threadId: string; runId: string }): Promise<void>;
};

/**
 * What we subscribe to. Declared rather than imported as `Observable<BaseEvent>` so a fake is a plain
 * object; the real observable satisfies it.
 */
type EventStream = {
  subscribe(observer: {
    next: (event: BaseEvent) => void;
    error: (error: unknown) => void;
    complete: () => void;
  }): unknown;
};

/** The runner, named by the two methods this file calls. */
export type RunnerLike = {
  run(request: {
    threadId: string;
    agent: AbstractAgent;
    input: RunAgentInput;
    persistedInputMessages?: Message[];
  }): EventStream;
  stop(request: {
    threadId: string;
    runId?: string;
  }): Promise<boolean | undefined>;
};

/**
 * One stored row as an AG-UI message.
 *
 * `content ?? ""` because a tool-call-only assistant row may omit content and AG-UI requires the
 * field; `{ id, name, args }` tool calls are re-nested into AG-UI's `{ id, type: "function",
 * function: { name, arguments } }`, and ones already in that shape pass through; `toolCallId` is
 * carried so a tool result in history still points at the call it answers.
 *
 * Cast at the end because the store types `role` as `string` and `content` as `unknown`, while
 * `Message` is a union discriminated on `role`. The store is the authority on its own history.
 */
function toAgentMessage(message: StoredMessage): Message {
  return {
    id: message.id,
    role: message.role,
    content: message.content ?? "",
    ...(message.activityType ? { activityType: message.activityType } : {}),
    ...(message.toolCalls
      ? {
          toolCalls: message.toolCalls.map((call) =>
            "function" in call
              ? call
              : {
                  id: call.id,
                  type: "function",
                  function: { name: call.name, arguments: call.args },
                },
          ),
        }
      : {}),
    ...(message.toolCallId ? { toolCallId: message.toolCallId } : {}),
  } as Message;
}

/**
 * Re-exported from `agents/history-sanitize.ts`, where it lives, because a chat turn needs it too.
 * Kept as a name on this module because the tests that cover the seeding path reach for it here.
 */
export { sanitizeSeededHistory };

/** What a message said out loud, or nothing if it did not say anything. */
function assistantText(message: Message): string | undefined {
  if (message.role !== "assistant") return undefined;
  const { content } = message;
  return typeof content === "string" && content.length > 0
    ? content
    : undefined;
}

/**
 * The stored instruction, wrapped in the sentences that tell the turn it IS a firing.
 *
 * FOUND ON A LIVE FIRING, and it recorded `succeeded`. The instruction read "Every run, append the
 * current date and time as a new bulleted list item to the Notion page …" and was sent to the model
 * verbatim as the turn's user message. The model read it as a question about routine MANAGEMENT
 * rather than as work: it called `list_routines`, found a routine that already said exactly that,
 * answered that it was already configured, and appended nothing. Nothing failed, so nothing was
 * reported.
 *
 * Instructions are WRITTEN in schedule-speak because that is how a person asks for a standing thing,
 * and schedule-shaped prose arriving out of nowhere reads as a request to SET UP a schedule. So the
 * frame says the three things the instruction cannot say about itself: that this is a scheduled
 * firing happening now, that the work belongs in this turn, and that managing routines is not what
 * was asked.
 *
 * ONLY THE NEW MESSAGE IS FRAMED. The framed text is what the transcript keeps, so it comes back as
 * HISTORY on the next firing, and history is seeded exactly as stored; a test holds that.
 */
export function frameFiring(instruction: string): string {
  return [
    "One of your routines is firing right now, on its schedule, and this is that firing.",
    "Carry out the instruction below in this turn: do the work now, then say what happened.",
    "Do not create, list or change any routine unless the instruction itself asks you to.",
    "",
    instruction,
  ].join("\n");
}

export function createTurnRunner(options: {
  threads: ThreadsLike;
  lock: LockLike;
  runner: RunnerLike;
  /** The owner's coworkers, resolved as the owner. Built per turn, keyed by registry id. */
  buildAgentFor: (input: {
    ownerUserId: string;
    agentId: string;
  }) => Promise<AbstractAgent>;
  /** How long one headless turn may take before it is stopped. */
  turnTimeoutMs?: number;
  lockTtlSeconds?: number;
  heartbeatMs?: number;
  /** See {@link DEFAULT_ABORT_GRACE_MS}. */
  abortGraceMs?: number;
}): TurnRunner {
  const {
    threads,
    lock,
    runner,
    buildAgentFor,
    turnTimeoutMs = DEFAULT_TURN_TIMEOUT_MS,
    lockTtlSeconds = DEFAULT_LOCK_TTL_SECONDS,
    heartbeatMs = DEFAULT_HEARTBEAT_MS,
    abortGraceMs = DEFAULT_ABORT_GRACE_MS,
  } = options;

  return async ({ ownerUserId, agentId, threadId, instruction }) => {
    /*
     * One id for this turn, minted once. The same value goes to the lock, to every renew, to
     * `runner.stop`, to the runner's own lock (which recognises it) and to the release.
     */
    const runId = crypto.randomUUID();

    /*
     * THE ONE ADDITION over `runCanonicalChannelAgent`. A routine may be the very first thing to
     * touch this (person, channel) thread; in the browser path the first message creates it. The
     * store's `ensure` is idempotent, so it is safe on the thousandth firing as well as the first.
     */
    await threads.ensure({ id: threadId, ownerUserId, agentId });

    /*
     * History, seeded by us because nobody else will: a headless turn has no browser sending it.
     * An unknown thread simply has none. Sanitized on the way in, see {@link sanitizeSeededHistory}.
     */
    const history = await threads.messages(threadId);
    const seeded = sanitizeSeededHistory(history.map(toAgentMessage));
    const turn = {
      id: crypto.randomUUID(),
      role: "user",
      content: frameFiring(instruction),
    } as Message;
    const messages = [...seeded, turn];

    /*
     * What this run adds to the transcript, by id rather than by position. Our runner keeps the
     * agent's whole message list as the snapshot and does not need this, but a runner that does
     * persist per message must not be handed the whole history again on every firing.
     */
    const historicIds = new Set(history.map((message) => message.id));
    const persistedInputMessages = messages.filter(
      (message) => !historicIds.has(message.id),
    );

    /*
     * The Bot, resolved as its owner, and pointed at this thread. `threadId` and the messages are
     * assigned ON THE AGENT because that is where the runner reads them from: `runAgent` rebuilds
     * its own `RunAgentInput` from `this.threadId`, `this.messages` and `this.state`.
     */
    const agent = await buildAgentFor({ ownerUserId, agentId });
    agent.threadId = threadId;
    agent.setMessages(messages);

    const input: RunAgentInput = {
      threadId,
      runId,
      messages,
      state: agent.state,
      // Empty because a headless turn has no browser to register frontend tools.
      tools: [],
      context: [],
      forwardedProps: undefined,
    };

    // The reply is recovered by diffing the agent, so this is the before-picture.
    const before = new Set(agent.messages.map((message) => message.id));
    const chunks: string[] = [];
    const spoken = agent.subscribe({
      onTextMessageEndEvent: ({ textMessageBuffer }) => {
        if (textMessageBuffer.length > 0) chunks.push(textMessageBuffer);
      },
    });

    const held = await lock.acquire({
      threadId,
      runId,
      userId: ownerUserId,
      agentId,
      ttlSeconds: lockTtlSeconds,
    });
    if (!held) {
      spoken.unsubscribe();
      const busy = new Error(
        "Somebody is already running in this conversation, so the routine did not fire this time.",
      );
      busy.name = "RoutineThreadBusy";
      throw busy;
    }

    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let backstop: ReturnType<typeof setTimeout> | undefined;
    let heartbeatError: unknown;
    /** Whether the deadline stopped this turn. See the throw below the `finally`. */
    let stopped = false;
    /** One stop promise for the whole turn, from either path that can ask for it. */
    let stopPromise: Promise<boolean | undefined> | undefined;

    const clearHeartbeat = () => {
      if (heartbeat === undefined) return;
      clearInterval(heartbeat);
      heartbeat = undefined;
    };

    /** Stop this exact run, both ends: the agent's own abort and the runner's stop flag. */
    const stopTurn = () => {
      try {
        agent.abortRun();
      } catch {
        // An agent that cannot be aborted must not stop us telling the runner to give up.
      }
      stopPromise ??= runner.stop({ threadId, runId }).catch(() => undefined);
    };

    /** A lock we no longer hold means somebody else is in this thread: stop rather than write into their run. */
    const lostLock = (error: unknown) => {
      if (heartbeat === undefined) return;
      clearHeartbeat();
      heartbeatError = error;
      stopTurn();
    };

    heartbeat = setInterval(() => {
      void lock
        .renew({ threadId, runId, ttlSeconds: lockTtlSeconds })
        .then((still) => {
          if (!still) {
            lostLock(
              new Error(
                "The thread lock was lost mid-turn; the turn was stopped.",
              ),
            );
          }
        })
        .catch(lostLock);
    }, heartbeatMs);
    // So a heartbeat that is still pending cannot hold a one-shot process open.
    heartbeat.unref?.();

    try {
      const completed = new Promise<void>((resolve, reject) => {
        let terminal: Error | undefined;
        runner
          .run({ threadId, agent, input, persistedInputMessages })
          .subscribe({
            /*
             * RUN_ERROR THROUGH `next` IS TERMINAL. The runner reports a failed run by emitting
             * RUN_ERROR and then COMPLETING the observable; `error` is for the runner itself
             * failing. A RUN_ERROR not caught here would arrive as a successful completion.
             */
            next: (event) => {
              if (event.type !== EventType.RUN_ERROR || terminal) return;
              const message =
                "message" in event && typeof event.message === "string"
                  ? event.message
                  : "The routine's turn failed.";
              terminal = new Error(message);
              terminal.name = "RoutineTurnRunError";
            },
            error: reject,
            complete: () => {
              if (terminal) reject(terminal);
              else resolve();
            },
          });
      });

      const timeout = new Promise<never>((_resolve, reject) => {
        deadline = setTimeout(() => {
          stopped = true;
          stopTurn();
        }, turnTimeoutMs);
        deadline.unref?.();
        backstop = setTimeout(() => {
          reject(
            new Error(
              `The routine's turn did not finish within ${Math.round(turnTimeoutMs / 1000)}s and could not be stopped.`,
            ),
          );
        }, turnTimeoutMs + abortGraceMs);
        backstop.unref?.();
      });

      await Promise.race([completed, timeout]);
    } finally {
      /*
       * THE SINGLE MOST IMPORTANT LINES IN THIS FILE, on every exit path: success, a thrown run,
       * the deadline, a failed heartbeat. While this lock is held the person's next message is
       * refused for the whole TTL. `.catch` because a release that cannot be reached must not
       * replace the real failure with a second one; the TTL is the backstop for that case.
       */
      clearHeartbeat();
      if (deadline !== undefined) clearTimeout(deadline);
      if (backstop !== undefined) clearTimeout(backstop);
      spoken.unsubscribe();
      await lock.release({ threadId, runId }).catch(() => undefined);
    }

    // Raised after the lock is released, and ahead of any reply: a turn that lost its lock partway
    // through is not a turn that answered, however much text it produced first.
    if (heartbeatError !== undefined) {
      await stopPromise;
      throw heartbeatError;
    }

    // And the same for a turn the deadline stopped: whatever text it reached is half a sentence.
    if (stopped) {
      await stopPromise;
      throw new Error(
        `The routine's turn was stopped after ${Math.round(turnTimeoutMs / 1000)}s.`,
      );
    }

    const said = agent.messages
      .filter((message) => !before.has(message.id))
      .map(assistantText)
      .filter((text): text is string => text !== undefined);
    // The diff first, the streamed chunks as the fallback: the diff is what was persisted.
    const replyText = (said.length > 0 ? said : chunks).join("\n\n");

    /*
     * An interrupt is an unfinished turn with nobody to ask, and it is checked BEFORE the
     * empty-reply case: a turn that interrupted before saying anything has both conditions true,
     * and "finished without saying anything" would be a lie about a turn that stopped to ask.
     */
    if (agent.pendingInterrupts.length > 0) {
      throw new Error(
        "The turn stopped to ask a question, and a routine has nobody to ask.",
      );
    }
    if (replyText.length === 0) {
      throw new Error("The turn finished without saying anything.");
    }

    return { replyText };
  };
}
