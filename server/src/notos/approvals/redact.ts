// NOTOS: geheimen uit een goedkeuringsvraag halen voordat iemand hem leest (Mitch, 7 september 2026).
//
// Een goedkeuring toont de argumenten waarmee een Bot een tool wil aanroepen, zodat een mens kan
// zien waar hij ja tegen zegt. Zit daar een token of een sleutel tussen, dan staat dat geheim
// daarmee op het scherm, in de database, en in alles wat die rij later teruglees: het
// goedkeuringsoverzicht, de audit, een export. Dat is precies de plek waar een sleutel niet hoort.
//
// Daarom wordt er weggestreept vóór het opslaan, niet bij het tekenen. Een waarde die nooit in de
// tabel komt, kan ook niet alsnog ergens uitlekken.
//
// Wat de vraag begrijpelijk moet houden: er wordt niet gewist maar vervangen. Wie de vraag leest
// ziet dát er een sleutel meegaat en hoe het veld heet, alleen niet welke. Zonder dat verschil
// wordt een goedkeuring onleesbaar en klikt iemand hem blind weg.

/** Wat er in de plaats komt. Herkenbaar als bewuste keuze, niet als lege waarde. */
export const REDACTED = "[weggestreept]";

/**
 * Veldnamen die een geheim aankondigen.
 *
 * Op de naam, niet op de waarde, want een leeg of kort token is nog steeds een token: `{"password":
 * "a"}` hoort net zo goed weg. De namen staan hier in het Engels omdat tools hun velden zo noemen.
 */
const SECRET_NAMES =
  /(^|[_\-.])(secret|password|passwd|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|client[_-]?secret|refresh[_-]?token|session|cookie|signature|credential)s?([_\-.]|$)|^authorization$|^auth$|^key$|^bearer$/i;

/**
 * Waarden die er als een geheim uitzien, ook onder een onschuldige veldnaam.
 *
 * Bewust smal gehouden: elk patroon hier hoort bij een uitgiftevorm die je niet per ongeluk typt.
 * Een losse lange tekst wordt níét weggestreept, want dan verdwijnt de helft van elke normale
 * vraag (een instructie, een mailtekst) achter een blokje.
 */
const SECRET_SHAPES: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._~+/-]{12,}=*/i, // een Authorization-header in een string
  /\bey[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/, // JWT
  /\bsk-(?:ant-|or-|proj-)?[A-Za-z0-9_-]{16,}/, // OpenAI, Anthropic, OpenRouter
  /\bAIza[A-Za-z0-9_-]{20,}/, // Google
  /\bgh[pousr]_[A-Za-z0-9]{20,}/, // GitHub
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/, // Slack
  /\bshp(?:at|ca|ss)_[a-fA-F0-9]{16,}/, // Shopify
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, // een sleutelbestand in een veld
];

/** Alleen de vorm vervangen, de rest van de zin laten staan. */
function scrubText(value: string): string {
  let out = value;
  for (const shape of SECRET_SHAPES) {
    out = out.replace(
      new RegExp(
        shape.source,
        shape.flags.includes("g") ? shape.flags : `${shape.flags}g`,
      ),
      REDACTED,
    );
  }
  return out;
}

/** Of deze veldnaam op zichzelf al genoeg reden is om de waarde niet te tonen. */
export function isSecretName(name: string): boolean {
  return SECRET_NAMES.test(name);
}

/**
 * De argumenten zoals een mens ze mag zien.
 *
 * Loopt de hele boom af, want een tool krijgt zijn token net zo vaak in `{headers: {authorization}}`
 * als bovenin. De vorm blijft gelijk (dezelfde sleutels, dezelfde nesting), zodat de vraag er
 * hetzelfde uitziet als de aanroep die straks gedaan wordt.
 */
export function redactArgs<T>(value: T, keyName?: string): T {
  if (keyName !== undefined && isSecretName(keyName)) {
    // Een array of object onder een geheime naam wordt niet uitgeklapt: dan zou de inhoud er
    // alsnog staan.
    return REDACTED as unknown as T;
  }
  if (typeof value === "string") return scrubText(value) as unknown as T;
  if (Array.isArray(value)) {
    return value.map((entry) => redactArgs(entry)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [name, entry] of Object.entries(
      value as Record<string, unknown>,
    )) {
      out[name] = redactArgs(entry, name);
    }
    return out as unknown as T;
  }
  return value;
}
