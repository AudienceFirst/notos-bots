// NOTOS: Gmail, Shopify en Webflow als persoonlijke koppelingen (bouwplan stap 7).
import { afterEach, describe, expect, test } from "bun:test";
import {
  authForInstance,
  catalogueEntry,
  classifyTool,
  hostAdmissible,
} from "../../src/plugins/catalogue";
import {
  addressesIn,
  bodyText,
  callTool as gmailCall,
  hasExternalRecipient,
  rawMessage,
} from "../../src/plugins/gmail-rest";
import { callTool as shopifyCall } from "../../src/plugins/shopify-rest";

const realFetch = globalThis.fetch;
type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];

function stubFetch(answer: (call: Call) => unknown) {
  calls = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init };
    calls.push(call);
    return new Response(JSON.stringify(answer(call)), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

const gmail = { url: "https://gmail.googleapis.com/gmail/v1", token: "t" };

describe("the catalogue", () => {
  test("Gmail writes are the draft and the send; the reads are reads", () => {
    const entry = catalogueEntry("gmail");
    expect(entry).not.toBeNull();
    if (!entry) return;
    expect(classifyTool(entry, "send_message", true)).toBe("write");
    expect(classifyTool(entry, "create_draft", true)).toBe("write");
    expect(classifyTool(entry, "search_messages", true)).toBe("read");
  });

  test("Webflow counts anything that changes as a write, even before its tools are known", () => {
    const entry = catalogueEntry("webflow");
    expect(entry).not.toBeNull();
    if (!entry) return;
    expect(classifyTool(entry, "sites_publish", true)).toBe("write");
    expect(classifyTool(entry, "collections_items_update_items", true)).toBe(
      "write",
    );
    expect(classifyTool(entry, "sites_list", true)).toBe("read");
    // Not advertised at all: unknown is a write, as upstream decides.
    expect(classifyTool(entry, "sites_list", false)).toBe("write");
  });

  test("a Shopify shop authorises at its own host, and only a myshopify host is admissible", () => {
    const entry = catalogueEntry("shopify");
    expect(entry).not.toBeNull();
    if (!entry) return;
    expect(hostAdmissible(entry, "https://youp-sleep.myshopify.com")).toBe(
      true,
    );
    expect(hostAdmissible(entry, "https://evil.example.com")).toBe(false);
    if (entry.auth.kind !== "user-oauth")
      throw new Error("expected user-oauth");
    const auth = authForInstance(
      entry.auth,
      entry,
      "https://youp-sleep.myshopify.com/admin/api/2026-07/graphql.json",
    );
    expect(auth.authorizationUrl).toBe(
      "https://youp-sleep.myshopify.com/admin/oauth/authorize",
    );
    expect(auth.tokenUrl).toBe(
      "https://youp-sleep.myshopify.com/admin/oauth/access_token",
    );
    // A fixed-host vendor comes back untouched.
    const frida = catalogueEntry("frida");
    if (frida?.auth.kind === "user-oauth") {
      expect(authForInstance(frida.auth, frida, "https://x")).toBe(frida.auth);
    }
  });
});

describe("Gmail as the person asking", () => {
  test("a search lists the newest matches with sender, subject and ids", async () => {
    stubFetch(({ url }) => {
      if (url.includes("/users/me/messages?")) {
        return { messages: [{ id: "m1" }] };
      }
      const wantsSubject = url.includes("metadataHeaders=Subject");
      return {
        id: "m1",
        threadId: "t1",
        internalDate: "1757030400000",
        snippet: "Hoi Mitch, zie bijlage",
        payload: {
          headers: wantsSubject
            ? [{ name: "Subject", value: "Zoover briefing" }]
            : [{ name: "From", value: "Reinoud <reinoud@zoover.nl>" }],
        },
      };
    });
    const result = await gmailCall(gmail, "search_messages", {
      query: "from:zoover.nl",
    });
    expect(result.isError).toBe(false);
    expect(result.text).toContain("from: Reinoud <reinoud@zoover.nl>");
    expect(result.text).toContain("subject: Zoover briefing");
    expect(result.text).toContain("id: m1");
    expect(calls[0]?.url).toContain("q=from%3Azoover.nl");
    expect(calls[0]?.url).toContain("maxResults=10");
    expect(calls[0]?.url).not.toContain("token");
  });

  test("a message body prefers text, falls back to stripped html", () => {
    const text = Buffer.from("Hallo\nplain").toString("base64url");
    const html = Buffer.from("<p>Hallo</p><p>html &amp; zo</p>").toString(
      "base64url",
    );
    expect(
      bodyText({
        mimeType: "multipart/alternative",
        parts: [
          { mimeType: "text/html", body: { data: html } },
          { mimeType: "text/plain", body: { data: text } },
        ],
      }),
    ).toBe("Hallo\nplain");
    expect(bodyText({ mimeType: "text/html", body: { data: html } })).toBe(
      "Hallo\nhtml & zo",
    );
  });

  test("a send inside the organisation is sent; a send to anybody outside becomes a draft", async () => {
    stubFetch(({ url }) =>
      url.endsWith("/drafts") ? { id: "d1" } : { id: "sent1" },
    );
    const inside = await gmailCall(gmail, "send_message", {
      to: "ruben@zuid.com",
      subject: "Weekstart",
      bodyHtml: "<p>hoi</p>",
    });
    expect(inside.isError).toBe(false);
    expect(inside.text).toContain("Sent to ruben@zuid.com");
    expect(calls.at(-1)?.url).toContain("/users/me/messages/send");

    const outside = await gmailCall(gmail, "send_message", {
      to: "reinoud@zoover.nl",
      cc: "mitch@zuid.com",
      subject: "Briefing",
      bodyHtml: "<p>hoi</p>",
    });
    expect(outside.isError).toBe(false);
    expect(outside.text).toContain("extern: als concept klaargezet");
    expect(outside.text).toContain("NOT sent");
    expect(calls.at(-1)?.url).toContain("/users/me/drafts");
    const body = JSON.parse(String(calls.at(-1)?.init?.body)) as {
      message: { raw: string };
    };
    const raw = Buffer.from(body.message.raw, "base64url").toString("utf8");
    expect(raw).toContain("To: reinoud@zoover.nl");
    expect(raw).toContain("Cc: mitch@zuid.com");
  });

  test("addresses and the internal-domain rule", () => {
    expect(addressesIn("Reinoud <Reinoud@Zoover.nl>, mitch@zuid.com")).toEqual([
      "reinoud@zoover.nl",
      "mitch@zuid.com",
    ]);
    expect(hasExternalRecipient(["mitch@zuid.com"], ["zuid.com"])).toBe(false);
    expect(hasExternalRecipient(["mitch@zuid.com, x@y.nl"], ["zuid.com"])).toBe(
      true,
    );
    const raw = Buffer.from(
      rawMessage({ to: "a@zuid.com", subject: "Één", bodyHtml: "<b>x</b>" }),
      "base64url",
    ).toString("utf8");
    expect(raw).toContain("Subject: =?UTF-8?B?");
    expect(raw).toContain('Content-Type: text/html; charset="UTF-8"');
  });
});

describe("Shopify read-only", () => {
  test("orders are asked with the shop token header and listed newest first", async () => {
    stubFetch(() => ({
      data: {
        orders: {
          nodes: [
            {
              id: "gid://shopify/Order/1",
              name: "#1001",
              createdAt: "2026-09-04T10:00:00Z",
              displayFinancialStatus: "PAID",
              displayFulfillmentStatus: "UNFULFILLED",
              customer: { displayName: "Judith", email: "j@example.nl" },
              totalPriceSet: {
                shopMoney: { amount: "89.00", currencyCode: "EUR" },
              },
            },
          ],
        },
      },
    }));
    const result = await shopifyCall(
      {
        url: "https://youp-sleep.myshopify.com/admin/api/2026-07/graphql.json",
        token: "shpat_x",
      },
      "list_orders",
      { since: "2026-09-01" },
    );
    expect(result.isError).toBe(false);
    expect(result.text).toContain("#1001");
    expect(result.text).toContain("89.00 EUR");
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers["x-shopify-access-token"]).toBe("shpat_x");
    expect(headers.authorization).toBeUndefined();
    const body = JSON.parse(String(calls[0]?.init?.body)) as {
      variables: { q: string };
    };
    expect(body.variables.q).toBe("created_at:>=2026-09-01");
  });

  test("a GraphQL error is an error, not an empty answer", async () => {
    stubFetch(() => ({ errors: [{ message: "Access denied for orders" }] }));
    const result = await shopifyCall(
      {
        url: "https://x.myshopify.com/admin/api/2026-07/graphql.json",
        token: "t",
      },
      "get_shop",
      {},
    );
    expect(result.isError).toBe(true);
    expect(result.text).toContain("Access denied");
  });
});
