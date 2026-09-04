import { afterAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import type { BaseEvent, RunAgentInput } from "@ag-ui/client";
import { AbstractAgent, compactEvents, EventType } from "@ag-ui/client";
import { and, eq } from "drizzle-orm";
import { lastValueFrom, Observable, toArray } from "rxjs";
import { createDatabase } from "../../src/db/client";
import { threads, workItems } from "../../src/db/schema";
import {
  createThreadLock,
  createThreadStore,
  PostgresAgentRunner,
  THREAD_RUN_KIND,
} from "../../src/notos/runner";
import { TEST_POOL } from "../support/database";

/**
 * NOTOS: the runner under the SSE runtime, against a real Postgres (stap 0).
 *
 * Two properties the in-memory runner cannot have, and the reason this runner exists: a run's
 * events are still there for a runner instance that was not alive when they were written, and two
 * runners on one thread do not both run. A fake database would pass both while proving neither.
 */

const database = createDatabase(
  process.env.DATABASE_URL ??
    "postgres://openbot:openbot@localhost:5432/openbot",
  TEST_POOL,
);
const store = createThreadStore(database);
const lock = createThreadLock(database);
const made: string[] = [];

afterAll(async () => {
  for (const threadId of made) {
    await database.delete(threads).where(eq(threads.id, threadId));
    await database
      .delete(workItems)
      .where(
        and(eq(workItems.kind, THREAD_RUN_KIND), eq(workItems.key, threadId)),
      );
  }
  await database.$client.end({ timeout: 5 });
});

function newThreadId() {
  const threadId = randomUUID();
  made.push(threadId);
  return threadId;
}

/** Twenty events that `compactEvents` leaves alone: one message per start/content/end triple. */
function twentyEvents(input: RunAgentInput): BaseEvent[] {
  const events: BaseEvent[] = [
    {
      type: EventType.RUN_STARTED,
      threadId: input.threadId,
      runId: input.runId,
    } as BaseEvent,
  ];
  for (let i = 0; i < 6; i += 1) {
    const messageId = `m${i}`;
    events.push(
      {
        type: EventType.TEXT_MESSAGE_START,
        messageId,
        role: "assistant",
      } as BaseEvent,
      {
        type: EventType.TEXT_MESSAGE_CONTENT,
        messageId,
        delta: `line ${i}`,
      } as BaseEvent,
      { type: EventType.TEXT_MESSAGE_END, messageId } as BaseEvent,
    );
  }
  events.push({
    type: EventType.RUN_FINISHED,
    threadId: input.threadId,
    runId: input.runId,
  } as BaseEvent);
  return events;
}

/** An agent that plays a script, optionally holding the run open until told to finish. */
class ScriptedAgent extends AbstractAgent {
  private release: (() => void) | undefined;
  constructor(
    private readonly script: (input: RunAgentInput) => BaseEvent[],
    private readonly holdOpen = false,
  ) {
    super({ agentId: "scripted" });
  }
  finish() {
    this.release?.();
  }
  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>((subscriber) => {
      const events = this.script(input);
      const last = events[events.length - 1];
      for (const event of events.slice(0, -1)) subscriber.next(event);
      if (!this.holdOpen) {
        if (last) subscriber.next(last);
        subscriber.complete();
        return;
      }
      this.release = () => {
        if (last) subscriber.next(last);
        subscriber.complete();
      };
    });
  }
}

const inputFor = (threadId: string): RunAgentInput => ({
  threadId,
  runId: randomUUID(),
  messages: [],
  state: {},
  tools: [],
  context: [],
  forwardedProps: {},
});

describe("a run survives the runner that ran it", () => {
  test("twenty events in, the same twenty back from a fresh runner, in order", async () => {
    const threadId = newThreadId();
    const first = new PostgresAgentRunner({
      threads: store,
      lock,
      flushEvery: 7,
    });
    const agent = new ScriptedAgent(twentyEvents);
    const input = inputFor(threadId);
    agent.threadId = threadId;

    const streamed = await lastValueFrom(
      first.run({ threadId, agent, input }).pipe(toArray()),
    );
    expect(streamed.map((event) => event.type)).toEqual(
      twentyEvents(input).map((event) => event.type),
    );

    // Raw, as written: twenty rows, seq 1..20, in the order they were emitted.
    const stored = await store.events(threadId);
    expect(stored).toHaveLength(20);
    expect(stored.map((row) => row.seq)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    expect(stored.map((row) => row.event.type)).toEqual(
      twentyEvents(input).map((event) => event.type),
    );

    // A second instance, as after a restart: connect replays what was stored, compacted.
    const second = new PostgresAgentRunner({ threads: store, lock });
    const replayed = await lastValueFrom(
      second.connect({ threadId }).pipe(toArray()),
    );
    expect(replayed).toEqual(compactEvents(stored.map((row) => row.event)));
    expect(replayed).toHaveLength(20);

    // And the snapshot the browser reopens: the six messages the agent ended up with.
    const messages = await second.getThreadMessages(threadId);
    expect(messages.map((message) => message.id)).toEqual([
      "m0",
      "m1",
      "m2",
      "m3",
      "m4",
      "m5",
    ]);
    expect(await second.isRunning({ threadId })).toBe(false);
  });
});

describe("one run at a time per conversation", () => {
  test("a second runner on the same thread is told it is busy and never starts", async () => {
    const threadId = newThreadId();
    const first = new PostgresAgentRunner({ threads: store, lock });
    const second = new PostgresAgentRunner({ threads: store, lock });
    const slow = new ScriptedAgent(twentyEvents, true);
    slow.threadId = threadId;

    const firstRun = lastValueFrom(
      first
        .run({ threadId, agent: slow, input: inputFor(threadId) })
        .pipe(toArray()),
    );
    // Give the first run time to take the lock and write its opening events.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(await second.isRunning({ threadId })).toBe(true);

    const other = new ScriptedAgent(twentyEvents);
    other.threadId = threadId;
    await expect(
      lastValueFrom(
        second
          .run({ threadId, agent: other, input: inputFor(threadId) })
          .pipe(toArray()),
      ),
    ).rejects.toThrow("Thread already running");

    slow.finish();
    const events = await firstRun;
    expect(events[events.length - 1]?.type).toBe(EventType.RUN_FINISHED);
    // Only the first run's events are on record; the refused one wrote nothing.
    const stored = await store.events(threadId);
    expect(stored).toHaveLength(20);
    expect(new Set(stored.map((row) => row.runId)).size).toBe(1);
    expect(await lock.holder(threadId)).toBeNull();
  });

  test("a replica that was not running the thread can still watch it, and sees it end", async () => {
    const threadId = newThreadId();
    const running = new PostgresAgentRunner({
      threads: store,
      lock,
      flushEvery: 1,
    });
    const watching = new PostgresAgentRunner({
      threads: store,
      lock,
      pollMs: 50,
    });
    const slow = new ScriptedAgent(twentyEvents, true);
    slow.threadId = threadId;

    const run = lastValueFrom(
      running
        .run({ threadId, agent: slow, input: inputFor(threadId) })
        .pipe(toArray()),
    );
    await new Promise((resolve) => setTimeout(resolve, 300));
    const watched = lastValueFrom(
      watching.connect({ threadId }).pipe(toArray()),
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    slow.finish();
    await run;

    const seen = await watched;
    expect(seen[0]?.type).toBe(EventType.RUN_STARTED);
    expect(seen[seen.length - 1]?.type).toBe(EventType.RUN_FINISHED);
  });
});
