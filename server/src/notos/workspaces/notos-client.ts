/**
 * De klantenlijst van NOTOS, opgehaald als machine.
 *
 * `GET {NOTOS_API_URL}/api/internal/clients` op mge-cockpit-api verifieert een Google ID-token
 * met die URL als audience en laat alleen `notos-bots@mge-zuid` toe (zie
 * `mge-platform/src/api/endpoints/internal_clients.py`). Het token komt van
 * `google-auth-library` via ADC: op Cloud Run de serviceaccount van de service zelf, op een laptop
 * `gcloud auth application-default login` met impersonatie van die serviceaccount.
 *
 * `NOTOS_CLIENTS_FILE` is de terugval voor lokaal ontwikkelen zonder de API: een JSON-export van
 * dezelfde lijst. Echte data, alleen niet live.
 */
import { readFile } from "node:fs/promises";
import { GoogleAuth } from "google-auth-library";
import type { NotosClient } from "./store";

export type NotosClientSource = () => Promise<NotosClient[]>;

function parse(payload: unknown, origin: string): NotosClient[] {
  if (!Array.isArray(payload)) {
    throw new Error(`${origin} did not answer with a list of clients`);
  }
  return payload.flatMap((row) => {
    if (typeof row !== "object" || row === null) return [];
    const client = row as Record<string, unknown>;
    if (typeof client.client_id !== "string" || !client.client_id) return [];
    return [
      {
        client_id: client.client_id,
        display_name:
          typeof client.display_name === "string"
            ? client.display_name
            : client.client_id,
        ...(typeof client.is_mock === "boolean"
          ? { is_mock: client.is_mock }
          : {}),
        ...(typeof client.kind === "string" ? { kind: client.kind } : {}),
        ...(typeof client.currency === "string"
          ? { currency: client.currency }
          : {}),
      },
    ];
  });
}

export function clientsFromFile(path: string): NotosClientSource {
  return async () => parse(JSON.parse(await readFile(path, "utf8")), path);
}

export function clientsFromNotos(apiUrl: string): NotosClientSource {
  const base = apiUrl.replace(/\/+$/, "");
  const auth = new GoogleAuth();
  return async () => {
    const client = await auth.getIdTokenClient(base);
    const response = await client.request<unknown>({
      url: `${base}/api/internal/clients`,
      method: "GET",
    });
    return parse(response.data, `${base}/api/internal/clients`);
  };
}
