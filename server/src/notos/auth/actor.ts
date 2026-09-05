/**
 * Van een geverifieerd token naar de `AuthenticatedActor` die OpenBot overal verwacht.
 *
 * - `role`: `"admin"` als het adres in Supabase `team_members` staat met `role = 'administrator'`
 *   (`notos/apps/app/supabase/team.sql`), anders `"user"`. Gelezen via PostgREST met het token
 *   van de beller: de RLS-regel `team_read` laat zuid.com-adressen lezen en geeft een klantgast
 *   niets terug, wat precies "geen beheerder" is.
 * - `isInternal`: het adres eindigt op een domein uit `INTERNAL_DOMAINS` (standaard `zuid.com`),
 *   zelfde naam en betekenis als in `mge-platform/src/api/auth.py`.
 * - Een rij in `users` (id = Supabase `sub`) en één rol in `user_roles`, zodat alles wat upstream
 *   op die tabellen leunt (people, grants, audit) blijft werken.
 *
 * Zestig seconden cache per `session_id`, niet langer: intrekking hoort binnen een minuut te werken.
 */
import { and, eq } from "drizzle-orm";
import type { AuthenticatedActor } from "../../auth/guards";
import { setRole } from "../../auth/roles";
import type { Database } from "../../db/client";
import { userRoles, users } from "../../db/schema";
import type { SupabaseIdentity, VerifySupabaseToken } from "./supabase-jwt";

export type NotosActor = AuthenticatedActor & { isInternal: boolean };

type ClientRole = "lead" | "specialist" | "viewer";
const CLIENT_ROLES = new Set<string>(["lead", "specialist", "viewer"]);

export class RevokedError extends Error {
  constructor(email: string) {
    super(`Access for ${email} has been removed.`);
    this.name = "RevokedError";
  }
}

export type ActorResolverOptions = {
  verify: VerifySupabaseToken;
  supabaseUrl: string;
  publishableKey: string;
  internalDomains: readonly string[];
  database: Database;
  isRevoked: (email: string) => Promise<boolean>;
  cacheMs?: number;
  /** Injecteerbaar voor tests. */
  fetch?: typeof fetch;
  /** NOTOS: leden die een beheerder in Bots toevoegde (workspace_members), slug -> rol. */
  extraMemberships?: (
    email: string,
  ) => Promise<Record<string, ClientRole | "zuid">>;
};

export type ActorResolver = {
  /** Gooit bij een ongeldig token; gooit `RevokedError` voor een adres dat is uitgezet. */
  actorForToken(token: string): Promise<NotosActor>;
};

export function isInternalAddress(
  email: string,
  internalDomains: readonly string[],
): boolean {
  const domain = email.toLowerCase().split("@")[1] ?? "";
  return internalDomains.some((candidate) => candidate === domain);
}

export function createActorResolver(
  options: ActorResolverOptions,
): ActorResolver {
  const {
    verify,
    supabaseUrl,
    publishableKey,
    internalDomains,
    database,
    isRevoked,
    cacheMs = 60_000,
    fetch: doFetch = fetch,
  } = options;
  const cache = new Map<string, { actor: NotosActor; until: number }>();

  async function isAdministrator(
    identity: SupabaseIdentity,
    token: string,
  ): Promise<boolean> {
    const url = new URL(
      `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/team_members`,
    );
    url.searchParams.set("select", "email,role");
    url.searchParams.set("email", `eq.${identity.email}`);
    let rows: unknown;
    try {
      const response = await doFetch(url, {
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (!response.ok) return false;
      rows = await response.json();
    } catch {
      // Geen antwoord is geen beheerder. Fail closed, nooit open.
      return false;
    }
    return (
      Array.isArray(rows) &&
      rows.some(
        (row) =>
          typeof row === "object" &&
          row !== null &&
          String((row as { email?: unknown }).email ?? "").toLowerCase() ===
            identity.email &&
          (row as { role?: unknown }).role === "administrator",
      )
    );
  }

  /**
   * Which NOTOS clients a guest may enter, and as what: `client_members` under the caller's own
   * RLS, kept to clients whose `notos_tenants.status` is `active`, exactly as
   * `mge-platform/src/api/auth.py` does it. A ZUID address never comes here: it sees everything.
   */
  async function membershipsOf(
    identity: SupabaseIdentity,
    token: string,
  ): Promise<Record<string, ClientRole>> {
    const headers = {
      apikey: publishableKey,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };
    const base = supabaseUrl.replace(/\/+$/, "");
    const read = async (path: string): Promise<unknown[]> => {
      try {
        const response = await doFetch(`${base}/rest/v1/${path}`, { headers });
        if (!response.ok) return [];
        const rows = await response.json();
        return Array.isArray(rows) ? rows : [];
      } catch {
        return [];
      }
    };
    const members = await read(
      `client_members?select=client_id,email,klant_rol&email=eq.${encodeURIComponent(identity.email)}`,
    );
    const candidates: Record<string, ClientRole> = {};
    for (const row of members) {
      const member = row as { client_id?: unknown; klant_rol?: unknown };
      if (typeof member.client_id !== "string" || !member.client_id) continue;
      const role =
        typeof member.klant_rol === "string" &&
        CLIENT_ROLES.has(member.klant_rol)
          ? (member.klant_rol as ClientRole)
          : "viewer";
      candidates[member.client_id] = role;
    }
    const ids = Object.keys(candidates).filter((id) => /^[a-z0-9-]+$/.test(id));
    if (ids.length === 0) return {};
    const active = await read(
      `notos_tenants?select=id,status&status=eq.active&id=in.(${ids.join(",")})`,
    );
    const activeIds = new Set(
      active.flatMap((row) => {
        const tenant = row as { id?: unknown; status?: unknown };
        return typeof tenant.id === "string" && tenant.status === "active"
          ? [tenant.id]
          : [];
      }),
    );
    return Object.fromEntries(
      Object.entries(candidates).filter(([id]) => activeIds.has(id)),
    );
  }

  async function remember(identity: SupabaseIdentity, role: "admin" | "user") {
    await database
      .insert(users)
      .values({
        id: identity.id,
        email: identity.email,
        name: identity.name,
        image: identity.image,
        emailVerified: true,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: identity.email,
          name: identity.name,
          image: identity.image,
          updatedAt: new Date(),
        },
      });
    const [existing] = await database
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(and(eq(userRoles.userId, identity.id), eq(userRoles.role, role)))
      .limit(1);
    if (!existing) await setRole(database, identity.id, role);
  }

  return {
    async actorForToken(token) {
      const identity = await verify(token);
      const cacheKey = identity.sessionId ?? `token:${token.slice(-32)}`;
      const cached = cache.get(cacheKey);
      if (cached && cached.until > Date.now()) return cached.actor;

      if (await isRevoked(identity.email))
        throw new RevokedError(identity.email);
      const role = (await isAdministrator(identity, token)) ? "admin" : "user";
      await remember(identity, role);

      const isInternal = isInternalAddress(identity.email, internalDomains);
      const actor: NotosActor = {
        id: identity.id,
        email: identity.email,
        name: identity.name,
        image: identity.image,
        role,
        isInternal,
        ...(isInternal
          ? {}
          : {
              // NOTOS: what NOTOS says (client_members) plus what an administrator added in Bots.
              memberships: {
                ...(await membershipsOf(identity, token)),
                ...((await options.extraMemberships?.(identity.email)) ?? {}),
              },
            }),
      };
      cache.set(cacheKey, { actor, until: Date.now() + cacheMs });
      if (cache.size > 5_000) {
        const now = Date.now();
        for (const [key, entry] of cache)
          if (entry.until <= now) cache.delete(key);
      }
      return actor;
    },
  };
}
