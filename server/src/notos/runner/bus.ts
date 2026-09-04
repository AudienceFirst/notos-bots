/**
 * Eén Postgres-kanaal waarover replica's elkaar over runs vertellen.
 *
 * Drie signalen: er zijn nieuwe gebeurtenissen geschreven (`events`), een run is klaar
 * (`finished`), en iemand wil een run stoppen die op een andere replica draait (`stop`). Het is een
 * wekker, geen transport: `PostgresAgentRunner.connect` leest de rijen zelf uit `thread_events` en
 * pollt ook zonder signaal, dus een verloren NOTIFY kost hooguit één poll-interval.
 *
 * Eigen verbinding, net als `work/queue.ts`: `LISTEN` houdt er één vast voor de duur van het proces.
 */
import { sql } from "drizzle-orm";
import postgres from "postgres";
import type { Database } from "../../db/client";

export const THREAD_TOPIC = "notos_thread";

export type ThreadSignal = {
  kind: "events" | "finished" | "stop";
  threadId: string;
  runId: string;
};

export type ThreadBus = {
  publish(signal: ThreadSignal): Promise<void>;
  /** Elk signaal, van elke replica, deze inbegrepen. De luisteraar filtert zelf op thread. */
  subscribe(listener: (signal: ThreadSignal) => void): () => void;
  stop(): Promise<void>;
};

export async function startThreadBus(
  databaseUrl: string,
  database: Pick<Database, "execute">,
): Promise<ThreadBus> {
  const listeners = new Set<(signal: ThreadSignal) => void>();
  const connection = postgres(databaseUrl, { max: 1 });

  await connection.listen(THREAD_TOPIC, (payload) => {
    let signal: ThreadSignal;
    try {
      signal = JSON.parse(payload) as ThreadSignal;
    } catch {
      return;
    }
    if (!signal || typeof signal.threadId !== "string") return;
    for (const listener of listeners) {
      try {
        listener(signal);
      } catch {
        // Een luisteraar die struikelt haalt het abonnement niet neer; de poll vangt het op.
      }
    }
  });

  return {
    async publish(signal) {
      await database.execute(
        sql`select pg_notify(${THREAD_TOPIC}, ${JSON.stringify(signal)})`,
      );
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async stop() {
      listeners.clear();
      await connection.end();
    },
  };
}
