// NOTOS i18n: Nederlands en Engels voor de hele interface (Mitch, 6 september 2026).
//
// De taal komt van de persoon (Settings › Preferences, bewaard op de server) en anders van de
// browser. Woordenboeken staan per schermgroep in ./en en ./nl; een sleutel die in de gekozen taal
// ontbreekt valt terug op Engels en daarna op de sleutel zelf, zodat een scherm nooit leeg blijft.
import { useQuery } from "@tanstack/react-query";
import type * as React from "react";
import { createContext, useContext, useEffect, useMemo } from "react";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import { setRelativeTimeLocale } from "@/lib/relative-time";
import en from "./en";
import nl from "./nl";

export const LOCALES = ["nl", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  nl: "Nederlands",
  en: "English",
};

const dictionaries: Record<Locale, Record<string, string>> = { en, nl };

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value);

/** The browser's preference: Dutch when it says so, English otherwise. */
export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  // Outside a browser (tests, server rendering) navigator exists but carries no languages,
  // so every candidate is checked before it is read.
  const candidates: readonly unknown[] = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    if (candidate.toLowerCase().startsWith("nl")) return "nl";
    if (candidate.toLowerCase().startsWith("en")) return "en";
  }
  return "en";
}

type Vars = Record<string, string | number>;

function interpolate(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

function lookup(locale: Locale, key: string, vars?: Vars): string {
  const text = dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
  return interpolate(text, vars);
}

/** The locale in force, for code that runs outside React (query fallbacks, formatters). */
let currentLocale: Locale = detectLocale();

export function getLocale(): Locale {
  return currentLocale;
}

/** Translate outside a component: `tr("lib.channels.loadFailed")`. Reads the locale in force. */
export function tr(key: string, vars?: Vars): string {
  return lookup(currentLocale, key, vars);
}

/**
 * Translate a key that may not exist, with the caller's own text as the answer when it does not.
 *
 * For text that reaches the app from somewhere else, such as the connector catalogue the server
 * keeps in English: the shipped connectors have a key here, and one added later still reads as the
 * sentence the server sent rather than as a key nobody wrote a translation for.
 */
export function trOr(key: string, fallback: string, vars?: Vars): string {
  const text = dictionaries[currentLocale][key] ?? dictionaries.en[key];
  return text === undefined ? fallback : interpolate(text, vars);
}

const LocaleContext = createContext<Locale>(currentLocale);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Tolerant on purpose: on /sign there is no session, and the browser's language is the answer.
  const { data: user } = useQuery({
    ...currentUserQueryOptions(),
    retry: false,
    throwOnError: false,
  });
  const chosen = user?.locale;
  const locale: Locale = isLocale(chosen) ? chosen : detectLocale();
  currentLocale = locale;
  useEffect(() => {
    document.documentElement.lang = locale;
    setRelativeTimeLocale(locale);
  }, [locale]);
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/**
 * The translator for a component: `const t = useT(); t("workspace.campaigns.title")`, with
 * `{name}` placeholders filled from the second argument.
 */
export function useT(): (key: string, vars?: Vars) => string {
  const locale = useLocale();
  return useMemo(
    () => (key: string, vars?: Vars) => lookup(locale, key, vars),
    [locale],
  );
}

/**
 * The same as {@link trOr}, inside a component, so a language change redraws the text.
 */
export function useTOr(): (
  key: string,
  fallback: string,
  vars?: Vars,
) => string {
  const locale = useLocale();
  return useMemo(
    () => (key: string, fallback: string, vars?: Vars) => {
      const text = dictionaries[locale][key] ?? dictionaries.en[key];
      return text === undefined ? fallback : interpolate(text, vars);
    },
    [locale],
  );
}

/** Date and time in the locale in force, for tables and stamps. */
export function formatDateTime(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
  },
): string {
  return new Intl.DateTimeFormat(
    currentLocale === "nl" ? "nl-NL" : "en-GB",
    options,
  ).format(new Date(value));
}
