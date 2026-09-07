/**
 * NOTOS: de migraties draaien, in een eigen schema als `DATABASE_SCHEMA` gezet is (bouwplan stap 4).
 *
 * Waarom niet gewoon `drizzle-kit migrate`: de gegenereerde SQL noemt tabellen als `"public"."x"`
 * in foreign keys en enums, en in het NOTOS-Supabase-project wonen wij in schema `bots`
 * (staging: `bots_staging`), niet in `public`. Dit script herschrijft die verwijzingen naar het
 * gevraagde schema, maakt het schema aan, zet `search_path` voor de sessie en laat drizzle's
 * eigen migrator de rest doen. De administratie van wat al gedraaid is staat per schema
 * (`<schema>.__drizzle_migrations`), zodat staging en productie elkaar niet in de weg zitten.
 *
 * Zonder `DATABASE_SCHEMA` gedraagt het zich als `drizzle-kit migrate` op `public` (lokaal).
 *
 *   DATABASE_URL=… DATABASE_SCHEMA=bots_staging bun server/src/notos/migrate.ts
 */
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const schema = process.env.DATABASE_SCHEMA?.trim() || "public";
if (!/^[a-z_][a-z0-9_]*$/.test(schema)) {
  console.error(`DATABASE_SCHEMA "${schema}" is not a plain identifier`);
  process.exit(1);
}

/*
 * Where the .sql files are.
 *
 * `import.meta.dir` is the source tree when this runs from source, and a path inside the binary
 * (`/$bunfs/root`) once it is compiled with `bun build --compile`. A packaged build therefore ships
 * the folder beside itself and names it here, rather than the migrations silently not being found:
 * an empty database that skips its migrations starts, serves, and only fails on the first query.
 */
const source =
  process.env.MIGRATIONS_DIR?.trim() ||
  resolve(import.meta.dir, "../../drizzle");
const folder =
  schema === "public"
    ? source
    : await (async () => {
        const target = await mkdtemp(join(tmpdir(), "notos-bots-migrations-"));
        for (const name of await readdir(source)) {
          if (!name.endsWith(".sql")) continue;
          const sql = await readFile(join(source, name), "utf8");
          await writeFile(
            join(target, name),
            sql.replaceAll('"public".', `"${schema}".`),
          );
        }
        // De journal is het enige uit meta/ dat de migrator leest.
        const { mkdir, copyFile } = await import("node:fs/promises");
        await mkdir(join(target, "meta"), { recursive: true });
        await copyFile(
          join(source, "meta", "_journal.json"),
          join(target, "meta", "_journal.json"),
        );
        return target;
      })();

const journal = join(folder, "meta", "_journal.json");
if (!(await Bun.file(journal).exists())) {
  console.error(
    `No migrations at ${folder}: ${journal} is missing. Set MIGRATIONS_DIR to the folder holding the .sql files and meta/_journal.json.`,
  );
  process.exit(1);
}

const client = new SQL(databaseUrl, { max: 1 });
if (schema !== "public") {
  // `vector` woont op Supabase in `extensions`; op een kale Postgres in `public`.
  await client.unsafe(`create schema if not exists "${schema}"`);
  await client.unsafe(`set search_path to "${schema}", extensions, public`);
}
const database = drizzle({ client });
await migrate(database, {
  migrationsFolder: folder,
  ...(schema === "public" ? {} : { migrationsSchema: schema }),
});
const [{ count }] = await client.unsafe(
  `select count(*)::int as count from information_schema.tables where table_schema = '${schema}'`,
);
console.log(
  JSON.stringify({
    type: "migrated",
    schema,
    tables: count,
    folder: schema === "public" ? "server/drizzle" : "rewritten",
  }),
);
await client.end();
