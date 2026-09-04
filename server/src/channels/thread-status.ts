// NOTOS: leest de eigen threads-tabel in plaats van Intelligence (stap 0).
import type { ThreadReader } from "./thread-routes";

/**
 * Build a {@link ThreadReader} from the thread store.
 *
 * Two answers only. `"known"` means the thread is there and this person may open it: it has no
 * owner (a channel's thread, mapped per person elsewhere) or the owner is them. `"unknown"` means
 * there is no such thread, or it belongs to somebody else, which to the asker is the same thing: a
 * remembered id they can safely stop remembering. Anything the store throws is rethrown, so a
 * database that could not answer never reads as a thread that is gone.
 */
export function createThreadReader(threads: {
  get(threadId: string): Promise<{ ownerUserId: string | null } | null>;
}): ThreadReader {
  return async (threadId, userId) => {
    const thread = await threads.get(threadId);
    if (!thread) return "unknown";
    if (thread.ownerUserId && thread.ownerUserId !== userId) return "unknown";
    return "known";
  };
}
