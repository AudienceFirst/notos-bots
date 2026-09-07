// NOTOS i18n: één regel per meegeleverd component, voor de mens die de galerij bekijkt.
//
// De omschrijving die naast een component is opgeslagen, is geschreven voor het model dat besluit
// of het dit gaat tekenen. Die staat op de beheerpagina, waar hij ook bewerkt wordt. Op het scherm
// voor de lezer staat deze regel, tenzij een omgeving zelf een omschrijving heeft geschreven
// (Mitch, 6 september 2026).
const gallery: Record<string, string> = {
  "gallery.askHandoff.blurb":
    "Asks you to clear one step the Bot cannot do itself, and waits until you say it is done.",
  "gallery.askApproval.blurb":
    "Asks you to approve or decline something, and waits for your answer.",
  "gallery.askChoice.blurb":
    "Asks you to pick one of the options, and waits for your answer.",
  "gallery.showActivityReport.blurb":
    "What the Bots here have been doing, read from this deployment's own records.",
  "gallery.showAreaChart.blurb":
    "A line chart with the area beneath it filled, for volume rather than a rate.",
  "gallery.showBarChart.blurb":
    "Values as bars, for comparing a handful of named things.",
  "gallery.showChecklist.blurb":
    "A list of things, and which of them are done.",
  "gallery.showLineChart.blurb":
    "One or more series along an axis, usually time.",
  "gallery.showMetrics.blurb":
    "Up to six headline figures, each with its movement beside it.",
  "gallery.showNotice.blurb":
    "A headline, a short explanation and a few supporting points.",
  "gallery.showPieChart.blurb":
    "How a whole is divided, as a donut with a legend.",
  "gallery.showProgress.blurb": "Values against their targets, as bars.",
  "gallery.showQuote.blurb": "A quotation with its attribution.",
  "gallery.showRecord.blurb":
    "One thing and its fields: an order, a person, a ticket.",
};

export default gallery;
