// NOTOS: één beeldmerk per connector, uit de open-source set van theSVG (Mitch, 5 september 2026).
import { IconClock, IconPlug } from "@tabler/icons-react";
import {
  Cloudflare,
  Figma,
  Gmail,
  GoogleDrive,
  Hubspot,
  Linear,
  Monday,
  Notion,
  Paypal,
  Shopify,
  Stripe,
  Webflow,
} from "@thesvg/react";
import type * as React from "react";

/**
 * Vendor marks by catalogue key. theSVG (github.com/GLINCKER/thesvg, MIT) ships the official
 * logos as React components; a vendor without one (FRIDA, Klaviyo) gets the plug, and the
 * built-in routines Bot gets a clock so nobody looks for a company behind it.
 */
const MARKS: Record<string, React.ComponentType<{ className?: string }>> = {
  cloudflare: Cloudflare,
  figma: Figma,
  gmail: Gmail,
  "google-drive": GoogleDrive,
  hubspot: Hubspot,
  linear: Linear,
  monday: Monday,
  notion: Notion,
  paypal: Paypal,
  shopify: Shopify,
  stripe: Stripe,
  webflow: Webflow,
  routines: IconClock,
};

export function ConnectorMark({
  keyName,
  className,
}: {
  keyName: string;
  className?: string;
}) {
  const Mark = MARKS[keyName] ?? IconPlug;
  return <Mark className={className} />;
}
