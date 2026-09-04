// NOTOS: nachtelijke export van audit_events en approvals naar BigQuery marts.bots_audit (stap 5).
/*
 * Run as a Cloud Run Job on the same image: `bun src/notos/audit-export.ts`, with DATABASE_URL and
 * DATABASE_SCHEMA as the server has them, and BQ_TABLE = project.dataset.table. Reads one day (UTC),
 * yesterday unless EXPORT_DAY=YYYY-MM-DD is given, and streams the rows into BigQuery with the row id
 * as insertId, so a rerun of the same day does not double the rows in the short term; the table is
 * partitioned on occurred_at, so a clean-up per day is one DELETE.
 *
 * Streaming insert rather than a load job: a few thousand rows a day at most, no file to stage, and
 * google-auth-library is already here. The client id is what NOTOS joins on; the workspace id is
 * ours and travels along for a check.
 */
import { GoogleAuth } from "google-auth-library";
import { createDatabase } from "../db/client";
import { and, eq, gte, lt } from "drizzle-orm";
import { agents, deploymentPackages } from "../db/schema";
import { auditEvents } from "../db/schema/core";
import { approvals } from "../db/schema/approvals";

type ExportRow = {
  event_id: string;
  kind: "audit" | "approval";
  occurred_at: string;
  event_type: string;
  target_type: string | null;
  target_id: string | null;
  actor: string | null;
  bot_id: string | null;
  client_id: string | null;
  workspace_id: string | null;
  tool_ref: string | null;
  decision: string | null;
  payload: string;
  exported_at: string;
};

function dayWindow(day?: string): { from: Date; to: Date; label: string } {
  const start = day
    ? new Date(`${day}T00:00:00.000Z`)
    : new Date(new Date().setUTCHours(0, 0, 0, 0) - 24 * 60 * 60 * 1000);
  if (Number.isNaN(start.getTime())) {
    throw new Error(`EXPORT_DAY is not a date: ${day}`);
  }
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { from: start, to: end, label: start.toISOString().slice(0, 10) };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const table = process.env.BQ_TABLE;
  if (!databaseUrl || !table) {
    throw new Error("DATABASE_URL and BQ_TABLE are required.");
  }
  const [project, dataset, tableId] = table.split(".");
  if (!project || !dataset || !tableId) {
    throw new Error("BQ_TABLE must be project.dataset.table");
  }
  const window = dayWindow(process.env.EXPORT_DAY);
  const database = createDatabase(databaseUrl, { max: 2 });
  const exportedAt = new Date().toISOString();

  // Bot -> workspace -> NOTOS client id, once, for every row that names a Bot.
  const botRows = await database
    .select({
      botId: agents.id,
      workspaceId: agents.workspaceId,
      clientId: deploymentPackages.notosClientId,
    })
    .from(agents)
    .leftJoin(
      deploymentPackages,
      eq(agents.workspaceId, deploymentPackages.id),
    );
  const byBot = new Map(botRows.map((row) => [row.botId, row]));
  const workspaceRows = await database
    .select({
      id: deploymentPackages.id,
      clientId: deploymentPackages.notosClientId,
    })
    .from(deploymentPackages);
  const byWorkspace = new Map(
    workspaceRows.map((row) => [row.id, row.clientId]),
  );

  const events = await database
    .select()
    .from(auditEvents)
    .where(
      and(
        gte(auditEvents.createdAt, window.from),
        lt(auditEvents.createdAt, window.to),
      ),
    )
    .orderBy(auditEvents.createdAt);

  const rows: ExportRow[] = events.map((event) => {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const botId =
      typeof payload.bot === "string"
        ? payload.bot
        : event.targetType === "agent" && event.targetId
          ? event.targetId
          : null;
    const bot = botId ? byBot.get(botId) : undefined;
    const workspaceId =
      typeof payload.workspace === "string"
        ? payload.workspace
        : (bot?.workspaceId ?? null);
    return {
      event_id: event.id,
      kind: "audit",
      occurred_at: event.createdAt.toISOString(),
      event_type: event.eventType,
      target_type: event.targetType,
      target_id: event.targetId,
      actor: event.actorUserId,
      bot_id: botId,
      client_id: workspaceId
        ? (byWorkspace.get(workspaceId) ?? bot?.clientId ?? null)
        : null,
      workspace_id: workspaceId,
      tool_ref:
        typeof payload.server === "string" && typeof payload.tool === "string"
          ? `${payload.server}/${payload.tool}`
          : typeof payload.tool === "string"
            ? payload.tool
            : null,
      decision: null,
      payload: JSON.stringify(payload),
      exported_at: exportedAt,
    };
  });

  const decided = await database
    .select()
    .from(approvals)
    .where(
      and(
        gte(approvals.createdAt, window.from),
        lt(approvals.createdAt, window.to),
      ),
    );
  for (const approval of decided) {
    rows.push({
      event_id: `approval:${approval.id}`,
      kind: "approval",
      occurred_at: approval.createdAt.toISOString(),
      event_type: approval.decision
        ? `approval.${approval.decision}`
        : "approval.open",
      target_type: "approval",
      target_id: approval.id,
      actor: approval.decidedBy ?? approval.requestedByActor ?? null,
      bot_id: approval.botId,
      client_id: approval.workspaceId
        ? (byWorkspace.get(approval.workspaceId) ?? null)
        : null,
      workspace_id: approval.workspaceId ?? null,
      tool_ref: approval.toolRef,
      decision: approval.decision ?? null,
      payload: JSON.stringify({
        args: approval.args,
        thread: approval.threadId,
        decidedAt: approval.decidedAt?.toISOString() ?? null,
        usedAt: approval.usedAt?.toISOString() ?? null,
      }),
      exported_at: exportedAt,
    });
  }

  await database.$client.end({ timeout: 5 });

  // EXPORT_DRY_RUN=1 counts and shows the first row without touching BigQuery; for a local check.
  if (rows.length === 0 || process.env.EXPORT_DRY_RUN === "1") {
    console.log(
      JSON.stringify({
        type: "bots-audit-export",
        day: window.label,
        rows: rows.length,
        dryRun: process.env.EXPORT_DRY_RUN === "1",
        first: rows[0] ?? null,
      }),
    );
    return;
  }

  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/bigquery.insertdata"],
  });
  const client = await auth.getClient();
  const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${project}/datasets/${dataset}/tables/${tableId}/insertAll`;
  let inserted = 0;
  for (let at = 0; at < rows.length; at += 500) {
    const batch = rows.slice(at, at + 500);
    const response = await client.request<{
      insertErrors?: { index: number; errors: { message: string }[] }[];
    }>({
      url,
      method: "POST",
      data: {
        skipInvalidRows: false,
        ignoreUnknownValues: false,
        rows: batch.map((row) => ({ insertId: row.event_id, json: row })),
      },
    });
    const errors = response.data.insertErrors ?? [];
    if (errors.length > 0) {
      throw new Error(
        `BigQuery refused ${errors.length} rows: ${errors[0]?.errors[0]?.message ?? "unknown"}`,
      );
    }
    inserted += batch.length;
  }
  console.log(
    JSON.stringify({
      type: "bots-audit-export",
      day: window.label,
      rows: inserted,
      table,
    }),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      type: "bots-audit-export-failed",
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exit(1);
});
