const RELATIVE_UNITS = [
  { limit: 60_000, divisor: 1_000, unit: "second" },
  { limit: 3_600_000, divisor: 60_000, unit: "minute" },
  { limit: 86_400_000, divisor: 3_600_000, unit: "hour" },
  { limit: 604_800_000, divisor: 86_400_000, unit: "day" },
  { limit: Number.POSITIVE_INFINITY, divisor: 604_800_000, unit: "week" },
] as const;

/**
 * NOTOS: relative times follow the interface language, which the I18nProvider sets here. Kept
 * as a module-level formatter so callers outside React (roster rows, chips) need no hook.
 */
const formatters: Record<string, Intl.RelativeTimeFormat> = {};
let currentLocale = "en";

export function setRelativeTimeLocale(locale: "nl" | "en"): void {
  currentLocale = locale;
}

function formatter(): Intl.RelativeTimeFormat {
  const tag = currentLocale === "nl" ? "nl-NL" : "en";
  formatters[tag] ??= new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
  return formatters[tag];
}

export function relativeTime(iso: string): string {
  const elapsed = Date.now() - new Date(iso).getTime();
  const scale =
    RELATIVE_UNITS.find(({ limit }) => Math.abs(elapsed) < limit) ??
    RELATIVE_UNITS[RELATIVE_UNITS.length - 1];
  return formatter().format(-Math.round(elapsed / scale.divisor), scale.unit);
}
