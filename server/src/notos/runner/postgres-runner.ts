/**
 * De runner van CopilotKit's SSE-runtime, met Postgres als geheugen.
 *
 * `CopilotRuntime` kiest de SSE-runtime zodra je geen `intelligence` meegeeft, en neemt dan een
 * eigen `runner` aan (`options.runner ?? new InMemoryAgentRunner()`). Deze klasse is die runner. Het
 * contract is de abstracte `AgentRunner` uit `@copilotkit/runtime/v2`: `run`, `connect`, `isRunning`,
 * `stop`. De vorm van `run` en `connect` is overgenomen van de in-memory runner in
 * `dist/v2/runtime/runner/in-memory.mjs` (1.69.0); wat hier anders is:
 *
 * - Elke gebeurtenis van een run wordt als rij in `thread_events` geschreven (in batches van
 *   `flushEvery` of na `flushAfterMs`), zodat een gesprek een herstart en een tweede replica overleeft.
 * - Aan het eind van een run bewaart `threads.snapshot` de berichten van de agent, zoals de
 *   in-memory runner zijn `messagesSnapshot` bijhoudt. Dat leest de browser terug.
 * - De run-lock is een rij in `work_items` (`thread-lock.ts`), niet een veld in het proces. Een
 *   tweede run op dezelfde thread, op welke replica dan ook, krijgt "Thread already running".
 * - `connect` speelt de bewaarde gebeurtenissen af en volgt daarna live mee: via het lokale subject
 *   als de run hier draait, via `thread_events` plus `LISTEN/NOTIFY` (of een poll) als hij elders draait.
 *
 * Geen `ɵsupportsLocalThreadEndpoints`: die interface is synchroon en een database is dat niet. De
 * thread-endpoints van de runtime (`threads/messages` enz.) worden daarom niet door de runtime bediend
 * maar door een eigen route in `app.ts`, die `getThreadMessages` hier aanroept.
 */
import type { AbstractAgent, BaseEvent, Message } from "@ag-ui/client";
import { compactEvents, EventType } from "@ag-ui/client";
import type {
  AgentRunnerConnectRequest,
  AgentRunnerIsRunningRequest,
  AgentRunnerRunRequest,
  AgentRunnerStopRequest,
} from "@copilotkit/runtime/v2";
import { AgentRunner, finalizeRunEvents } from "@copilotkit/runtime/v2";
import { Observable, ReplaySubject } from "rxjs";
import type { ThreadBus } from "./bus";
import type { ThreadLock } from "./thread-lock";
import type { ThreadRecord, ThreadStore } from "./thread-store";

export type PostgresAgentRunnerOptions = {
  threads: ThreadStore;
  lock: ThreadLock;
  /** Zonder bus werkt alles, alleen ziet een replica een run elders pas bij de volgende poll. */
  bus?: ThreadBus;
  /** Hoe vaak de lease verlengd wordt terwijl een run loopt. */
  heartbeatMs?: number;
  /** Batchgrootte en -wachttijd voor het wegschrijven van gebeurtenissen. */
  flushEvery?: number;
  flushAfterMs?: number;
  /** Hoe vaak een meekijkende replica `thread_events` naleest zonder signaal. */
  pollMs?: number;
};

type LocalRun = {
  runId: string;
  agent: AbstractAgent;
  subject: ReplaySubject<BaseEvent>;
  stopRequested: boolean;
  finalize: { stopRequested: boolean };
};

const messageIdOf = (event: BaseEvent): string | undefined =>
  "messageId" in event && typeof event.messageId === "string"
    ? event.messageId
    : undefined;

const isTerminal = (event: BaseEvent) =>
  event.type === EventType.RUN_FINISHED || event.type === EventType.RUN_ERROR;

/**
 * Schrijft gebeurtenissen in batches, in volgorde, en meldt een mislukte batch bij de volgende
 * `flush` zodat de run erop kan falen in plaats van stil gebeurtenissen kwijt te raken.
 */
class EventWriter {
  private buffer: { seq: number; event: BaseEvent }[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private chain: Promise<void> = Promise.resolve();
  private failure: unknown;

  constructor(
    private readonly threads: ThreadStore,
    private readonly threadId: string,
    private readonly runId: string,
    private seq: number,
    private readonly every: number,
    private readonly afterMs: number,
    private readonly onFlushed?: () => void,
  ) {}

  push(event: BaseEvent) {
    this.buffer.push({ seq: this.seq, event });
    this.seq += 1;
    if (this.buffer.length >= this.every) {
      void this.flush();
    } else if (this.timer === undefined) {
      this.timer = setTimeout(() => void this.flush(), this.afterMs);
      this.timer.unref?.();
    }
  }

  flush(): Promise<void> {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    const rows = this.buffer;
    this.buffer = [];
    this.chain = this.chain.then(async () => {
      if (this.failure !== undefined) return;
      if (rows.length === 0) return;
      try {
        await this.threads.appendEvents(this.threadId, this.runId, rows);
        this.onFlushed?.();
      } catch (error) {
        this.failure = error;
      }
    });
    return this.chain.then(() => {
      if (this.failure !== undefined) throw this.failure;
    });
  }
}

export class PostgresAgentRunner extends AgentRunner {
  readonly threads: ThreadStore;
  readonly lock: ThreadLock;
  private bus: ThreadBus | undefined;
  private unsubscribeBus: (() => void) | undefined;
  private readonly local = new Map<string, LocalRun>();
  private readonly heartbeatMs: number;
  private readonly flushEvery: number;
  private readonly flushAfterMs: number;
  private readonly pollMs: number;

  constructor(options: PostgresAgentRunnerOptions) {
    super();
    this.threads = options.threads;
    this.lock = options.lock;
    this.heartbeatMs = options.heartbeatMs ?? 15_000;
    this.flushEvery = options.flushEvery ?? 50;
    this.flushAfterMs = options.flushAfterMs ?? 200;
    this.pollMs = options.pollMs ?? 500;
    if (options.bus) this.attachBus(options.bus);
  }

  /** De bus kan pas na de database bestaan; daarom los aan te haken. */
  attachBus(bus: ThreadBus) {
    this.unsubscribeBus?.();
    this.bus = bus;
    this.unsubscribeBus = bus.subscribe((signal) => {
      if (signal.kind !== "stop") return;
      const running = this.local.get(signal.threadId);
      if (running && running.runId === signal.runId) {
        void this.stop({ threadId: signal.threadId, runId: signal.runId });
      }
    });
  }

  run(request: AgentRunnerRunRequest): Observable<BaseEvent> {
    const { threadId } = request;
    // Dezelfde zin als de in-memory runner, zodat `handle-run` er hetzelfde op antwoordt.
    if (this.local.has(threadId)) throw new Error("Thread already running");
    const subject = new ReplaySubject<BaseEvent>(Infinity);
    const entry: LocalRun = {
      runId: request.input.runId,
      agent: request.agent,
      subject,
      stopRequested: false,
      finalize: { stopRequested: false },
    };
    this.local.set(threadId, entry);
    void this.drive(request, entry);
    return subject.asObservable();
  }

  private async drive(request: AgentRunnerRunRequest, entry: LocalRun) {
    const { threadId, agent, input } = request;
    const { runId, subject } = entry;
    const agentId = agent.agentId ?? "default";

    let held = false;
    try {
      held = await this.lock.acquire({ threadId, runId, agentId });
    } catch (error) {
      this.local.delete(threadId);
      subject.error(error);
      return;
    }
    if (!held) {
      this.local.delete(threadId);
      subject.error(new Error("Thread already running"));
      return;
    }

    const events: BaseEvent[] = [];
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let failed = false;
    try {
      await this.threads.ensure({ id: threadId, agentId });
      const writer = new EventWriter(
        this.threads,
        threadId,
        runId,
        await this.threads.nextSeq(threadId),
        this.flushEvery,
        this.flushAfterMs,
        () => {
          void this.bus
            ?.publish({ kind: "events", threadId, runId })
            .catch(() => {});
        },
      );
      const historic = new Set(
        (await this.threads.messages(threadId)).map((message) => message.id),
      );

      heartbeat = setInterval(() => {
        void this.lock
          .renew({ threadId, runId })
          .then((still) => {
            if (still) return;
            // De lock is van iemand anders: verder schrijven zou in hun run belanden.
            entry.finalize.stopRequested = true;
            entry.stopRequested = true;
            try {
              agent.abortRun();
            } catch {}
          })
          .catch(() => {});
      }, this.heartbeatMs);
      heartbeat.unref?.();

      const finish = async (options: { interruptionMessage?: string }) => {
        const isError = options.interruptionMessage !== undefined;
        const before = events.length;
        const appended = finalizeRunEvents(events, {
          stopRequested: entry.finalize.stopRequested,
          ...(isError
            ? { interruptionMessage: options.interruptionMessage }
            : {}),
        });
        for (const event of appended) {
          subject.next(event);
          writer.push(event);
        }
        await writer.flush();
        // Net als de in-memory runner: een run die faalde vóór zijn eerste gebeurtenis laat
        // de momentopname met rust.
        if (!isError || before > 0) {
          await this.threads.finishRun(threadId, {
            messages: Array.isArray(agent.messages) ? [...agent.messages] : [],
          });
        }
      };

      try {
        await agent.runAgent(input, {
          onEvent: ({ event }) => {
            let processed = event;
            if (event.type === EventType.RUN_STARTED) {
              const started = event as BaseEvent & { input?: unknown };
              if (!started.input) {
                const sanitized = input.messages
                  ? input.messages.filter(
                      (message) => !historic.has(message.id),
                    )
                  : undefined;
                started.input = {
                  ...input,
                  ...(sanitized !== undefined ? { messages: sanitized } : {}),
                };
                processed = started;
              }
            }
            subject.next(processed);
            events.push(processed);
            writer.push(processed);
          },
        });
        await finish({});
      } catch (error) {
        await finish({
          interruptionMessage:
            error instanceof Error ? error.message : String(error),
        });
      }
    } catch (error) {
      // De opslag zelf viel om. Dan is dit geen run die netjes eindigde maar een die faalde.
      failed = true;
      subject.error(error);
    } finally {
      if (heartbeat !== undefined) clearInterval(heartbeat);
      await this.lock.release({ threadId, runId }).catch(() => {});
      this.local.delete(threadId);
      if (!failed) subject.complete();
      void this.bus
        ?.publish({ kind: "finished", threadId, runId })
        .catch(() => {});
    }
  }

  connect(request: AgentRunnerConnectRequest): Observable<BaseEvent> {
    const { threadId } = request;
    return new Observable<BaseEvent>((subscriber) => {
      let closed = false;
      let teardown: (() => void) | undefined;

      (async () => {
        const running = this.local.get(threadId);
        const stored = await this.threads.events(
          threadId,
          running ? { excludingRunId: running.runId } : undefined,
        );
        if (closed) return;
        const emitted = new Set<string>();
        let lastSeq =
          stored.length > 0 ? (stored[stored.length - 1]?.seq ?? 0) : 0;
        for (const event of compactEvents(stored.map((row) => row.event))) {
          subscriber.next(event);
          const messageId = messageIdOf(event);
          if (messageId) emitted.add(messageId);
        }

        if (running) {
          const subscription = running.subject.subscribe({
            next: (event) => {
              const messageId = messageIdOf(event);
              if (messageId && emitted.has(messageId)) return;
              subscriber.next(event);
            },
            error: (error) => subscriber.error(error),
            complete: () => subscriber.complete(),
          });
          teardown = () => subscription.unsubscribe();
          return;
        }

        if (!(await this.lock.holder(threadId))) {
          subscriber.complete();
          return;
        }

        /*
         * De run draait op een andere replica. Lees wat er sinds `lastSeq` bijkwam, gewekt door de
         * bus en anders door de poll, tot een RUN_FINISHED/RUN_ERROR langskomt of de lock los is.
         */
        let done = false;
        let ticking = false;
        let again = false;
        const follow = async () => {
          const rows = await this.threads.eventsAfter(threadId, lastSeq);
          for (const row of rows) {
            lastSeq = row.seq;
            const messageId = messageIdOf(row.event);
            if (messageId && emitted.has(messageId)) continue;
            subscriber.next(row.event);
            if (isTerminal(row.event)) done = true;
          }
        };
        const tick = async () => {
          if (closed || done) return;
          if (ticking) {
            again = true;
            return;
          }
          ticking = true;
          try {
            do {
              again = false;
              await follow();
              if (!done && !(await this.lock.holder(threadId))) {
                await follow();
                done = true;
              }
            } while (again && !done && !closed);
          } finally {
            ticking = false;
          }
          if (done && !closed) {
            teardown?.();
            subscriber.complete();
          }
        };
        const unsubscribe = this.bus?.subscribe((signal) => {
          if (signal.threadId === threadId) void tick().catch(() => {});
        });
        const interval = setInterval(
          () => void tick().catch((error) => subscriber.error(error)),
          this.pollMs,
        );
        interval.unref?.();
        teardown = () => {
          clearInterval(interval);
          unsubscribe?.();
        };
        await tick();
      })().catch((error) => subscriber.error(error));

      return () => {
        closed = true;
        teardown?.();
      };
    });
  }

  async isRunning(request: AgentRunnerIsRunningRequest): Promise<boolean> {
    if (this.local.has(request.threadId)) return true;
    return (await this.lock.holder(request.threadId)) !== null;
  }

  async stop(request: AgentRunnerStopRequest): Promise<boolean | undefined> {
    const running = this.local.get(request.threadId);
    if (running) {
      if (request.runId !== undefined && running.runId !== request.runId) {
        return false;
      }
      if (running.stopRequested) return false;
      running.stopRequested = true;
      running.finalize.stopRequested = true;
      try {
        running.agent.abortRun();
        return true;
      } catch (error) {
        console.error("Failed to abort agent run", error);
        running.stopRequested = false;
        running.finalize.stopRequested = false;
        return false;
      }
    }
    // Elders bezig: vraag die replica het te doen. Zonder bus is er niets om te vragen.
    const holder = await this.lock.holder(request.threadId);
    if (!holder) return false;
    if (request.runId !== undefined && holder.runId !== request.runId) {
      return false;
    }
    if (!this.bus) return false;
    await this.bus.publish({
      kind: "stop",
      threadId: request.threadId,
      runId: holder.runId,
    });
    return true;
  }

  /** De berichten van een thread, zoals de laatste run ze achterliet. Leeg voor een onbekende thread. */
  getThreadMessages(threadId: string): Promise<Message[]> {
    return this.threads.messages(threadId);
  }

  listThreads(options?: { ownerUserId?: string }): Promise<ThreadRecord[]> {
    return this.threads.list(options);
  }

  /** Voor een nette afsluiting van het proces. */
  detach() {
    this.unsubscribeBus?.();
    this.unsubscribeBus = undefined;
    this.bus = undefined;
  }
}
