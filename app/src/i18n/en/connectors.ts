// NOTOS i18n: de connectorcatalogus. De server houdt één Engelse omschrijving per connector aan,
// omdat die ook buiten de app gelezen wordt; hier staat de tekst die een mens in de interface ziet.
// Een connector zonder sleutel valt terug op wat de server stuurt (Mitch, 6 september 2026).
const connectors: Record<string, string> = {
  "connectors.cloudflare.summary":
    "Zones, DNS, Workers and analytics of the Cloudflare account you connect; changes wait for a person.",
  "connectors.figma.summary":
    "Design files, components and comments you can open; nothing is changed in Figma from here.",
  "connectors.frida.summary":
    "Your own FRIDA account: assignments, tasks, hours and meetings as you see them, nobody else's.",
  "connectors.gmail.summary":
    "Your own mailbox: search and read as you, drafts in your name, sending only inside the organisation.",
  "connectors.google-drive.summary": "Files in the Drive of whoever is asking.",
  "connectors.hubspot.summary":
    "Contacts, companies, deals and tickets in the CRM, read as you; changes wait for a person.",
  "connectors.klaviyo.summary":
    "Profiles, lists, segments, campaigns and flows of the Klaviyo account; sends and changes wait for a person.",
  "connectors.linear.summary":
    "Issues, projects and cycles of the teams you are in; changes wait for a person.",
  "connectors.monday.summary":
    "Boards, items and updates of the workspaces you are in; changes wait for a person.",
  "connectors.notion.summary": "Pages and databases of whoever is asking.",
  "connectors.paypal.summary":
    "Orders, invoices, disputes and payouts of the PayPal business account; money movements wait for a person.",
  "connectors.routines.summary":
    "Standing instructions a Bot runs on a schedule, as whoever scheduled them.",
  "connectors.shopify.summary":
    "A Shopify shop you have access to: shop, products and orders, read as you.",
  "connectors.stripe.summary":
    "Customers, payments, subscriptions and invoices of the Stripe account you pick; refunds and changes wait for a person.",
  "connectors.webflow.summary":
    "Your Webflow sites: pages, CMS collections and items, read as you; changes wait for a person.",
};

export default connectors;
