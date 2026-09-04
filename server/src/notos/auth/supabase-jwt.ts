/**
 * Een Supabase-toegangstoken verifiëren, precies zoals `mge-platform/src/api/auth.py` dat doet.
 *
 * ES256 tegen de publieke JWKS van het NOTOS-project, met `issuer` en `audience` uit de
 * configuratie. Alleen de publieke sleutelset is nodig; geen service-role, nergens. De JWKS wordt
 * door `jose` gecachet en bij een onbekende `kid` opnieuw opgehaald, wat een sleutelrotatie afdekt.
 */
import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";

export type SupabaseIdentity = {
  /** De `sub`-claim: het Supabase-gebruikers-id. Dit wordt `users.id` hier. */
  id: string;
  /** Kleine letters, getrimd. */
  email: string;
  /** De `session_id`-claim, of null. Sleutel van de korte cache in `actor.ts`. */
  sessionId: string | null;
  name: string | null;
  image: string | null;
};

export type SupabaseJwtSettings = {
  issuer: string;
  audience: string;
  jwksUrl: string;
};

export type VerifySupabaseToken = (token: string) => Promise<SupabaseIdentity>;

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

/**
 * Bouw de verifier. `getKey` is injecteerbaar zodat een test een eigen sleutelset kan geven
 * (`createLocalJWKSet`); zonder is het de JWKS van het project.
 */
export function createSupabaseVerifier(
  settings: SupabaseJwtSettings,
  getKey?: JWTVerifyGetKey,
): VerifySupabaseToken {
  const keys = getKey ?? createRemoteJWKSet(new URL(settings.jwksUrl));
  return async (token) => {
    const { payload } = await jwtVerify(token, keys, {
      issuer: settings.issuer,
      audience: settings.audience,
      algorithms: ["ES256"],
    });
    const id = text(payload.sub);
    const email = text(payload.email)?.toLowerCase() ?? null;
    if (!id || !email) {
      throw new Error("The token carries no subject or no email.");
    }
    const metadata =
      typeof payload.user_metadata === "object" && payload.user_metadata
        ? (payload.user_metadata as Record<string, unknown>)
        : {};
    return {
      id,
      email,
      sessionId: text(payload.session_id),
      name: text(metadata.full_name) ?? text(metadata.name),
      image: text(metadata.avatar_url) ?? text(metadata.picture),
    };
  };
}
