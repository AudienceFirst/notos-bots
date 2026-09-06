// NOTOS i18n: de zinnen die de server zelf terugstuurt, in de taal van de lezer
// (Mitch, 6 september 2026).
//
// De server schrijft één Engelse zin per fout. Hij kent de taal van de lezer niet op elke
// route, en die zin gaat ook naar plekken buiten deze app, dus de vertaling hoort hier: de
// Engelse zin is de sleutel, precies zoals een po-bestand dat doet. Een zin die de server
// samenstelt uit een naam of een getal staat er niet in en blijft staan zoals hij binnenkomt,
// want een halve vertaling leest slechter dan een hele Engelse.
import { trOr } from "@/i18n";

/** De zin zoals een mens hem moet lezen, of de Engelse zin als er geen vertaling voor is. */
export function serverMessage(message: string): string {
  return trOr(`server:${message}`, message);
}
