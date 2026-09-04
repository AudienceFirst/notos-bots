/**
 * De sessie-guard van NOTOS Bots: alleen een Supabase-JWT telt.
 *
 * Waar het token staat, in deze volgorde:
 * 1. `X-Notos-Authorization: Bearer …`. Zo stuurt de NOTOS-worker (stap 4) het door, want
 *    `Authorization` draagt daar het Cloud Run ID-token van de worker zelf.
 * 2. `Authorization: Bearer …`. Zo stuurt de app het rechtstreeks, lokaal en in de proxy-loze opzet.
 * 3. Alleen bij een WebSocket-upgrade: `?access_token=…`. Een browser kan op een upgrade geen
 *    header zetten. Op een gewone request wordt de query genegeerd, zodat een token nooit per
 *    ongeluk in een link of een server-log belandt.
 */
import type { MiddlewareHandler } from "hono";
import type { AppVariables } from "../../auth/guards";
import type { ActorResolver, NotosActor } from "./actor";
import { RevokedError } from "./actor";

export type NotosIdentity = {
  requireUser: MiddlewareHandler<{ Variables: AppVariables }>;
  /** De persoon achter een request, of null als er geen geldig token is. Gooit bij een ingetrokken adres. */
  actorFor(request: Request): Promise<NotosActor | null>;
};

const BEARER = /^Bearer\s+(.+)$/i;

export function bearerFrom(request: Request): string | null {
  for (const header of ["x-notos-authorization", "authorization"]) {
    const value = request.headers.get(header);
    const match = value ? BEARER.exec(value.trim()) : null;
    if (match?.[1]) return match[1].trim();
  }
  if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
    const token = new URL(request.url).searchParams.get("access_token");
    if (token && token.trim().length > 0) return token.trim();
  }
  return null;
}

export function createNotosIdentity(resolver: ActorResolver): NotosIdentity {
  const actorFor = async (request: Request): Promise<NotosActor | null> => {
    const token = bearerFrom(request);
    if (!token) return null;
    try {
      return await resolver.actorForToken(token);
    } catch (error) {
      if (error instanceof RevokedError) throw error;
      return null;
    }
  };

  const requireUser: MiddlewareHandler<{ Variables: AppVariables }> = async (
    context,
    next,
  ) => {
    let actor: NotosActor | null;
    try {
      actor = await actorFor(context.req.raw);
    } catch (error) {
      if (error instanceof RevokedError) {
        return context.json({ error: "Access has been removed." }, 403);
      }
      throw error;
    }
    if (!actor) {
      return context.json({ error: "Authentication required." }, 401);
    }
    context.set("actor", actor);
    await next();
  };

  return { requireUser, actorFor };
}
