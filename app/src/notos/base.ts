/**
 * NOTOS: waar deze app en zijn API vandaan komen (bouwplan stap 4).
 *
 * Onder `notos.zuid.com/bots/` stuurt de NOTOS-worker `/bots/*` en `/api/bots/*` door naar
 * Cloud Run en knipt het voorvoegsel eraf. De app is dan gebouwd met `VITE_BASE_PATH=/bots/`
 * en praat tegen `/api/bots/...`. Lokaal en op een eigen origin blijft alles op `/`.
 */
const raw = (import.meta.env.VITE_BASE_PATH as string | undefined) ?? "/";
/** Met voor- en achterliggende slash, `/` of `/bots/`. */
export const BASE_PATH =
  raw === "/" ? "/" : `/${raw.replace(/^\/+|\/+$/g, "")}/`;
/** Zonder achterliggende slash, voor de router: `` of `/bots`. */
export const ROUTER_BASE = BASE_PATH === "/" ? "" : BASE_PATH.slice(0, -1);
/** `/api` of `/api/bots`. */
export const API_PREFIX = BASE_PATH === "/" ? "/api" : `/api${ROUTER_BASE}`;

/** Een API-pad uit de code (`/api/...`) naar waar het in deze deployment heen moet. */
export function apiUrl(path: string): string {
  if (API_PREFIX === "/api") return path;
  return path.startsWith("/api/")
    ? `${API_PREFIX}/${path.slice("/api/".length)}`
    : path;
}
