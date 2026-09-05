/**
 * NOTOS: de workspace waarin de app nu werkt (bouwplan stap 2).
 *
 * De URL is de bron: `/w/:workspace/...`. De layout-route zet hem hier zodra hij geladen is, en
 * alles wat de API aanroept leest hem terug: `client.ts` zet de workspace-routes onder
 * `/api/w/<slug>/`, en de CopilotKit-provider en de sockets sturen hem als header of query mee.
 * Buiten een workspace (admin, instellingen) is er geen slug en blijven de paden zoals ze waren.
 */
let current: string | null = null;

export function setCurrentWorkspace(slug: string | null) {
  current = slug;
}

export function currentWorkspace(): string | null {
  return current;
}

/** De API-paden die bij een workspace horen. Alles daarbuiten (plugins, admin, me) is deployment-breed. */
const SCOPED =
  /^\/api\/(channels|routines|agents|route|threads|components|approvals|campaigns)(\/|$|\?)/;

export function apiPath(path: string): string {
  const slug = current;
  if (!slug) return path;
  return path.replace(
    SCOPED,
    (_match, resource: string, tail: string) =>
      `/api/w/${encodeURIComponent(slug)}/${resource}${tail}`,
  );
}

export const WORKSPACE_HEADER = "x-notos-workspace";

export function workspaceHeaders(): Record<string, string> {
  return current ? { [WORKSPACE_HEADER]: current } : {};
}

/** Wat `/api/me` over een workspace zegt. */
export type WorkspaceSummary = {
  id: string;
  notosClientId: string;
  displayName: string;
  kind: string;
  currency: string;
  rol: "zuid" | "lead" | "specialist" | "viewer";
};

/**
 * Voor een `Link` of `navigate` naar een `/w/$workspace/...`-route: de workspace uit de huidige
 * URL, of anders de actieve. Als `params`-reducer, zodat een link nergens zelf de slug hoeft te kennen.
 */
export function keepWorkspace(previous: { workspace?: string }): {
  workspace: string;
} {
  return { workspace: previous.workspace ?? current ?? "" };
}
