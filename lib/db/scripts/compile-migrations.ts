import { readMigrationFiles } from "drizzle-orm/migrator";
import { join } from "path";
import type {} from "bun"

const migrations = readMigrationFiles({ migrationsFolder: "./src/migrations" });

await Bun.write(
  join(import.meta.dir, "../migrations.json"),
  JSON.stringify(migrations),
);
