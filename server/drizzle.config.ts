// NOTOS: threads.ts toegevoegd aan de schemalijst (stap 0).
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be configured before running a database migration command",
  );
}

export default defineConfig({
  dialect: "postgresql",
  /**
   * Every schema file, listed explicitly.
   *
   * Files missing from this list are invisible to `generate`; existing tables still work, but the
   * next generated migration treats them as absent. Add the file here in the same change that adds
   * the schema file.
   */
  schema: [
    "./src/db/schema/core.ts",
    "./src/db/schema/computer.ts",
    "./src/db/schema/coworker.ts",
    "./src/db/schema/components.ts",
    "./src/db/schema/plugins.ts",
    "./src/db/schema/work.ts",
    // NOTOS: gesprekken in eigen Postgres (stap 0).
    "./src/db/schema/threads.ts",
    "./src/db/schema/approvals.ts",
    "./src/db/schema/campaigns.ts",
    "./src/db/schema/model-keys.ts",
  ],
  out: "./drizzle",
  // NOTOS: in het NOTOS-Supabase-project wonen wij in een eigen schema (stap 4); `check` en
  // `generate` kijken dan alleen daar. Migreren gaat via scripts/notos/migrate.ts.
  ...(process.env.DATABASE_SCHEMA
    ? { schemaFilter: [process.env.DATABASE_SCHEMA] }
    : {}),
  dbCredentials: {
    url: databaseUrl,
  },
});
