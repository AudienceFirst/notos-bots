// NOTOS: FRIDA-tools standaard aan elke bot in elke workspace (bouwplan stap 6).
import { eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { agents } from "../../db/schema/core";
import { mcpServers, mcpTools, pluginGrants } from "../../db/schema/plugins";
import {
  FRIDA_HOST,
  FRIDA_TOOLS,
  resolveServerUrl,
} from "../../plugins/catalogue";

export const FRIDA_SERVER_ID = "frida";
const GRANTED_BY = "workspace-sync";

/**
 * Every Bot in a workspace may read FRIDA as the person asking.
 *
 * The grant is the permission; the person's own connection is the access. A Bot holding these tools
 * for somebody who never connected FRIDA is told so by the store and asks them to connect, which is
 * the right conversation. The server row is created here too, so the connector exists before an
 * administrator ever opens Plugins; `onConflictDoNothing` keeps an administrator's later changes.
 *
 * The tool names come from the catalogue's list plus whatever FRIDA advertised at the last discovery,
 * so a tool FRIDA adds is granted on the next sync once one person has connected.
 */
/**
 * NOTOS (stap 7): the read tools every Bot holds by default, per connector. Gmail and Drive reads
 * come along with FRIDA; Shopify and Webflow start with nothing until an administrator grants them.
 */
const DEFAULT_READ_TOOLS: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    gmail: Object.freeze(["search_messages", "get_message", "get_thread"]),
    "google-drive": Object.freeze([
      "search_files",
      "list_recent_files",
      "get_file_metadata",
      "read_file_content",
    ]),
  });

export async function grantFridaTools(
  database: Database,
  workspaceId: string,
): Promise<number> {
  await database
    .insert(mcpServers)
    .values({
      id: FRIDA_SERVER_ID,
      title: "FRIDA",
      vendor: "ZUID",
      url: `${FRIDA_HOST}/mcp`,
      addedBy: GRANTED_BY,
    })
    .onConflictDoNothing();
  // The Gmail row too, so the connector exists; its OAuth client is an administrator's to paste.
  for (const key of Object.keys(DEFAULT_READ_TOOLS)) {
    const resolved = resolveServerUrl(key);
    if (!resolved) continue;
    await database
      .insert(mcpServers)
      .values({
        id: key,
        title: resolved.entry.title,
        vendor: resolved.entry.vendor,
        url: resolved.url,
        addedBy: GRANTED_BY,
      })
      .onConflictDoNothing();
  }

  const advertised = await database
    .select({ name: mcpTools.name })
    .from(mcpTools)
    .where(eq(mcpTools.serverId, FRIDA_SERVER_ID));
  const names = new Set<string>([
    ...FRIDA_TOOLS,
    ...advertised.map((tool) => tool.name),
  ]);

  const bots = await database
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.workspaceId, workspaceId));
  if (bots.length === 0) return 0;

  const refs = [
    ...[...names].map((name) => `${FRIDA_SERVER_ID}/${name}`),
    ...Object.entries(DEFAULT_READ_TOOLS).flatMap(([key, tools]) =>
      tools.map((name) => `${key}/${name}`),
    ),
  ];
  const rows = bots.flatMap((bot) =>
    refs.map((ref) => ({
      kind: "mcp",
      ref,
      agentId: bot.id,
      grantedBy: GRANTED_BY,
    })),
  );
  const inserted = await database
    .insert(pluginGrants)
    .values(rows)
    .onConflictDoNothing()
    .returning({ ref: pluginGrants.ref });
  return inserted.length;
}
