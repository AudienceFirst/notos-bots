// NOTOS: persoonlijke voorkeuren die op de server horen, zodat ze je op elk apparaat volgen
// (Mitch, 6 september 2026). Nu alleen de taal van de interface.
import { eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { users } from "../../db/schema/core";

export const LOCALES = ["nl", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value);

export type PreferenceStore = {
  /** The chosen interface language, or null when the person never chose (the browser decides). */
  locale(userId: string): Promise<Locale | null>;
  setLocale(userId: string, locale: Locale | null): Promise<void>;
};

export function createPreferenceStore(database: Database): PreferenceStore {
  return {
    async locale(userId) {
      const [row] = await database
        .select({ locale: users.locale })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      return row && isLocale(row.locale) ? row.locale : null;
    },
    async setLocale(userId, locale) {
      await database
        .update(users)
        .set({ locale, updatedAt: new Date() })
        .where(eq(users.id, userId));
    },
  };
}
