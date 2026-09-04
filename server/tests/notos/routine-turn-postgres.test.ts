import { afterAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import type { BaseEvent, RunAgentInput } from "@ag-ui/client";
import { AbstractAgent, EventType } from "@ag-ui/client";
import { and, eq } from "drizzle-orm";
import { Observable } from "rxjs";
import { createDatabase } from "../../src/db/client";
import { threads, workItems } from "../../src/db/schema";
import {
  createThreadLock,
  createThreadStore,
  PostgresAgentRunner,
  THREAD_RUN_KIND,
} from "../../src/notos/runner";
import { createTurnRunner } from "../../src/routines/run-turn";
import { TEST_POOL } from "../support/database";

/**
 * NOTOS: a routine's headless turn, driven through the real runner, store and lock (stap 0).
 *
 * `routine-run-turn.test.ts` holds the lifecycle against fakes. This holds the one thing fakes
 * cannot: that a firing leaves its answer in `thread_events` and in the thread's snapshot, that the
 * lock taken by the turn is the lock the runner recognises (same run id, so the runner is not
 * refused by it), and that the lock is free afterwards. No model: the Bot is scripted.
 */

const database = createDatabase(
  process.env.DATABASE_URL ??
    "postgres://openbot:openbot@localhost:5432/openbot",
  TEST_POOL,
);
const store = createThreadStore(database);
const lock = createThreadLock(database);
const threadId = randomUUID();

afterAll(async () => {
  await database.delete(threads).where(eq(threads.id, threadId));
  await database
    .delete(workItems)
    .where(
      and(eq(workItems.kind, THREAD_RUN_KIND), eq(workItems.key, threadId)),
    );
  await database.$client.end({ timeout: 5 });
});

/** Answers with one sentence, as a Bot on a model would. */
class AnsweringAgent extends AbstractAgent {
  run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>((subscriber) => {
      const messageId = randomUUID();
      const events: BaseEvent[] = [
        {
          type: EventType.RUN_STARTED,
          threadId: input.threadId,
          runId: input.runId,
        } as BaseEvent,
        {
          type: EventType.TEXT_MESSAGE_START,
          messageId,
          role: "assistant",
        } as BaseEvent,
        {
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId,
          delta: "Three things happened.",
        } as BaseEvent,
        { type: EventType.TEXT_MESSAGE_END, messageId } as BaseEvent,
        {
          type: EventType.RUN_FINISHED,
          threadId: input.threadId,
          runId: input.runId,
        } as BaseEvent,
      ];
      for (const event of events) subscriber.next(event);
      subscriber.complete();
    });
  }
}

describe("a routine firing through the Postgres runner", () => {
  test("leaves its answer in thread_events and the snapshot, and frees the lock", async () => {
    const runner = new PostgresAgentRunner({ threads: store, lock });
    const runTurn = createTurnRunner({
      threads: store,
      lock,
      runner,
      buildAgentFor: async () => new AnsweringAgent({ agentId: "bot_helper" }),
      heartbeatMs: 50,
    });

    const first = await runTurn({
      ownerUserId: "user_owner",
      agentId: "bot_helper",
      threadId,
      instruction: "Post the standup summary.",
    });
    expect(first).toEqual({ replyText: "Three things happened." });

    const thread = await store.get(threadId);
    expect(thread).toMatchObject({
      ownerUserId: "user_owner",
      agentId: "bot_helper",
    });
    const stored = await store.events(threadId);
    expect(stored.map((row) => row.event.type)).toEqual([
      EventType.RUN_STARTED,
      EventType.TEXT_MESSAGE_START,
      EventType.TEXT_MESSAGE_CONTENT,
      EventType.TEXT_MESSAGE_END,
      EventType.RUN_FINISHED,
    ]);
    const messages = await store.messages(threadId);
    expect(messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
    ]);
    expect(await lock.holder(threadId)).toBeNull();

    // The next firing reads the first as history and adds one more exchange.
    const second = await runTurn({
      ownerUserId: "user_owner",
      agentId: "bot_helper",
      threadId,
      instruction: "Post the standup summary.",
    });
    expect(second).toEqual({ replyText: "Three things happened." });
    expect((await store.messages(threadId)).map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
      "assistant",
    ]);
    expect(await store.events(threadId)).toHaveLength(10);
    expect(await runner.isRunning({ threadId })).toBe(false);
  });
});
