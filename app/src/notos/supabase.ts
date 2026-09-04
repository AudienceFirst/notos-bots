/**
 * NOTOS: de Supabase-sessie van NOTOS, gedeeld met deze app (bouwplan stap 1).
 *
 * Inloggen gebeurt in NOTOS. Onder `notos.zuid.com/bots/` deelt deze app de origin en dus de
 * opslag met NOTOS, en NOTOS bewaart de sessie ook in een cookie op `.zuid.com`
 * (`apps/app/src/integrations/supabase/shared-session.ts`, hier overgenomen). Deze module leest
 * die sessie en geeft het toegangstoken door aan elke API-aanroep; zelf logt ze nooit iemand in.
 *
 * De URL en de publishable key komen van `/api/capabilities`, niet uit de build: de image wordt
 * één keer gebouwd en weet niets van het project waar hij tegenaan draait.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const COOKIE_DOMAIN = ".zuid.com";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function onZuidDomain(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname.endsWith("zuid.com");
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${encodeURIComponent(name)}=`;
  for (const part of document.cookie.split("; ")) {
    if (part.startsWith(prefix)) {
      try {
        return decodeURIComponent(part.slice(prefix.length));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined" || !onZuidDomain()) return;
  // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is async and Supabase's storage adapter is sync; same pattern as NOTOS.
  document.cookie =
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Domain=${COOKIE_DOMAIN}; Path=/; ` +
    `Max-Age=${MAX_AGE_SECONDS}; Secure; SameSite=Lax`;
}

function clearCookie(name: string): void {
  if (typeof document === "undefined" || !onZuidDomain()) return;
  // biome-ignore lint/suspicious/noDocumentCookie: see writeCookie.
  document.cookie = `${encodeURIComponent(name)}=; Domain=${COOKIE_DOMAIN}; Path=/; Max-Age=0; Secure; SameSite=Lax`;
}

/** Dezelfde opslag als NOTOS: cookie op .zuid.com eerst, localStorage als tweede kopie. */
export const sharedSessionStorage = {
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;
    const fromCookie = readCookie(key);
    if (fromCookie) return fromCookie;
    const fromLocal = window.localStorage.getItem(key);
    if (fromLocal) writeCookie(key, fromLocal);
    return fromLocal;
  },
  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return;
    writeCookie(key, value);
    window.localStorage.setItem(key, value);
  },
  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    clearCookie(key);
    window.localStorage.removeItem(key);
  },
};

type SupabaseSettings = { url: string; publishableKey: string };

let settingsPromise: Promise<SupabaseSettings | null> | undefined;
let clientPromise: Promise<SupabaseClient | null> | undefined;
/** Het laatst bekende token, synchroon leesbaar voor plekken die niet kunnen wachten (headers, sockets). */
let knownToken: string | null = null;

async function settings(): Promise<SupabaseSettings | null> {
  settingsPromise ??= (async () => {
    try {
      const response = await fetch("/api/capabilities", {
        credentials: "include",
      });
      if (!response.ok) return null;
      const body = (await response.json()) as {
        supabase?: { url?: unknown; publishableKey?: unknown } | null;
      };
      const url = body.supabase?.url;
      const publishableKey = body.supabase?.publishableKey;
      return typeof url === "string" && typeof publishableKey === "string"
        ? { url, publishableKey }
        : null;
    } catch {
      return null;
    }
  })();
  return settingsPromise;
}

/** De client, of null als deze deployment geen Supabase kent (OPENBOT_SINGLE_USER). */
export function supabaseClient(): Promise<SupabaseClient | null> {
  clientPromise ??= settings().then((found) => {
    if (!found) return null;
    const client = createClient(found.url, found.publishableKey, {
      auth: {
        storage: sharedSessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        // De OAuth-redirect landt in NOTOS, nooit hier.
        detectSessionInUrl: false,
      },
    });
    client.auth.onAuthStateChange((_event, session) => {
      knownToken = session?.access_token ?? null;
    });
    return client;
  });
  return clientPromise;
}

/** Het toegangstoken van de NOTOS-sessie, of null. */
export async function accessToken(): Promise<string | null> {
  const client = await supabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  knownToken = data.session?.access_token ?? null;
  return knownToken;
}

/** Het laatst opgehaalde token, zonder te wachten. Leeg tot `accessToken()` één keer liep. */
export function currentAccessToken(): string | null {
  return knownToken;
}

/** Uitloggen bij NOTOS. De sessie is gedeeld, dus dit logt ook NOTOS zelf uit. */
export async function signOutOfNotos(): Promise<void> {
  const client = await supabaseClient();
  if (client) await client.auth.signOut();
  knownToken = null;
}

/** Waar iemand inlogt: NOTOS zelf. Op een zuid.com-host is dat dezelfde origin. */
export function notosLoginUrl(): string {
  if (onZuidDomain()) return "/";
  return "https://notos.zuid.com/";
}

/** Een websocket-URL met het token als query, want een browser kan op een upgrade geen header zetten. */
export function withAccessToken(url: URL): URL {
  const token = currentAccessToken();
  if (token) url.searchParams.set("access_token", token);
  return url;
}
