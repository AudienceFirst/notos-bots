import { describe, expect, test } from "bun:test";
import {
  type ChannelMessage,
  type EventRoutine,
  fireRoutinesForMessage,
  matches,
} from "../src/routines/on-message";
import { ROUTINE_FIRE_KIND } from "../src/routines/sweep";

const message = (patch: Partial<ChannelMessage> = {}): ChannelMessage => ({
  channelId: "kanaal-1",
  text: "hoi",
  agentId: null,
  at: new Date("2026-09-07T10:00:00.000Z"),
  ...patch,
});

const routine = (patch: Partial<EventRoutine> = {}): EventRoutine => ({
  id: "routine_1",
  agentId: "tess",
  trigger: "keyword",
  keyword: "budget",
  ...patch,
});

/** Een wachtrij die alleen onthoudt wat hem aangeboden is. */
function fakeQueue() {
  const offered: { kind: string; key: string; payload: unknown }[] = [];
  return {
    offered,
    queue: {
      offer: async (item: { kind: string; key: string; payload: unknown }) => {
        offered.push(item);
        return true;
      },
    } as never,
  };
}

describe("wanneer een bericht een routine start", () => {
  test("een trefwoord in het bericht start de routine", async () => {
    const { queue, offered } = fakeQueue();
    const result = await fireRoutinesForMessage({
      queue,
      routinesInChannel: async () => [routine()],
      message: message({ text: "Kunnen we het budget verhogen?" }),
    });
    expect(result.fired).toEqual(["routine_1"]);
    expect(offered).toHaveLength(1);
    expect(offered[0].kind).toBe(ROUTINE_FIRE_KIND);
  });

  test("een Bot start niets, ook niet als het trefwoord er staat", async () => {
    /*
     * Dit is de belangrijkste regel van dit bestand. Een routine laat een Bot iets zeggen; zou een
     * Bot ook een routine kunnen starten, dan houden twee Bots in één kanaal elkaar aan de gang.
     */
    const { queue, offered } = fakeQueue();
    const result = await fireRoutinesForMessage({
      queue,
      routinesInChannel: async () => [routine()],
      message: message({ text: "het budget staat vast", agentId: "noud" }),
    });
    expect(result.fired).toEqual([]);
    expect(offered).toHaveLength(0);
  });

  test("hetzelfde bericht levert dezelfde sleutel, dus één run", async () => {
    // Twee replica's die hetzelfde bericht zien mogen samen niet twee runs opleveren.
    const first = fakeQueue();
    const second = fakeQueue();
    const one = message({ text: "budget" });
    for (const side of [first, second]) {
      await fireRoutinesForMessage({
        queue: side.queue,
        routinesInChannel: async () => [routine()],
        message: one,
      });
    }
    expect(first.offered[0].key).toBe(second.offered[0].key);
  });

  test("een leeg bericht start niets", async () => {
    const { queue, offered } = fakeQueue();
    await fireRoutinesForMessage({
      queue,
      routinesInChannel: async () => [routine()],
      message: message({ text: "   " }),
    });
    expect(offered).toHaveLength(0);
  });

  test("een routine op de klok komt hier nooit aan bod", () => {
    expect(
      matches(routine({ trigger: "schedule" }), message({ text: "budget" })),
    ).toBe(false);
  });
});

describe("of een bericht bij een routine past", () => {
  test("een trefwoord let niet op hoofdletters", () => {
    expect(matches(routine(), message({ text: "BUDGET omhoog" }))).toBe(true);
  });

  test("een leeg trefwoord past nergens op", () => {
    // Anders zou wie het veld leeg liet een routine hebben die op élk bericht afgaat.
    expect(
      matches(routine({ keyword: "  " }), message({ text: "wat dan ook" })),
    ).toBe(false);
  });

  test("een vermelding gaat op de naam van de Bot met een apenstaartje", () => {
    const mention = routine({
      trigger: "mention",
      agentId: "tess",
      keyword: "",
    });
    expect(
      matches(mention, message({ text: "kun jij dit oppakken @tess?" })),
    ).toBe(true);
    expect(matches(mention, message({ text: "tess weet dit wel" }))).toBe(
      false,
    );
  });

  test("een onbekende aanleiding past nergens op", () => {
    expect(
      matches(routine({ trigger: "zomaar" }), message({ text: "budget" })),
    ).toBe(false);
  });
});
