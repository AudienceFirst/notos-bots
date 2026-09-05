// NOTOS: één luisterverbinding voor alle LISTEN-onderwerpen (5 september 2026).
import postgres from "postgres";

/**
 * A postgres.js client whose one dedicated LISTEN connection carries every topic this process
 * subscribes to. Supabase's session pooler gives the role 15 clients in total; four listeners with
 * a connection each spent four of them for nothing, and left too little for a new revision to
 * start next to the old one during a deploy. Tests keep passing a URL and get a client of their
 * own, which they also own and close.
 */
export type ListenClient = ReturnType<typeof postgres>;

export function createListenClient(databaseUrl: string): ListenClient {
  // `max: 1` for the odd query; LISTEN itself rides on postgres.js's separate dedicated connection.
  return postgres(databaseUrl, { max: 1, idle_timeout: 30 });
}

/** The client to listen on, and whether the caller made it (and so must close it). */
export function listenClientFor(source: string | ListenClient): {
  connection: ListenClient;
  owned: boolean;
} {
  return typeof source === "string"
    ? { connection: createListenClient(source), owned: true }
    : { connection: source, owned: false };
}
