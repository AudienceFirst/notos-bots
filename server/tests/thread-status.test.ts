import { describe, expect, test } from "bun:test";
import { createThreadReader } from "../src/channels/thread-status";

/**
 * NOTOS: turning the thread store's answer into the two states a caller can act on (stap 0).
 *
 * "known" means the thread is there and this person may open it. "unknown" means there is no such
 * thread, or it is somebody else's, which to the asker is the same thing. A store that could not
 * answer throws, and that is rethrown: an outage must never read as a thread that is gone.
 */

describe("reading whether this deployment still has a thread", () => {
  test("a thread without an owner is known to anybody signed in", async () => {
    const reader = createThreadReader({
      get: async () => ({ ownerUserId: null }),
    });
    await expect(reader("thread-1", "user-1")).resolves.toBe("known");
  });

  test("a thread is known to its owner", async () => {
    const reader = createThreadReader({
      get: async () => ({ ownerUserId: "user-1" }),
    });
    await expect(reader("thread-1", "user-1")).resolves.toBe("known");
  });

  test("somebody else's thread is unknown, not a failure", async () => {
    const reader = createThreadReader({
      get: async () => ({ ownerUserId: "user-2" }),
    });
    await expect(reader("thread-1", "user-1")).resolves.toBe("unknown");
  });

  test("a thread the store does not have is unknown", async () => {
    const reader = createThreadReader({ get: async () => null });
    await expect(reader("thread-1", "user-1")).resolves.toBe("unknown");
  });

  test("a store that cannot answer is not swallowed as unknown", async () => {
    const failure = new Error("database unreachable");
    const reader = createThreadReader({
      get: async () => {
        throw failure;
      },
    });
    await expect(reader("thread-1", "user-1")).rejects.toBe(failure);
  });

  test("asks the store about the exact thread it was given", async () => {
    const calls: string[] = [];
    const reader = createThreadReader({
      get: async (threadId) => {
        calls.push(threadId);
        return { ownerUserId: null };
      },
    });
    await reader("thread-77", "user-99");
    expect(calls).toEqual(["thread-77"]);
  });
});
