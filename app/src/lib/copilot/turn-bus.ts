// NOTOS: een beurt namens de persoon vanuit een gerenderde kaart (bouwplan stap 5).
import { useEffect } from "react";

/**
 * A card in the transcript that needs to speak for the person.
 *
 * The approval card says "Approved, go ahead" once the person has clicked Yes, so the Bot retries
 * without the person typing it. The card is drawn deep inside the transcript and knows nothing of
 * the channel; the channel chat owns `say`. One event on `window` joins them, and only the mounted
 * channel chat listens, which is the one on screen.
 */
const EVENT = "notos:say";

export function sayFromCard(text: string) {
  window.dispatchEvent(
    new CustomEvent<{ text: string }>(EVENT, { detail: { text } }),
  );
}

export function useSayFromCard(say: (text: string) => Promise<void>) {
  useEffect(() => {
    const onSay = (event: Event) => {
      const text = (event as CustomEvent<{ text: string }>).detail?.text;
      if (typeof text === "string" && text.trim()) void say(text);
    };
    window.addEventListener(EVENT, onSay);
    return () => window.removeEventListener(EVENT, onSay);
  }, [say]);
}
