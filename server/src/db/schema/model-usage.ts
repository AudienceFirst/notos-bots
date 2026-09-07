// NOTOS: wat elke modelaanroep heeft gekost, per workspace en Bot (Mitch, 7 september 2026).
import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Eén rij per modelaanroep.
 *
 * Waarom niet meteen optellen per dag: een opgeteld getal beantwoordt precies één vraag, en de
 * vraag verandert. "Wat kost Zoover deze maand", "welke Bot verstookt de meeste tokens", "sinds
 * wanneer loopt dit op": dat zijn drie groeperingen over dezelfde rijen. Optellen kan de database
 * zelf; een detail terughalen dat je bij het schrijven al hebt weggegooid, kan niemand.
 *
 * Er staat geen prijs in. Wat een model kost hangt af van het tarief op het moment van de aanroep,
 * en dat tarief staat hier niet en verandert buiten ons om. Tokens zijn het feit; euro's zijn een
 * som die je maakt met een tarief dat je erbij zoekt, en die som verzinnen we niet.
 *
 * Geen tekst van het gesprek, alleen aantallen: dit is een kostenregistratie, geen tweede kopie
 * van wat er gezegd is.
 */
export const modelUsage = pgTable(
  "model_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Null voor een persoonlijke ruimte: die hoort bij geen klant. */
    workspaceId: uuid("workspace_id"),
    /** Wie de aanroep deed. Vrije tekst, want een Bot kan later verdwijnen. */
    botId: text("bot_id").notNull().default(""),
    provider: text("provider").notNull(),
    modelName: text("model_name").notNull(),
    /*
     * bigint, niet integer: een druk jaar op één rij optellen loopt over de 2,1 miljard heen, en
     * een stille overflow in een kostenoverzicht is erger dan een kolom die te ruim staat.
     */
    inputTokens: bigint("input_tokens", { mode: "number" }).notNull().default(0),
    outputTokens: bigint("output_tokens", { mode: "number" })
      .notNull()
      .default(0),
    /** Wat uit de cache kwam, apart: dat is goedkoper en het verklaart een lage rekening. */
    cachedInputTokens: bigint("cached_input_tokens", { mode: "number" })
      .notNull()
      .default(0),
    reasoningTokens: bigint("reasoning_tokens", { mode: "number" })
      .notNull()
      .default(0),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // De twee vragen die dit overzicht stelt: wat deed deze workspace, en wat deed dit model.
    index("model_usage_workspace_at_idx").on(table.workspaceId, table.at),
    index("model_usage_model_at_idx").on(table.provider, table.modelName, table.at),
  ],
);
