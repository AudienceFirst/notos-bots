// NOTOS: routines die starten op iets dat gebeurt, niet op de klok (Mitch, 7 september 2026).
//
// De sweep laat een routine op een tijdstip lopen. Er is werk dat niet op een tijdstip hoort maar
// op een aanleiding: iemand noemt een Bot, of er valt een woord in een kanaal waar iemand op wil
// dat er iets gebeurt. Dat is hier.
//
// HET GAAT DEZELFDE WEG ALS DE KLOK. Een gebeurtenis zet een item op dezelfde wachtrij, met
// dezelfde soort sleutel, en wordt door dezelfde helft opgepakt en uitgevoerd. Een tweede
// afvuurmechanisme naast het bestaande zou twee plekken opleveren waar "één keer" bewezen moet
// worden, en dat is precies wat de sweep in zijn kop beschrijft te willen voorkomen.
//
// TWEE DINGEN DIE HIER MOETEN GELDEN, en waar de code hieronder op gebouwd is:
//
//  1. Alleen een mens vuurt. Een Bot die in een kanaal iets zegt mag geen routine starten, want
//     die routine laat een Bot iets zeggen. Twee Bots in één kanaal houden elkaar dan aan de gang
//     tot iemand het merkt. `agentId === null` betekent dat een mens het zei; alles anders gaat
//     hier de deur niet in.
//  2. Eén bericht start een routine hooguit één keer. De sleutel draagt het moment van het
//     bericht, zodat twee replica's die hetzelfde bericht zien samen één run opleveren.
import type { WorkQueue } from "../work/queue";
import { ROUTINE_FIRE_KIND } from "./sweep";

/** Wat er van een bericht nodig is om te beslissen of er iets moet starten. */
export type ChannelMessage = {
  channelId: string;
  text: string;
  /** De Bot die het zei, of null als een mens het zei. Alleen dat laatste vuurt. */
  agentId: string | null;
  at: Date;
};

/** De routine zoals deze beslissing hem nodig heeft. */
export type EventRoutine = {
  id: string;
  agentId: string;
  trigger: string;
  keyword: string;
};

export type EventRoutineLookup = (channelId: string) => Promise<EventRoutine[]>;

/**
 * Of dit bericht deze routine aangaat.
 *
 * `mention` kijkt of de Bot bij naam genoemd is met een apenstaartje; `keyword` of het woord in de
 * tekst voorkomt. Los van hoofdletters, want niemand typt een trefwoord twee keer hetzelfde.
 */
export function matches(
  routine: EventRoutine,
  message: ChannelMessage,
): boolean {
  const text = message.text.toLowerCase();
  if (routine.trigger === "mention") {
    return text.includes(`@${routine.agentId.toLowerCase()}`);
  }
  if (routine.trigger === "keyword") {
    const word = routine.keyword.trim().toLowerCase();
    /*
     * Een leeg trefwoord zou op élk bericht passen. Dat is bijna zeker niet wat iemand bedoelde
     * die het veld leeg liet, dus dan gebeurt er niets.
     */
    return word.length > 0 && text.includes(word);
  }
  return false;
}

/**
 * Wat er moet starten nu dit gezegd is.
 *
 * Geeft terug welke routines afgevuurd zijn, zodat de aanroeper het kan loggen of testen; de
 * aanroeper hoeft er verder niets mee.
 */
export async function fireRoutinesForMessage(options: {
  queue: WorkQueue;
  routinesInChannel: EventRoutineLookup;
  message: ChannelMessage;
}): Promise<{ fired: string[] }> {
  const { message } = options;
  // Zie punt 1 in de kop: een Bot start hier niets.
  if (message.agentId !== null) return { fired: [] };
  if (message.text.trim().length === 0) return { fired: [] };

  const routines = await options.routinesInChannel(message.channelId);
  const fired: string[] = [];
  for (const routine of routines) {
    if (!matches(routine, message)) continue;
    await options.queue.offer({
      kind: ROUTINE_FIRE_KIND,
      // Zie punt 2: het moment van het bericht maakt de sleutel, niet het moment van nu.
      key: `${routine.id}:msg:${message.at.toISOString()}`,
      payload: {
        routineId: routine.id,
        scheduledFor: message.at.toISOString(),
      },
    });
    fired.push(routine.id);
  }
  return { fired };
}
