const RELATIVE_UNITS = [
  { limit: 60_000, divisor: 1_000, unit: "second" },
  { limit: 3_600_000, divisor: 60_000, unit: "minute" },
  { limit: 86_400_000, divisor: 3_600_000, unit: "hour" },
  { limit: 604_800_000, divisor: 86_400_000, unit: "day" },
  { limit: Number.POSITIVE_INFINITY, divisor: 604_800_000, unit: "week" },
] as const;

/*
 * Pinned to English rather than the browser's locale: the interface is English, and a Dutch
 * browser turned one chip into "Next over 6 dagen" and the roster into "8 uur geleden" beside
 * "Search..." and "Ask anything". One language per screen; this is the one the chrome speaks.
 */
const relativeFormat = new Intl.RelativeTimeFormat("en", {
  numeric: "auto",
});

/** Relative timestamp in the interface's language, e.g. "2 minutes ago". */
export function relativeTime(iso: string): string {
  const elapsed = Date.now() - new Date(iso).getTime();
  const scale =
    RELATIVE_UNITS.find(({ limit }) => Math.abs(elapsed) < limit) ??
    RELATIVE_UNITS[RELATIVE_UNITS.length - 1];
  return relativeFormat.format(
    -Math.round(elapsed / scale.divisor),
    scale.unit,
  );
}
