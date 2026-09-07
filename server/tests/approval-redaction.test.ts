import { describe, expect, test } from "bun:test";
import {
  isSecretName,
  REDACTED,
  redactArgs,
} from "../src/notos/approvals/redact";

/**
 * Wat een mens te zien krijgt als hij een Bot toestemming geeft.
 *
 * De vraag toont de argumenten van de aanroep, dus alles wat daarin staat belandt op het scherm en
 * in de tabel. Een token hoort daar niet bij, en een onleesbare vraag ook niet: wie niet meer ziet
 * wát er gevraagd wordt, klikt hem blind weg. Deze twee eisen trekken tegen elkaar, en dat is
 * precies wat hier vastligt.
 */
describe("een geheim in een goedkeuringsvraag", () => {
  test("een veld dat een sleutel heet, laat zijn waarde niet zien", () => {
    const args = redactArgs({ api_key: "abc123", url: "https://zuid.com" });
    expect(args.api_key).toBe(REDACTED);
    expect(args.url).toBe("https://zuid.com");
  });

  test("ook een kort of leeg wachtwoord gaat weg", () => {
    // Op de naam, niet op de lengte: een wachtwoord van één teken is een wachtwoord.
    expect(redactArgs({ password: "a" }).password).toBe(REDACTED);
    expect(redactArgs({ password: "" }).password).toBe(REDACTED);
  });

  test("een geheim dat dieper in de aanroep zit gaat ook weg", () => {
    const args = redactArgs({
      request: { headers: { Authorization: "Bearer abcdefghijklmnop" } },
    });
    expect(args.request.headers.Authorization).toBe(REDACTED);
  });

  test("een lijst onder een geheime naam wordt niet alsnog uitgeklapt", () => {
    expect(redactArgs({ tokens: ["een", "twee"] }).tokens).toBe(REDACTED);
  });

  test("een sleutel in een gewone zin wordt eruit geknipt, de zin blijft", () => {
    const args = redactArgs({
      note: "Gebruik sk-ant-api03-AAAABBBBCCCCDDDDEEEE voor de test",
    });
    expect(args.note).toContain("Gebruik");
    expect(args.note).toContain("voor de test");
    expect(args.note).not.toContain("sk-ant-api03");
  });

  test.each([
    ["een JWT", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcd"],
    ["een Google-sleutel", "AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q"],
    ["een GitHub-token", "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"],
    ["een Slack-token", "xoxb-1234567890-abcdefghij"],
  ])("%s wordt herkend, ook zonder verdachte veldnaam", (_naam, waarde) => {
    expect(redactArgs({ body: waarde }).body).toBe(REDACTED);
  });

  test("gewone tekst blijft heel, ook als hij lang is", () => {
    // Zonder deze grens verdwijnt de helft van elke normale vraag achter een blokje.
    const zin =
      "Zet de weekbudgetten voor Zoover op 350 euro voor LinkedIn en 150 euro voor Meta, en meld het in het kanaal.";
    expect(redactArgs({ instruction: zin }).instruction).toBe(zin);
  });

  test("de vorm van de aanroep verandert niet", () => {
    // De vraag moet lijken op wat er straks echt gebeurt, dus dezelfde sleutels en nesting.
    const before = { a: 1, b: { c: [true, null] }, token: "x" };
    const after = redactArgs(before);
    expect(Object.keys(after)).toEqual(["a", "b", "token"]);
    expect(after.b).toEqual({ c: [true, null] });
  });

  test("namen die op een geheim lijken maar het niet zijn, blijven staan", () => {
    // "keyword" en "monkey" bevatten "key"; die mogen niet meegesleept worden.
    expect(isSecretName("keyword")).toBe(false);
    expect(isSecretName("monkey")).toBe(false);
    expect(isSecretName("key")).toBe(true);
    expect(isSecretName("api_key")).toBe(true);
    expect(isSecretName("client_secret")).toBe(true);
  });
});
