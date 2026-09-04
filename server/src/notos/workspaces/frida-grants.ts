// NOTOS: FRIDA-tools standaard aan elke bot in elke workspace (bouwplan stap 6).
import { eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { agents } from "../../db/schema/core";
import { mcpServers, mcpTools, pluginGrants } from "../../db/schema/plugins";
import { FRIDA_HOST, FRIDA_TOOLS } from "../../plugins/catalogue";

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

  const rows = bots.flatMap((bot) =>
    [...names].map((name) => ({
      kind: "mcp",
      ref: `${FRIDA_SERVER_ID}/${name}`,
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
