// NOTOS: de omschrijving van een connector in de taal van de lezer (Mitch, 6 september 2026).
//
// De server houdt één Engelse omschrijving per connector aan; die staat in een gereviewde
// catalogus en wordt ook buiten de app gelezen. De vertaling hoort dus hier, naast de rest van de
// interface. Een connector die een beheerder zelf toevoegt heeft geen sleutel en houdt de tekst
// die de server stuurt.
import { trOr, useTOr } from "@/i18n";

const keyFor = (connector: string) => `connectors.${connector}.summary`;

/** Buiten React, bijvoorbeeld in een lijst die op tekst sorteert. */
export function connectorSummary(connector: string, summary: string): string {
  return trOr(keyFor(connector), summary);
}

/** In een component, zodat de tekst meebeweegt met een taalwissel. */
export function useConnectorSummary(): (
  connector: string,
  summary: string,
) => string {
  const t = useTOr();
  return (connector, summary) => t(keyFor(connector), summary);
}
