import { describe, expect, test } from "bun:test";
import { readUsage } from "../src/notos/model/usage";

/**
 * De twee vormen waarin de AI SDK zijn tellingen teruggeeft.
 *
 * Dit is geen theorie: onze eigen standaard (Gemini op Vertex) is v2 en geeft platte getallen,
 * terwijl `wrapLanguageModel` uit `ai` alleen v3 aankan. Alleen v3 afhandelen betekende in de
 * praktijk niets meten, en dat viel niet op tot er echt naar de tabel gekeken werd. Vandaar dat
 * beide vormen hier vastliggen.
 */
describe("een telling uitlezen", () => {
  test("v2 geeft platte getallen", () => {
    expect(
      readUsage({
        inputTokens: 4329,
        outputTokens: 12,
        totalTokens: 4361,
        reasoningTokens: 31,
      }),
    ).toEqual({
      inputTokens: 4329,
      outputTokens: 12,
      cachedInputTokens: 0,
      reasoningTokens: 31,
    });
  });

  test("v3 geeft groepjes, en die worden tot dezelfde vier getallen teruggebracht", () => {
    expect(
      readUsage({
        inputTokens: { total: 1000, noCache: 400, cacheRead: 600 },
        outputTokens: { total: 50, text: 40, reasoning: 10 },
      }),
    ).toEqual({
      // 1000 totaal waarvan 600 uit de cache: 400 vers gelezen.
      inputTokens: 400,
      outputTokens: 50,
      cachedInputTokens: 600,
      reasoningTokens: 10,
    });
  });

  test("cache-treffers gaan er in beide vormen af, zodat invoer hetzelfde betekent", () => {
    // Anders lijkt een goedkope maand duur: `total` telt de cache mee, en die is goedkoper.
    const v2 = readUsage({ inputTokens: 1000, cachedInputTokens: 600 });
    const v3 = readUsage({ inputTokens: { total: 1000, cacheRead: 600 } });
    expect(v2.inputTokens).toBe(400);
    expect(v3.inputTokens).toBe(400);
    expect(v2.cachedInputTokens).toBe(600);
    expect(v3.cachedInputTokens).toBe(600);
  });

  test("zonder totaal is het niet-gecachete aantal het beste dat er is", () => {
    expect(readUsage({ inputTokens: { noCache: 250 } }).inputTokens).toBe(250);
  });

  test("ontbrekende of onzinnige waarden worden nul, niet NaN", () => {
    // Niet elke aanbieder meldt alles; een NaN in een optelling maakt het hele overzicht leeg.
    expect(readUsage(undefined)).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      reasoningTokens: 0,
    });
    expect(readUsage({ inputTokens: null, outputTokens: Number.NaN })).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      reasoningTokens: 0,
    });
  });

  test("meer cache dan invoer levert geen negatief getal op", () => {
    expect(
      readUsage({ inputTokens: 100, cachedInputTokens: 400 }).inputTokens,
    ).toBe(0);
  });
});
