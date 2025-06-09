import type { MigrationConfig } from "drizzle-orm/migrator";
import db from "./db";
import migrations from "./migrations.json";

export async function migrate() {
  console.log("Running migration");
  // @ts-expect-error: non public APIS
  db.dialect.migrate(migrations, db.session, {
    migrationsTable: "drizzle_migrations",
  } satisfies Omit<MigrationConfig, "migrationsFolder">);



  console.log("migration ran");
}
