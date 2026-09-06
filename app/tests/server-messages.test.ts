import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import en from "../src/i18n/en";
import nl from "../src/i18n/nl";

/**
 * The sentences the server sends, and the translations that stand for them.
 *
 * The server writes one English sentence per failure and the app looks it up by that exact
 * sentence, the way a po file does. That works only while the two stay in step: reword a sentence
 * on the server and the lookup quietly misses, leaving a Dutch screen with an English line on it
 * and nothing to say it broke. This test is that alarm.
 *
 * Sentences the server builds from a name or a number are deliberately absent: a key holding half a
 * sentence would match nothing, so those arrive in English and this test does not ask otherwise.
 */
const SERVER_SOURCE = join(import.meta.dir, "../../server/src");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

function sentences(): Set<string> {
  const found = new Set<string>();
  for (const path of sourceFiles(SERVER_SOURCE)) {
    const source = readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const match of source.matchAll(
      /error:\s*\n?\s*"((?:[^"\\]|\\.)*)"/g,
    )) {
      found.add(match[1]);
    }
  }
  return found;
}

describe("the server's own sentences", () => {
  const keyed = (sentence: string) => `server:${sentence}`;

  test("every sentence the server sends has a Dutch translation", () => {
    const missing = [...sentences()].filter(
      (sentence) => !(keyed(sentence) in nl),
    );
    expect(missing).toEqual([]);
  });

  test("every sentence is listed in English too, so the source is reviewable", () => {
    const missing = [...sentences()].filter(
      (sentence) => !(keyed(sentence) in en),
    );
    expect(missing).toEqual([]);
  });

  test("no translation is left over for a sentence the server no longer sends", () => {
    const live = sentences();
    const stale = Object.keys(nl)
      .filter((key) => key.startsWith("server:"))
      .map((key) => key.slice("server:".length))
      .filter((sentence) => !live.has(sentence));
    expect(stale).toEqual([]);
  });

  test("the English side repeats the sentence rather than rewording it", () => {
    for (const sentence of sentences()) {
      expect(en[keyed(sentence)]).toBe(sentence);
    }
  });
});

/**
 * The connector catalogue is written once, on the server, and read on three screens. Adding a
 * connector without a translation is the easy mistake, and it shows up as one English paragraph in
 * an otherwise Dutch list, so it is caught here instead.
 */
describe("the connector catalogue", () => {
  const catalogue = readFileSync(
    join(SERVER_SOURCE, "plugins/catalogue.ts"),
    "utf8",
  );
  const keys = [...catalogue.matchAll(/^\s{4}key:\s*"([a-z0-9-]+)",$/gm)].map(
    (match) => match[1],
  );

  test("the catalogue is read, not assumed empty", () => {
    expect(keys.length).toBeGreaterThan(10);
  });

  test("every connector has a Dutch summary", () => {
    const missing = keys.filter((key) => !(`connectors.${key}.summary` in nl));
    expect(missing).toEqual([]);
  });

  test("every connector has its English summary listed too", () => {
    const missing = keys.filter((key) => !(`connectors.${key}.summary` in en));
    expect(missing).toEqual([]);
  });
});
