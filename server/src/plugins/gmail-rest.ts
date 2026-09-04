// NOTOS: Gmail als de persoon die vraagt, via de Gmail REST API (bouwplan stap 7).
/*
 * Same shape as google-drive-rest.ts: a fixed tool list, one `request` helper, and text results a
 * model reads. Reads are search, one message, one thread. Writes are a draft and a send; both are
 * `writeTools` in the catalogue, so they wait for a person (stap 5). On top of that, a send to an
 * address outside the internal domains never leaves: it becomes a draft, and the Bot is told so.
 * That is the NOTOS rule "mail naar klanten altijd als concept", enforced here rather than hoped for.
 */
import { MAX_RESULT_CHARS, type McpCallResult, type McpTool } from "./mcp";

const REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_MAX = 10;
const MAX_MAX = 25;
/** Where a person is "inside": a send to anywhere else is a draft. Same setting as the identity. */
const INTERNAL_DOMAINS = (process.env.INTERNAL_DOMAINS ?? "zuid.com")
  .split(",")
  .map((domain) => domain.trim().toLowerCase())
  .filter(Boolean);

const TOOLS: readonly McpTool[] = Object.freeze([
  {
    name: "search_messages",
    description:
      "Search your Gmail with a Gmail search query (the same syntax as the search box: from:, to:, subject:, newer_than:7d, has:attachment). Returns the newest matches with sender, date, subject and a snippet.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The Gmail search query, for example 'from:zoover.nl newer_than:7d'.",
        },
        max: {
          type: "integer",
          description: `How many messages at most (default ${DEFAULT_MAX}, at most ${MAX_MAX}).`,
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_message",
    description:
      "Read one message by its id: headers and the text of the body.",
    inputSchema: {
      type: "object",
      properties: {
        messageId: {
          type: "string",
          description: "The message id from a search.",
        },
      },
      required: ["messageId"],
    },
  },
  {
    name: "get_thread",
    description:
      "Read a whole conversation by its thread id, oldest message first.",
    inputSchema: {
      type: "object",
      properties: {
        threadId: {
          type: "string",
          description: "The thread id from a search or a message.",
        },
      },
      required: ["threadId"],
    },
  },
  {
    name: "create_draft",
    description:
      "Put a draft in your Gmail Drafts folder. Nothing is sent; the person sends it themselves.",
    inputSchema: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Recipient address(es), comma separated.",
        },
        subject: { type: "string" },
        bodyHtml: { type: "string", description: "The body as HTML." },
        cc: { type: "string", description: "Optional cc address(es)." },
      },
      required: ["to", "subject", "bodyHtml"],
    },
  },
  {
    name: "send_message",
    description:
      "Send a message from your Gmail. Only to addresses inside the organisation: a message to anybody outside is put in Drafts instead, for the person to send.",
    inputSchema: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Recipient address(es), comma separated.",
        },
        subject: { type: "string" },
        bodyHtml: { type: "string", description: "The body as HTML." },
        cc: { type: "string", description: "Optional cc address(es)." },
      },
      required: ["to", "subject", "bodyHtml"],
    },
  },
]);

type Connection = { url: string; token?: string };

export const listNeedsCredential = false;

export async function listTools(_connection: Connection): Promise<McpTool[]> {
  return TOOLS.map((tool) => ({ ...tool }));
}

type GmailHeader = { name?: string; value?: string };
type GmailPart = {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
  headers?: GmailHeader[];
};
type GmailMessage = {
  id?: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
};

async function request(
  connection: Connection,
  path: string,
  init: {
    query?: Record<string, string>;
    method?: string;
    body?: unknown;
  } = {},
): Promise<{ ok: true; response: Response } | { ok: false; message: string }> {
  if (!connection.token) {
    return { ok: false, message: "No credential was available for this call." };
  }
  const url = new URL(`${connection.url.replace(/\/+$/, "")}${path}`);
  for (const [key, value] of Object.entries(init.query ?? {})) {
    url.searchParams.set(key, value);
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${connection.token}`,
        ...(init.body !== undefined
          ? { "content-type": "application/json" }
          : {}),
      },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.name === "TimeoutError"
          ? "Gmail did not answer in time."
          : `Gmail could not be reached: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let detail = "";
    try {
      const parsed = JSON.parse(body) as { error?: { message?: unknown } };
      if (typeof parsed.error?.message === "string")
        detail = parsed.error.message;
    } catch {
      // Not JSON; the status is all there is to say.
    }
    return {
      ok: false,
      message: detail
        ? `Gmail refused this request (${response.status}): ${detail}`
        : `Gmail refused this request (${response.status}).`,
    };
  }
  return { ok: true, response };
}

function header(part: GmailPart | undefined, name: string): string {
  const found = part?.headers?.find(
    (candidate) => candidate.name?.toLowerCase() === name.toLowerCase(),
  );
  return found?.value ?? "";
}

function decodeBody(data: string | undefined): string {
  if (!data) return "";
  return Buffer.from(
    data.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  ).toString("utf8");
}

/** Plain text first; HTML stripped as the fallback; nothing from attachments. */
export function bodyText(part: GmailPart | undefined): string {
  if (!part) return "";
  const collect = (node: GmailPart, want: string): string | null => {
    if (node.mimeType === want && node.body?.data)
      return decodeBody(node.body.data);
    for (const child of node.parts ?? []) {
      const hit = collect(child, want);
      if (hit !== null) return hit;
    }
    return null;
  };
  const plain = collect(part, "text/plain");
  if (plain !== null) return plain.trim();
  const html = collect(part, "text/html");
  if (html !== null) return stripHtml(html);
  return "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function when(message: GmailMessage): string {
  const ms = Number(message.internalDate);
  return Number.isFinite(ms) && ms > 0
    ? new Date(ms).toISOString()
    : header(message.payload, "Date");
}

function summaryLine(message: GmailMessage): string {
  return [
    `- ${when(message)}`,
    `from: ${header(message.payload, "From")}`,
    `subject: ${header(message.payload, "Subject")}`,
    `id: ${message.id ?? "?"}`,
    `thread: ${message.threadId ?? "?"}`,
    message.snippet ? `snippet: ${message.snippet}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function messageText(message: GmailMessage): string {
  return [
    `From: ${header(message.payload, "From")}`,
    `To: ${header(message.payload, "To")}`,
    header(message.payload, "Cc")
      ? `Cc: ${header(message.payload, "Cc")}`
      : null,
    `Date: ${when(message)}`,
    `Subject: ${header(message.payload, "Subject")}`,
    `Id: ${message.id ?? "?"} · thread: ${message.threadId ?? "?"}`,
    "",
    bodyText(message.payload) || "(no readable text in this message)",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function asResult(text: string): McpCallResult {
  const joined = text.trim();
  if (joined === "") {
    return {
      text: "The tool returned no content. Nothing was found, so there is nothing here to answer from.",
      isError: false,
      truncated: false,
    };
  }
  if (joined.length <= MAX_RESULT_CHARS) {
    return { text: joined, isError: false, truncated: false };
  }
  return {
    text: `${joined.slice(0, MAX_RESULT_CHARS)}\n\n[truncated: the tool returned ${joined.length} characters]`,
    isError: false,
    truncated: true,
  };
}

const failure = (message: string): McpCallResult => ({
  text: message,
  isError: true,
  truncated: false,
});

/** RFC 2822 message as Gmail wants it: base64url of the raw text. */
export function rawMessage(input: {
  to: string;
  cc?: string;
  subject: string;
  bodyHtml: string;
}): string {
  const subject = `=?UTF-8?B?${Buffer.from(input.subject, "utf8").toString("base64")}?=`;
  const lines = [
    `To: ${input.to}`,
    ...(input.cc ? [`Cc: ${input.cc}`] : []),
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(input.bodyHtml, "utf8").toString("base64"),
  ];
  return Buffer.from(lines.join("\r\n"), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Every address in a To/Cc line, lower-cased. */
export function addressesIn(line: string): string[] {
  return (line.match(/[^\s<>,;"']+@[^\s<>,;"']+/g) ?? []).map((address) =>
    address.toLowerCase(),
  );
}

/** True when at least one recipient is outside the internal domains. */
export function hasExternalRecipient(
  lines: string[],
  internalDomains: readonly string[] = INTERNAL_DOMAINS,
): boolean {
  return lines
    .flatMap(addressesIn)
    .some((address) => !internalDomains.includes(address.split("@")[1] ?? ""));
}

export async function callTool(
  connection: Connection,
  toolName: string,
  args: Record<string, unknown>,
): Promise<McpCallResult> {
  const stringArg = (key: string): string | null => {
    const value = args[key];
    return typeof value === "string" && value.trim() !== ""
      ? value.trim()
      : null;
  };

  if (toolName === "search_messages") {
    const query = stringArg("query");
    if (!query) return failure("A search needs a Gmail query.");
    const asked = Number(args.max);
    const max =
      Number.isFinite(asked) && asked > 0
        ? Math.min(asked, MAX_MAX)
        : DEFAULT_MAX;
    const list = await request(connection, "/users/me/messages", {
      query: { q: query, maxResults: String(max) },
    });
    if (!list.ok) return failure(list.message);
    const body = (await list.response.json()) as {
      messages?: { id: string }[];
    };
    const ids = (body.messages ?? []).map((message) => message.id);
    const lines: string[] = [];
    for (const id of ids) {
      const one = await request(
        connection,
        `/users/me/messages/${encodeURIComponent(id)}`,
        {
          query: {
            format: "metadata",
            metadataHeaders: "From",
          },
        },
      );
      if (!one.ok) return failure(one.message);
      // Gmail takes one metadataHeaders value per query key; ask for the rest the same way.
      const message = (await one.response.json()) as GmailMessage;
      const more = await request(
        connection,
        `/users/me/messages/${encodeURIComponent(id)}`,
        {
          query: { format: "metadata", metadataHeaders: "Subject" },
        },
      );
      if (more.ok) {
        const extra = (await more.response.json()) as GmailMessage;
        message.payload = {
          ...message.payload,
          headers: [
            ...(message.payload?.headers ?? []),
            ...(extra.payload?.headers ?? []),
          ],
        };
      }
      lines.push(summaryLine(message));
    }
    return asResult(lines.join("\n"));
  }

  if (toolName === "get_message") {
    const messageId = stringArg("messageId");
    if (!messageId) return failure("A message id is needed to read a message.");
    const result = await request(
      connection,
      `/users/me/messages/${encodeURIComponent(messageId)}`,
      { query: { format: "full" } },
    );
    if (!result.ok) return failure(result.message);
    return asResult(
      messageText((await result.response.json()) as GmailMessage),
    );
  }

  if (toolName === "get_thread") {
    const threadId = stringArg("threadId");
    if (!threadId)
      return failure("A thread id is needed to read a conversation.");
    const result = await request(
      connection,
      `/users/me/threads/${encodeURIComponent(threadId)}`,
      { query: { format: "full" } },
    );
    if (!result.ok) return failure(result.message);
    const thread = (await result.response.json()) as {
      messages?: GmailMessage[];
    };
    return asResult(
      (thread.messages ?? []).map(messageText).join("\n\n----------------\n\n"),
    );
  }

  if (toolName === "create_draft" || toolName === "send_message") {
    const to = stringArg("to");
    const subject = stringArg("subject");
    const bodyHtml = stringArg("bodyHtml");
    const cc = stringArg("cc") ?? undefined;
    if (!to || !subject || !bodyHtml) {
      return failure("A recipient, a subject and a body are needed.");
    }
    const raw = rawMessage({ to, subject, bodyHtml, ...(cc ? { cc } : {}) });
    const external = hasExternalRecipient([to, cc ?? ""]);
    const asDraft = toolName === "create_draft" || external;
    const result = await request(
      connection,
      asDraft ? "/users/me/drafts" : "/users/me/messages/send",
      {
        method: "POST",
        body: asDraft ? { message: { raw } } : { raw },
      },
    );
    if (!result.ok) return failure(result.message);
    const body = (await result.response.json()) as {
      id?: string;
      message?: { id?: string };
    };
    if (toolName === "send_message" && external) {
      return asResult(
        `extern: als concept klaargezet. ${to} is outside the organisation, so this was NOT sent: it is in ` +
          `the person's Drafts (draft id ${body.id ?? "?"}) for them to read and send themselves. Tell them so.`,
      );
    }
    return asResult(
      asDraft
        ? `Draft saved (draft id ${body.id ?? "?"}). Nothing was sent.`
        : `Sent to ${to} (message id ${body.id ?? "?"}).`,
    );
  }

  return failure(`Gmail has no tool called ${toolName}.`);
}
