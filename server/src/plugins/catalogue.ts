/**
 * The catalogue of MCP servers this deployment will talk to, and the rule that decides admissibility.
 *
 * First-party only, and the list is frozen in code. A remote MCP server is a piece of somebody
 * else's software that our Bots hand credentials to and take instructions from, so "which servers"
 * is a decision to make once, in review, rather than one to leave to whoever is typing a URL into an
 * admin page at the time. Only servers the vendor themselves maintains are here. A community server
 * that wraps the same API is not equivalent: it is an extra party in the trust path with none of the
 * accountability, and the answer for a vendor without an official server is to wait for one.
 *
 * Every host and path here comes from the vendor's published documentation. They are pinned rather
 * than discovered, because a URL this deployment will hand a credential to is a reviewed source
 * contract.
 *
 * Admissibility is fail-closed and checked against the pinned host, never against what a caller
 * supplied. A URL that does not exactly match a pinned host, or match one anchored per-instance
 * pattern, is refused. This is the control that stops "add an MCP server" from being a request
 * forgery primitive pointed at the deployment's own network.
 */

/**
 * How a server is authenticated, and whose credential does it.
 *
 * The OAuth addresses are pinned here beside the MCP host, for the same reason and with the same
 * rule: they come from the vendor's published documentation and are never taken from a caller.
 * These are where this deployment sends a person's authorization code and receives the refresh
 * token that stands in for their access, so they are a reviewed source contract too.
 */
// The one place browsing and this check agree on: the addresses that hold the deployment's own
// cloud credentials. `target.ts` imports nothing itself, so asking it here adds no dependency.
import { isNeverAllowedHostname } from "../computer/target";
// Type-only, so naming the transport here creates no import cycle with the registry that resolves it.
import type { TransportKind } from "./transport";

export type CatalogueAuth =
  /** Answers without any credential at all. */
  | { kind: "none" }
  /** One token, held by the deployment, used for everybody. */
  | { kind: "deployment-bearer" }
  /**
   * First-party and in-process. There is no credential, because there is nothing to authenticate
   * to: the call runs against this deployment's own tables, as the person whose turn it is.
   */
  | { kind: "builtin" }
  /**
   * The asker's own grant. The deployment registers an OAuth client; each person consents once and
   * the call runs on their token, so the vendor decides what comes back.
   */
  | {
      kind: "user-oauth";
      authorizationUrl: string;
      tokenUrl: string;
      /** Where a disconnect is sent, so revocation happens at the vendor and not just here. */
      revokeUrl: string;
      /**
       * What to ask a person to consent to. Narrow on purpose: a scope granted by everybody who
       * connects and used by nothing is a permission nobody remembers agreeing to. Empty for a
       * vendor whose consent screen itself is the scoping (Notion), where scope strings would
       * assert a control that does not exist.
       */
      scopes: readonly string[];
      /**
       * How the deployment gets its OAuth client. Absent means an administrator registers one at
       * the vendor and pastes it in. `dynamic` means the deployment registers ITSELF (RFC 7591)
       * on first connect — no admin step, no client secret; PKCE carries the proof instead.
       */
      clientRegistration?: "dynamic";
      /** The RFC 7591 endpoint. Pinned https, required when `clientRegistration` is `dynamic`. */
      registrationUrl?: string;
      /**
       * Vendor-specific consent-URL parameters. Google's offline/consent pair lives HERE rather
       * than in `authorizationUrlFor`, so one vendor's requirements are never sent to another —
       * an unknown parameter is a thing a strict vendor may refuse the whole request over.
       */
      authorizationParams?: Readonly<Record<string, string>>;
    };

export type CatalogueEntry = {
  /** Stable slug. Prefixes every tool name, so tools from two servers can never collide. */
  key: string;
  title: string;
  vendor: string;
  summary: string;
  /**
   * The one host this server lives on. Null for a vendor that gives every customer their own
   * hostname, where {@link CatalogueEntry.hostPattern} decides instead.
   */
  host: string | null;
  /**
   * Anchored pattern for a per-instance vendor. Only consulted when `host` is null, and written
   * anchored at both ends so it cannot match a host that merely ends in the vendor's domain.
   */
  hostPattern?: string;
  /** The path the MCP endpoint is served at. Frozen here, never taken from a caller. */
  path: string;
  /**
   * Whose credential this server is reached with.
   *
   * This used to be `needsCredential: boolean`, which said that a credential was required and not
   * whose it was. That is the one thing about a connector worth being unambiguous about: a reader
   * who has to guess guesses the deployment's, and a deployment-wide credential pointed at a
   * per-person system means everybody's question is answered from what one account can see. So the
   * shape names it, and every entry states it.
   *
   * `deployment-bearer` is a token an administrator holds on behalf of everybody. `user-oauth` is
   * the person's own grant, where the deployment holds only the OAuth client and each person
   * consents for themselves. `builtin` is neither: there is nothing to authenticate to, because the
   * call runs in this process against this deployment's own tables as the person whose turn it is.
   */
  auth: CatalogueAuth;
  /**
   * The tools this vendor's server exposes that change something.
   *
   * Kept so the policy can be written about effect rather than about tool names a rule author would
   * have to look up. Known-incomplete for some vendors, which is why {@link classifyTool} treats an
   * unknown tool as a write rather than as a read: a tool the server never advertised, so nothing
   * here could have named it, is safe to over-scrutinize as a write. The opposite direction is the
   * one that matters for this list: a tool the server DOES advertise but that is missing from here
   * classifies as a read, so an incomplete list is the failure mode, not a safe default — this list
   * has to lean over-inclusive.
   */
  writeTools: readonly string[];
  /**
   * NOTOS (stap 7): a name pattern that also counts as a write, for a vendor whose MCP lists its
   * tools only after somebody has connected (Webflow). Without it an advertised tool absent from
   * `writeTools` reads as a READ, and "publish site" would pass the gate the moment it was seen.
   */
  writeToolPattern?: RegExp;
  /**
   * Which protocol reaches this vendor. Absent means MCP, which is what every entry was.
   *
   * A field rather than an inference, because the answer is not derivable from the host: Google
   * serves Drive over both an MCP endpoint and an ordinary REST API, and which one this deployment
   * uses is a decision about availability and risk rather than a property of the vendor. Naming it
   * here keeps that decision beside the host it applies to, and makes reversing it a one-line diff.
   */
  transport?: TransportKind;
  docsUrl: string;
};

/**
 * A short list, deliberately.
 *
 * Atlassian, Box, Slack, Salesforce and ServiceNow were here and were removed: each was a reviewed
 * source contract for a vendor nobody had connected, and a screen offering five untried connectors
 * asserts more than this deployment can stand behind. They are in the history if they are wanted
 * back, and re-adding one is a review of that vendor rather than a revert.
 *
 * `deployment-bearer` therefore has no entry using it. The shape stays because the call path still
 * needs it: a server an administrator added by URL has no catalogue entry at all, and that is the
 * branch it falls into.
 *
 * Routines is the first entry here that is not a remote vendor at all — no host to dial, nothing
 * outside this process to trust. It is in the catalogue anyway, on purpose rather than by oversight:
 * the catalogue is where a deployment decides which Bots may do what, and a Bot that can schedule its
 * own future runs is a capability worth that same deliberate grant, even though there is no vendor on
 * the other end of it.
 */
/** NOTOS (stap 6): where FRIDA lives, and which tools its MCP advertised on 5 September 2026. */
export const FRIDA_HOST = "https://frida.zuid.ai";
const FRIDA_AUTH_SERVER = "https://grzydenpjgcydxiujyeg.supabase.co/auth/v1";
export const FRIDA_TOOLS: readonly string[] = Object.freeze([
  "whoami",
  "list_mijn_taken",
  "list_mijn_uren",
  "get_opdracht",
  "list_taken_opdracht",
  "get_klant",
  "get_facturatie_status",
  "list_meetings",
  "get_meeting_notes",
]);

export const CATALOGUE: readonly CatalogueEntry[] = Object.freeze([
  {
    key: "google-drive",
    title: "Google Drive",
    vendor: "Google",
    summary: "Files in the Drive of whoever is asking.",
    /*
     * Google publishes one MCP server per Workspace product, each on its own host: Gmail, Docs,
     * Sheets, Slides, Calendar, Chat and People have their own. Drive is here because it is the one
     * a question about a document needs. Each of the others is a further entry, not a flag on this
     * one, so adding Gmail stays a reviewed decision about Gmail.
     */
    /*
     * The GA REST API, not `drivemcp.googleapis.com`.
     *
     * The MCP server was the original choice and is the better one on paper: vendor-maintained, no
     * Drive-specific code here at all. It is gated behind the Google Workspace Developer Preview
     * Program, and an unenrolled project is refused with `The caller does not have permission` —
     * which describes the project, not the credential, so every check available locally reports a
     * correct setup. Enrolment is a Workspace-account application with a stated turnaround of days.
     *
     * This host has been generally available since 2015. The MCP entry is one line away: set
     * `transport` back to `mcp` and restore the host and path above. Tool names match Google's MCP
     * server exactly, so grants survive the swap in either direction.
     */
    host: "https://www.googleapis.com",
    path: "/drive/v3",
    transport: "google-drive-rest",
    /*
     * The first vendor here that cannot be reached with a token an administrator pastes. Google
     * issues no such token: access is an authorization-code grant belonging to a person. That is
     * not a limitation to work around, it is the property this connector exists for — two people
     * asking the same question should get the answers their own accounts can see.
     */
    auth: {
      kind: "user-oauth",
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      revokeUrl: "https://oauth2.googleapis.com/revoke",
      // Read-only, because nothing in this slice writes to anybody's Drive.
      scopes: Object.freeze(["https://www.googleapis.com/auth/drive.readonly"]),
      /*
       * `offline` and `consent` are both load bearing FOR GOOGLE. Without `access_type=offline`
       * Google returns no refresh token; without `prompt=consent` a reconnect returns none either.
       * They are Google parameters, so they live on Google's entry.
       */
      authorizationParams: Object.freeze({
        access_type: "offline",
        prompt: "consent",
      }),
    },
    /*
     * Named writes even though the scope above makes Google refuse them.
     *
     * Belt and braces on purpose. The scope is what stops them; this list is what keeps a boundary
     * written about writes covering them, so widening the scope later cannot quietly turn a write
     * into something the policy engine has never heard of.
     */
    writeTools: Object.freeze(["create_file", "copy_file"]),
    docsUrl:
      "https://developers.google.com/workspace/guides/configure-mcp-servers",
  },
  {
    key: "notion",
    title: "Notion",
    vendor: "Notion",
    summary: "Pages and databases of whoever is asking.",
    /*
     * The hosted MCP server Notion runs, on the default MCP transport — the first entry to use
     * it. Drive's REST adapter is a workaround for a preview-gated vendor; Notion's server is
     * generally available, so this entry is the shape the catalogue was designed for.
     */
    host: "https://mcp.notion.com",
    path: "/mcp",
    auth: {
      kind: "user-oauth",
      // From https://mcp.notion.com/.well-known/oauth-authorization-server, verified live.
      authorizationUrl: "https://mcp.notion.com/authorize",
      tokenUrl: "https://mcp.notion.com/token",
      // Notion's published revocation_endpoint IS its token endpoint — not a copy-paste mistake.
      revokeUrl: "https://mcp.notion.com/token",
      /*
       * Notion has no scope strings and no read-only scope: access is per-page, chosen on the
       * consent screen. `writeTools` below plus the action policy are the ENTIRE write barrier —
       * there is no vendor-side scope backing them up.
       */
      scopes: Object.freeze([]),
      clientRegistration: "dynamic",
      registrationUrl: "https://mcp.notion.com/register",
    },
    /*
     * The writing tools as the hosted server advertises them today. The hosted server advertises
     * its tools, so a name here that does not match an advertised tool is not the risk — an
     * advertised tool that is missing from this list is: {@link classifyTool} reads an unlisted
     * but advertised name as a read, never as a write. That makes under-inclusion the failure
     * mode, so this list has to lean over-inclusive rather than minimal, and reconciling it
     * against the live tool list on the first Refresh tools is required, not cosmetic.
     */
    writeTools: Object.freeze([
      "notion-convert-page-to-skill",
      "notion-create-attachment",
      "notion-create-comment",
      "notion-create-database",
      "notion-create-file-upload",
      "notion-create-folder",
      "notion-create-pages",
      "notion-create-view",
      "notion-duplicate-page",
      "notion-move-pages",
      "notion-update-data-source",
      "notion-update-folder",
      "notion-update-page",
      "notion-update-view",
    ]),
    docsUrl: "https://developers.notion.com/guides/mcp/build-mcp-client",
  },
  /*
   * NOTOS (stap 6): FRIDA, ZUID's own operations system, as the person asking.
   *
   * FRIDA's MCP sits behind Supabase Auth acting as an OAuth 2.1 server: the resource metadata at
   * https://frida.zuid.ai/.well-known/oauth-protected-resource names the authorization server, and
   * its discovery document offers dynamic client registration, so this entry follows Notion's shape.
   * The authorization server URL is public metadata (any client reads it from that document), not
   * the secret `frida-notos-oauth` that mge-platform's nightly copy uses; that one stays where it is.
   * `offline_access` is what makes Supabase hand out a refresh token, and it rotates on every refresh,
   * which the store already handles in place under a row lock. No revocation endpoint is published,
   * so disconnecting deletes the credential and leaves the grant at FRIDA to expire.
   * `resource` names the MCP for the token audience (RFC 8707).
   */
  {
    key: "frida",
    title: "FRIDA",
    vendor: "ZUID",
    summary:
      "Your own FRIDA account: assignments, tasks, hours and meetings as you see them, nobody else's.",
    host: FRIDA_HOST,
    path: "/mcp",
    auth: {
      kind: "user-oauth",
      authorizationUrl: `${FRIDA_AUTH_SERVER}/oauth/authorize`,
      tokenUrl: `${FRIDA_AUTH_SERVER}/oauth/token`,
      revokeUrl: `${FRIDA_AUTH_SERVER}/oauth/token`,
      scopes: Object.freeze(["openid", "email", "offline_access"]),
      clientRegistration: "dynamic",
      registrationUrl: `${FRIDA_AUTH_SERVER}/oauth/clients/register`,
      authorizationParams: Object.freeze({ resource: `${FRIDA_HOST}/mcp` }),
    },
    // FRIDA's MCP has no write tools ("Er zijn geen schrijf-tools" in its instructions).
    writeTools: Object.freeze([]),
    docsUrl: "https://frida.zuid.ai/.well-known/oauth-protected-resource",
  },
  /*
   * NOTOS (stap 7): Gmail as the person asking. Reads are search, message, thread; writes are a draft
   * and a send, both behind the approvals gate (stap 5), and a send to anybody outside the internal
   * domains becomes a draft inside gmail-rest.ts. One Google OAuth client per deployment, pasted by an
   * administrator like Drive's; the same client may serve both when it carries both scopes.
   */
  {
    key: "gmail",
    title: "Gmail",
    vendor: "Google",
    summary:
      "Your own mailbox: search and read as you, drafts in your name, sending only inside the organisation.",
    host: "https://gmail.googleapis.com",
    path: "/gmail/v1",
    transport: "gmail-rest",
    auth: {
      kind: "user-oauth",
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      revokeUrl: "https://oauth2.googleapis.com/revoke",
      scopes: Object.freeze([
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.compose",
        "https://www.googleapis.com/auth/gmail.send",
      ]),
      authorizationParams: Object.freeze({
        access_type: "offline",
        prompt: "consent",
      }),
    },
    writeTools: Object.freeze(["create_draft", "send_message"]),
    docsUrl: "https://developers.google.com/workspace/gmail/api/guides",
  },
  /*
   * NOTOS (stap 7): a Shopify shop as the person asking, read-only. Per shop: the host is chosen at
   * connect time and the OAuth URLs carry `{shop}` for it (see authForInstance). Needs a Shopify app
   * (client id and secret from the Partner dashboard) pasted by an administrator; the client
   * credentials flow NOTOS uses for a client's own shop is a different thing and stays in NOTOS.
   */
  {
    key: "shopify",
    title: "Shopify",
    vendor: "Shopify",
    summary:
      "A Shopify shop you have access to: shop, products and orders, read as you.",
    host: null,
    hostPattern: "^https://[a-z0-9-]+\\.myshopify\\.com$",
    path: "/admin/api/2026-07/graphql.json",
    transport: "shopify-rest",
    auth: {
      kind: "user-oauth",
      authorizationUrl: "https://{shop}.myshopify.com/admin/oauth/authorize",
      tokenUrl: "https://{shop}.myshopify.com/admin/oauth/access_token",
      revokeUrl: "https://{shop}.myshopify.com/admin/oauth/access_token",
      scopes: Object.freeze(["read_orders", "read_products", "read_customers"]),
    },
    writeTools: Object.freeze([]),
    docsUrl: "https://shopify.dev/docs/apps/build/authentication-authorization",
  },
  /*
   * NOTOS (stap 7): Webflow's official remote MCP with OAuth and dynamic client registration
   * (discovery at https://mcp.webflow.com/.well-known/oauth-authorization-server, checked 5 Sep 2026),
   * so it is an MCP entry like Notion. Its tool list is only visible after connecting, hence the
   * name pattern for writes: anything that creates, updates, deletes, publishes or uploads waits
   * for a person.
   */
  {
    key: "webflow",
    title: "Webflow",
    vendor: "Webflow",
    summary:
      "Your Webflow sites: pages, CMS collections and items, read as you; changes wait for a person.",
    host: "https://mcp.webflow.com",
    path: "/mcp",
    auth: {
      kind: "user-oauth",
      authorizationUrl: "https://mcp.webflow.com/oauth/authorize",
      tokenUrl: "https://mcp.webflow.com/oauth/token",
      revokeUrl: "https://mcp.webflow.com/oauth/token",
      scopes: Object.freeze([]),
      clientRegistration: "dynamic",
      registrationUrl: "https://mcp.webflow.com/oauth/register",
    },
    writeTools: Object.freeze([]),
    writeToolPattern:
      /(create|update|delete|publish|upload|remove|patch|set_|write|register|unpublish|deploy)/i,
    docsUrl: "https://developers.webflow.com/mcp/reference/overview",
  },
  /*
   * NOTOS (5 September 2026): the connectors for the Connectors tab. Every address below was read
   * from the vendor's own /.well-known/oauth-authorization-server on the day it was added; none is
   * a guess. A vendor that publishes no revocation endpoint gets its token endpoint here, like
   * Notion above: disconnecting then drops our copy of the token, which is all revocation could do.
   * The write barrier is the pattern plus the approval gate (stap 5).
   */
  {
    key: "hubspot",
    title: "HubSpot",
    vendor: "HubSpot",
    summary:
      "Contacts, companies, deals and tickets in the CRM, read as you; changes wait for a person.",
    host: "https://mcp.hubspot.com",
    path: "/",
    auth: {
      kind: "user-oauth",
      // No dynamic registration: an administrator registers a HubSpot app's client id and secret on the server first.
      authorizationUrl: "https://mcp.hubspot.com/oauth/authorize/user",
      tokenUrl: "https://mcp.hubspot.com/oauth/v3/token",
      revokeUrl: "https://mcp.hubspot.com/oauth/v3/token",
      // Read scopes for what the summary promises; names from developers.hubspot.com/docs/guides/apps/authentication/scopes.
      scopes: Object.freeze([
        "crm.objects.contacts.read",
        "crm.objects.companies.read",
        "crm.objects.deals.read",
        "tickets",
      ]),
    },
    writeTools: Object.freeze([]),
    writeToolPattern:
      /(create|update|delete|publish|upload|remove|patch|set_|write|register|unpublish|deploy|send|archive|cancel|refund|capture|charge|merge|assign|move|add_|post_|put_|import|purge)/i,
    docsUrl: "https://developers.hubspot.com/mcp",
  },
  {
    key: "linear",
    title: "Linear",
    vendor: "Linear",
    summary:
      "Issues, projects and cycles of the teams you are in; changes wait for a person.",
    host: "https://mcp.linear.app",
    path: "/mcp",
    auth: {
      kind: "user-oauth",
      authorizationUrl: "https://mcp.linear.app/authorize",
      tokenUrl: "https://mcp.linear.app/token",
      revokeUrl: "https://mcp.linear.app/token",
      scopes: Object.freeze(["read", "write"]),
      clientRegistration: "dynamic",
      registrationUrl: "https://mcp.linear.app/register",
    },
    writeTools: Object.freeze([]),
    writeToolPattern:
      /(create|update|delete|publish|upload|remove|patch|set_|write|register|unpublish|deploy|send|archive|cancel|refund|capture|charge|merge|assign|move|add_|post_|put_|import|purge)/i,
    docsUrl: "https://linear.app/docs/mcp",
  },
  {
    key: "stripe",
    title: "Stripe",
    vendor: "Stripe",
    summary:
      "Customers, payments, subscriptions and invoices of the Stripe account you pick; refunds and changes wait for a person.",
    host: "https://mcp.stripe.com",
    path: "/",
    auth: {
      kind: "user-oauth",
      authorizationUrl: "https://access.stripe.com/mcp/oauth2/authorize",
      tokenUrl: "https://access.stripe.com/mcp/oauth2/token",
      revokeUrl: "https://access.stripe.com/mcp/oauth2/token",
      scopes: Object.freeze([]),
      clientRegistration: "dynamic",
      registrationUrl: "https://access.stripe.com/mcp/oauth2/register",
    },
    writeTools: Object.freeze([]),
    writeToolPattern:
      /(create|update|delete|publish|upload|remove|patch|set_|write|register|unpublish|deploy|send|archive|cancel|refund|capture|charge|merge|assign|move|add_|post_|put_|import|purge)/i,
    docsUrl: "https://docs.stripe.com/mcp",
  },
  {
    key: "figma",
    title: "Figma",
    vendor: "Figma",
    summary:
      "Design files, components and comments you can open; nothing is changed in Figma from here.",
    host: "https://mcp.figma.com",
    path: "/mcp",
    auth: {
      kind: "user-oauth",
      authorizationUrl: "https://www.figma.com/oauth/mcp",
      tokenUrl: "https://api.figma.com/v1/oauth/token",
      revokeUrl: "https://api.figma.com/v1/oauth/token",
      scopes: Object.freeze(["mcp:connect"]),
      clientRegistration: "dynamic",
      registrationUrl: "https://api.figma.com/v1/oauth/mcp/register",
    },
    writeTools: Object.freeze([]),
    writeToolPattern:
      /(create|update|delete|publish|upload|remove|patch|set_|write|register|unpublish|deploy|send|archive|cancel|refund|capture|charge|merge|assign|move|add_|post_|put_|import|purge)/i,
    docsUrl: "https://help.figma.com/hc/en-us/articles/32132100833559",
  },
  {
    key: "paypal",
    title: "PayPal",
    vendor: "PayPal",
    summary:
      "Orders, invoices, disputes and payouts of the PayPal business account; money movements wait for a person.",
    host: "https://mcp.paypal.com",
    path: "/mcp",
    auth: {
      kind: "user-oauth",
      authorizationUrl: "https://mcp.paypal.com/authorize",
      tokenUrl: "https://mcp.paypal.com/token",
      revokeUrl: "https://mcp.paypal.com/token",
      scopes: Object.freeze([]),
      clientRegistration: "dynamic",
      registrationUrl: "https://mcp.paypal.com/register",
    },
    writeTools: Object.freeze([]),
    writeToolPattern:
      /(create|update|delete|publish|upload|remove|patch|set_|write|register|unpublish|deploy|send|archive|cancel|refund|capture|charge|merge|assign|move|add_|post_|put_|import|purge)/i,
    docsUrl: "https://developer.paypal.com/tools/mcp-server/",
  },
  {
    key: "cloudflare",
    title: "Cloudflare",
    vendor: "Cloudflare",
    summary:
      "Zones, DNS, Workers and analytics of the Cloudflare account you connect; changes wait for a person.",
    host: "https://mcp.cloudflare.com",
    path: "/mcp",
    auth: {
      kind: "user-oauth",
      authorizationUrl: "https://mcp.cloudflare.com/authorize",
      tokenUrl: "https://mcp.cloudflare.com/token",
      revokeUrl: "https://mcp.cloudflare.com/token",
      scopes: Object.freeze([]),
      clientRegistration: "dynamic",
      registrationUrl: "https://mcp.cloudflare.com/register",
    },
    writeTools: Object.freeze([]),
    writeToolPattern:
      /(create|update|delete|publish|upload|remove|patch|set_|write|register|unpublish|deploy|send|archive|cancel|refund|capture|charge|merge|assign|move|add_|post_|put_|import|purge)/i,
    docsUrl:
      "https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/",
  },
  {
    key: "monday",
    title: "monday.com",
    vendor: "monday.com",
    summary:
      "Boards, items and updates of the workspaces you are in; changes wait for a person.",
    host: "https://mcp.monday.com",
    path: "/mcp",
    auth: {
      kind: "user-oauth",
      // monday's authorization server lives on auth.monday.com; the MCP resource points there.
      authorizationUrl: "https://auth.monday.com/oauth2/authorize",
      tokenUrl: "https://auth.monday.com/oauth_ms/oauth/token",
      revokeUrl: "https://auth.monday.com/oauth_ms/oauth/token",
      scopes: Object.freeze([]),
      clientRegistration: "dynamic",
      registrationUrl: "https://auth.monday.com/oauth_ms/oauth/register",
    },
    writeTools: Object.freeze([]),
    writeToolPattern:
      /(create|update|delete|publish|upload|remove|patch|set_|write|register|unpublish|deploy|send|archive|cancel|refund|capture|charge|merge|assign|move|add_|post_|put_|import|purge)/i,
    docsUrl: "https://developer.monday.com/apps/docs/mondaycom-mcp-integration",
  },
  {
    key: "klaviyo",
    title: "Klaviyo",
    vendor: "Klaviyo",
    summary:
      "Profiles, lists, segments, campaigns and flows of the Klaviyo account; sends and changes wait for a person.",
    host: "https://mcp.klaviyo.com",
    path: "/mcp",
    auth: {
      kind: "user-oauth",
      authorizationUrl: "https://mcp.klaviyo.com/authorize",
      tokenUrl: "https://mcp.klaviyo.com/token",
      revokeUrl: "https://mcp.klaviyo.com/token",
      scopes: Object.freeze([]),
      clientRegistration: "dynamic",
      registrationUrl: "https://mcp.klaviyo.com/register",
    },
    writeTools: Object.freeze([]),
    writeToolPattern:
      /(create|update|delete|publish|upload|remove|patch|set_|write|register|unpublish|deploy|send|archive|cancel|refund|capture|charge|merge|assign|move|add_|post_|put_|import|purge)/i,
    docsUrl: "https://developers.klaviyo.com/en/docs/klaviyo_mcp_server",
  },
  {
    key: "routines",
    title: "Routines",
    vendor: "OpenBot",
    summary:
      "Standing instructions a Bot runs on a schedule, as whoever scheduled them.",
    /*
     * First-party and in-process: no host to dial, no credential to hold. In the catalogue anyway,
     * because the catalogue is where a deployment decides WHICH Bots may do WHAT — and scheduling
     * future work is a capability an administrator should grant as deliberately as a vendor.
     */
    host: "builtin://routines",
    path: "/",
    transport: "builtin-routines",
    auth: Object.freeze({ kind: "builtin" }),
    writeTools: Object.freeze([
      "create_routine",
      "update_routine",
      "delete_routine",
    ]),
    docsUrl: "https://github.com/CopilotKit/OpenBot/blob/main/docs/routines.md",
  },
]);

const BY_KEY = new Map(CATALOGUE.map((entry) => [entry.key, entry]));

/** Compiled once from the frozen source strings above. Never from anything a caller supplied. */
const PATTERNS = new Map(
  CATALOGUE.filter((entry) => entry.hostPattern !== undefined).map((entry) => [
    entry.key,
    new RegExp(entry.hostPattern as string),
  ]),
);

/**
 * Which kind of credential this entry's server record may be pointed at, or null when it takes none
 * from the caller.
 *
 * Beside the entry rather than at the call site, because it is a property of the vendor's auth and
 * not of the request. `deployment-bearer` is the only kind that means "one token this deployment
 * holds for this server", which is what `mcp` names in the vault. A `user-oauth` server is answered
 * with the asker's own grant and its OAuth client is registered through its own call, which mints
 * the credential itself, so an id offered when the server is added is never the right one whatever
 * kind it names. A server needing no credential takes none.
 */
export function serverCredentialKind(entry: CatalogueEntry): "mcp" | null {
  return entry.auth.kind === "deployment-bearer" ? "mcp" : null;
}

export function catalogueEntry(key: string): CatalogueEntry | null {
  return BY_KEY.get(key) ?? null;
}

/**
 * Is this host one this entry is allowed to be pointed at?
 *
 * Compares the RAW host string, case-sensitively, and returns false for anything it does not
 * positively recognise. Every branch that cannot prove admissibility returns false rather than
 * falling through, because the failure mode of the opposite arrangement is a deployment reaching an
 * address nobody chose.
 */
export function hostAdmissible(entry: CatalogueEntry, host: string): boolean {
  if (entry.host !== null) return entry.host === host;
  const pattern = PATTERNS.get(entry.key);
  if (!pattern) return false;
  return pattern.test(host);
}

/**
 * The URL this server is reached at, or null if the request is not admissible.
 *
 * `instanceHost` is only consulted for a per-instance vendor, and only after the pattern accepts it.
 * The path is always the catalogue's, never the caller's, so an admissible host cannot reach some
 * other endpoint on the same machine.
 */
export function resolveServerUrl(
  key: string,
  instanceHost?: string,
): { url: string; entry: CatalogueEntry } | null {
  const entry = catalogueEntry(key);
  if (!entry) return null;

  const host = entry.host ?? instanceHost ?? null;
  if (host === null) return null;
  if (!hostAdmissible(entry, host)) return null;

  // The path is joined rather than concatenated blindly so a root path does not produce a double
  // slash, which some servers treat as a different route.
  const path = entry.path === "/" ? "" : entry.path;
  return { url: `${host}${path}`, entry };
}

/**
 * What this tool does, in the only two categories a policy author cares about.
 *
 * Unknown counts as a write. A tool named in {@link CatalogueEntry.writeTools} is a write. A tool
 * the server never advertised at all is a write, because the only thing that produced the name was
 * a model. A server with no catalogue entry behind it is a write throughout, because nothing
 * reviewed says any tool of theirs only reads.
 *
 * Only a tool the server itself listed AND that is absent from the write list is treated as a read.
 * That is the one case where both sources agree, and it is the only one where guessing permissively
 * is recoverable.
 */
export function classifyTool(
  entry: CatalogueEntry | null,
  toolName: string,
  advertised: boolean,
): "read" | "write" {
  // A server an administrator added by URL has no reviewed tool catalogue behind it, so nothing here
  // can say a tool of theirs only reads. Everything it offers is a write.
  if (!entry) return "write";
  if (!advertised) return "write";
  if (entry.writeTools.includes(toolName)) return "write";
  // NOTOS (stap 7): see writeToolPattern.
  if (entry.writeToolPattern?.test(toolName)) return "write";
  return "read";
}

/**
 * Words that make a parameter name a credential, wherever they appear in it.
 *
 * A containment test rather than a list of exact names, because the exact-name version of this rule
 * refused `?token=` and accepted `?auth_token=`, `?api_token=`, `?session_token=` and every other
 * spelling one word away. An operator has no way to know which of those the check happens to hold,
 * so a rule that only refuses the names somebody thought of reads as a guard while behaving like a
 * gap.
 *
 * Not shared with `sensitiveKeys` in `audit.ts`: that module reaches the database and this function
 * deliberately imports nothing that does. The two also want different contents, since audit redacts
 * `content`, `prompt` and `result`, which are payload field names and mean nothing here.
 */
const CREDENTIAL_WORDS = [
  "token",
  "secret",
  "password",
  "passwd",
  "credential",
  "signature",
  "bearer",
];

/**
 * Names that are a credential on their own but are too short to contain safely.
 *
 * `sig` is the reason this list is separate from the one above: "design" contains it. These are
 * compared whole, so an ordinary word carrying the same three letters is left alone.
 */
const CREDENTIAL_NAMES = new Set([
  "auth",
  "authorization",
  "pass",
  "pwd",
  "sig",
]);

/**
 * Does this parameter name say it holds a credential?
 *
 * Names are compared with their separators dropped, so `api_key`, `apiKey` and `x-api-key` are one
 * question rather than three. A name ending in "key" is a credential and a name merely containing it
 * is not, which is what keeps `keyword` and `monkey` apart; "author" is likewise not "auth".
 *
 * It over-refuses in one direction on purpose. A parameter this rule misreads costs an operator a
 * rename, and one it misses is written to an append-only audit row that cannot be deleted.
 */
function readsAsCredential(name: string): boolean {
  const normalized = name.replaceAll(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (CREDENTIAL_NAMES.has(normalized) || normalized.endsWith("key")) {
    return true;
  }
  return CREDENTIAL_WORDS.some((word) => normalized.includes(word));
}

/**
 * Is this a URL an administrator may point the deployment at?
 *
 * A curated entry is reviewed in code; this is the other path, and it needs its own floor because
 * "add an MCP server" is otherwise a request-forgery primitive aimed at whatever the server can
 * reach: cloud metadata endpoints, databases on the same network, admin panels bound to localhost.
 * The rules are deliberately blunt.
 *
 * HTTPS only, because the credential is a bearer token and plaintext is not negotiable.
 * No address literals, localhost or internal suffixes, because those point at the deployment rather
 * than a vendor service.
 *
 * This is static URL validation: it checks the literal host string and scheme before storage. DNS
 * resolution and per-request network policy are separate deployment controls.
 */
export function customUrlRefusal(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "That is not a URL.";
  }

  if (url.protocol !== "https:") {
    return "An MCP server must be reached over https.";
  }

  // Userinfo is not part of the host, so none of the host rules below would look at it, and what is
  // typed here is stored verbatim: addCustomServer writes the string into mcp_servers.url and into
  // the configuration.changed audit payload, whose redaction keys on the field name rather than the
  // value. A secret written this way would sit in the trail in clear text. The refusal deliberately
  // does not echo the URL back.
  if (url.username || url.password) {
    return "Put the credential in the token field rather than in the address.";
  }

  /*
   * The query is the other half of the same hole, and the fragment is the half after that.
   *
   * No host rule below reads either one, and both are stored and audited with the rest of the
   * string, so a token written here is as durable and as readable as one written into the userinfo.
   * The fragment never reaches the server at all, which is why it is not a request-forgery concern
   * and is still a disclosure one: what this rule is about is where the string ends up, not where
   * the request goes.
   *
   * The test is on the parameter name rather than on the presence of a query, because vendors
   * legitimately route and version with parameters. A floor that refused every one of them would be
   * one an operator works around rather than with, and an ordinary `#section` is left alone for the
   * same reason.
   */
  const hash = url.hash.replace(/^#/, "");
  const marker = hash.indexOf("?");
  const fragment =
    marker === -1 ? [hash] : [hash.slice(0, marker), hash.slice(marker + 1)];
  const named = [
    ...url.searchParams.keys(),
    ...fragment.flatMap((part) => [...new URLSearchParams(part).keys()]),
  ];
  if (named.some(readsAsCredential)) {
    return "Put the credential in the token field rather than in the address.";
  }

  // A trailing dot is the root-anchored spelling of the same name and resolves to the same place, so
  // they are stripped here rather than added to each comparison below. Without it "localhost."
  // misses the equality test, "vault.internal." misses the suffix tests, and "database." picks up
  // the dot that the single-label test keys on, so the fully qualified form of every name this
  // function refuses walks straight through it.
  const host = url.hostname.toLowerCase().replace(/\.+$/, "");

  // Bracketed IPv6 arrives with the brackets already stripped by URL, so the colon test catches it.
  if (host.includes(":") || /^[0-9.]+$/.test(host)) {
    return "Give a hostname rather than an IP address.";
  }
  /*
   * The cloud metadata endpoint, by name rather than by luck.
   *
   * `metadata.goog` is Google's own short alias for it, published beside `metadata.google.internal`,
   * and it carries a dot and none of the suffixes below, so it read as an ordinary vendor name. The
   * long spelling was refused only incidentally, by the `.internal` test.
   *
   * Asked of the list browsing already uses rather than a second copy here. That list holds the
   * aliases somebody has already had to think about, including the ones Alibaba and ECS answer on,
   * and a new alias added there should not have to be remembered here as well.
   */
  if (isNeverAllowedHostname(host)) {
    return "That address holds this deployment's own cloud credentials.";
  }
  if (host === "localhost" || host.endsWith(".localhost")) {
    return "That address is local to the deployment.";
  }
  if (
    host.endsWith(".internal") ||
    host.endsWith(".local") ||
    host.endsWith(".localdomain") ||
    // How a Kubernetes service is addressed from inside the cluster. It carries dots and none of
    // the suffixes above, so without this it reads as an ordinary vendor name.
    host.endsWith(".svc") ||
    !host.includes(".")
  ) {
    return "That address is not reachable from outside this network.";
  }

  return null;
}

/**
 * NOTOS (stap 7): the OAuth endpoints of a per-instance vendor, for one instance.
 *
 * A Shopify shop authorises at its own host, so the catalogue writes `{shop}` and this fills it
 * from the server row's URL. A vendor with a fixed host comes back unchanged.
 */
export type UserOAuthAuth = Extract<CatalogueAuth, { kind: "user-oauth" }>;

export function authForInstance(
  auth: UserOAuthAuth,
  entry: Pick<CatalogueEntry, "host">,
  serverUrl: string,
): UserOAuthAuth {
  if (entry.host !== null) return auth;
  let hostname = "";
  try {
    hostname = new URL(serverUrl).hostname;
  } catch {
    return auth;
  }
  // The shop is the first label of its myshopify host; the URLs stay https in the catalogue.
  const shop = hostname.split(".")[0] ?? "";
  if (!shop) return auth;
  const fill = (value: string) => value.replace("{shop}", shop);
  return {
    ...auth,
    authorizationUrl: fill(auth.authorizationUrl),
    tokenUrl: fill(auth.tokenUrl),
    revokeUrl: fill(auth.revokeUrl),
    ...(auth.registrationUrl
      ? { registrationUrl: fill(auth.registrationUrl) }
      : {}),
  };
}
