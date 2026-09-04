// NOTOS: een Shopify-winkel lezen als de persoon die vraagt, via de Admin GraphQL API (stap 7).
/*
 * Read-only in v1: shop, products, orders. The catalogue lists no write tools, and there are none
 * here to list. Shopify sends the token in `X-Shopify-Access-Token`, not as Bearer, so this
 * transport sets its own header. The connection URL is the shop's own GraphQL endpoint, chosen at
 * connect time from the shop name (a per-instance host in the catalogue).
 */
import { MAX_RESULT_CHARS, type McpCallResult, type McpTool } from "./mcp";

const REQUEST_TIMEOUT_MS = 30_000;
const PAGE = 20;

const TOOLS: readonly McpTool[] = Object.freeze([
  {
    name: "get_shop",
    description: "The shop's name, domain, currency, plan and contact address.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "search_products",
    description:
      "Search products by title, vendor, tag or SKU. Returns title, status, vendor, price range and the product id.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Shopify product search syntax, for example 'title:kussen status:active'.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_orders",
    description:
      "The newest orders, optionally only those created since a date. Returns order name, date, customer, total and status.",
    inputSchema: {
      type: "object",
      properties: {
        since: {
          type: "string",
          description: "ISO date; only orders created on or after it.",
        },
      },
    },
  },
  {
    name: "get_order",
    description:
      "One order by its id (gid://shopify/Order/… or the number), with its line items.",
    inputSchema: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order id or gid." },
      },
      required: ["orderId"],
    },
  },
]);

type Connection = { url: string; token?: string };

export const listNeedsCredential = false;

export async function listTools(_connection: Connection): Promise<McpTool[]> {
  return TOOLS.map((tool) => ({ ...tool }));
}

async function graphql(
  connection: Connection,
  query: string,
  variables: Record<string, unknown>,
): Promise<
  { ok: true; data: Record<string, unknown> } | { ok: false; message: string }
> {
  if (!connection.token) {
    return { ok: false, message: "No credential was available for this call." };
  }
  let response: Response;
  try {
    response = await fetch(connection.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-shopify-access-token": connection.token,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.name === "TimeoutError"
          ? "Shopify did not answer in time."
          : `Shopify could not be reached: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      message: `Shopify refused this request (${response.status}).`,
    };
  }
  const body = (await response.json()) as {
    data?: Record<string, unknown>;
    errors?: { message?: string }[];
  };
  if (body.errors?.length) {
    return {
      ok: false,
      message: `Shopify answered with an error: ${body.errors[0]?.message ?? "unknown"}`,
    };
  }
  return { ok: true, data: body.data ?? {} };
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

type Money = { amount?: string; currencyCode?: string };
const money = (value: Money | undefined) =>
  value?.amount ? `${value.amount} ${value.currencyCode ?? ""}`.trim() : "-";

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

  if (toolName === "get_shop") {
    const result = await graphql(
      connection,
      "{ shop { name myshopifyDomain primaryDomain { host } currencyCode plan { displayName } contactEmail } }",
      {},
    );
    if (!result.ok) return failure(result.message);
    const shop = result.data.shop as Record<string, unknown> | undefined;
    if (!shop) return asResult("");
    return asResult(
      [
        `name: ${shop.name}`,
        `domain: ${(shop.primaryDomain as { host?: string } | undefined)?.host ?? shop.myshopifyDomain}`,
        `currency: ${shop.currencyCode}`,
        `plan: ${(shop.plan as { displayName?: string } | undefined)?.displayName ?? "-"}`,
        `contact: ${shop.contactEmail ?? "-"}`,
      ].join("\n"),
    );
  }

  if (toolName === "search_products") {
    const query = stringArg("query");
    if (!query) return failure("A search needs something to search for.");
    const result = await graphql(
      connection,
      `query($q: String!, $n: Int!) { products(first: $n, query: $q) { nodes { id title status vendor totalInventory priceRangeV2 { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } } } } }`,
      { q: query, n: PAGE },
    );
    if (!result.ok) return failure(result.message);
    const nodes =
      (
        result.data.products as
          | { nodes?: Record<string, unknown>[] }
          | undefined
      )?.nodes ?? [];
    return asResult(
      nodes
        .map((product) => {
          const range = product.priceRangeV2 as
            | { minVariantPrice?: Money; maxVariantPrice?: Money }
            | undefined;
          return `- ${product.title} · ${product.status} · ${product.vendor ?? "-"} · ${money(range?.minVariantPrice)}${
            range?.maxVariantPrice?.amount !== range?.minVariantPrice?.amount
              ? ` to ${money(range?.maxVariantPrice)}`
              : ""
          } · stock ${product.totalInventory ?? "?"} · id: ${product.id}`;
        })
        .join("\n"),
    );
  }

  if (toolName === "list_orders") {
    const since = stringArg("since");
    const result = await graphql(
      connection,
      `query($q: String, $n: Int!) { orders(first: $n, query: $q, sortKey: CREATED_AT, reverse: true) { nodes { id name createdAt displayFinancialStatus displayFulfillmentStatus customer { displayName email } totalPriceSet { shopMoney { amount currencyCode } } } } }`,
      { q: since ? `created_at:>=${since}` : null, n: PAGE },
    );
    if (!result.ok) return failure(result.message);
    const nodes =
      (result.data.orders as { nodes?: Record<string, unknown>[] } | undefined)
        ?.nodes ?? [];
    return asResult(
      nodes
        .map((order) => {
          const customer = order.customer as {
            displayName?: string;
            email?: string;
          } | null;
          const total = (
            order.totalPriceSet as { shopMoney?: Money } | undefined
          )?.shopMoney;
          return `- ${order.name} · ${order.createdAt} · ${customer?.displayName ?? "-"} (${customer?.email ?? "-"}) · ${money(total)} · ${order.displayFinancialStatus} / ${order.displayFulfillmentStatus} · id: ${order.id}`;
        })
        .join("\n"),
    );
  }

  if (toolName === "get_order") {
    const orderId = stringArg("orderId");
    if (!orderId) return failure("An order id is needed to read an order.");
    const gid = orderId.startsWith("gid://")
      ? orderId
      : `gid://shopify/Order/${orderId}`;
    const result = await graphql(
      connection,
      `query($id: ID!) { order(id: $id) { id name createdAt displayFinancialStatus displayFulfillmentStatus customer { displayName email } totalPriceSet { shopMoney { amount currencyCode } } shippingAddress { city country } lineItems(first: 50) { nodes { title quantity sku originalUnitPriceSet { shopMoney { amount currencyCode } } } } } }`,
      { id: gid },
    );
    if (!result.ok) return failure(result.message);
    const order = result.data.order as Record<string, unknown> | null;
    if (!order) return asResult("");
    const customer = order.customer as {
      displayName?: string;
      email?: string;
    } | null;
    const total = (order.totalPriceSet as { shopMoney?: Money } | undefined)
      ?.shopMoney;
    const address = order.shippingAddress as {
      city?: string;
      country?: string;
    } | null;
    const items =
      (order.lineItems as { nodes?: Record<string, unknown>[] } | undefined)
        ?.nodes ?? [];
    return asResult(
      [
        `${order.name} · ${order.createdAt} · ${order.displayFinancialStatus} / ${order.displayFulfillmentStatus}`,
        `customer: ${customer?.displayName ?? "-"} (${customer?.email ?? "-"})`,
        `ships to: ${address?.city ?? "-"}, ${address?.country ?? "-"}`,
        `total: ${money(total)}`,
        "items:",
        ...items.map(
          (item) =>
            `- ${item.quantity} × ${item.title}${item.sku ? ` (${item.sku})` : ""} · ${money((item.originalUnitPriceSet as { shopMoney?: Money } | undefined)?.shopMoney)}`,
        ),
      ].join("\n"),
    );
  }

  return failure(`Shopify has no tool called ${toolName}.`);
}
