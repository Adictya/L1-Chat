import { PGlite } from "@electric-sql/pglite";
import { worker } from "@electric-sql/pglite/worker";
import { live } from "@electric-sql/pglite/live";
import { drizzle } from "drizzle-orm/pglite";
import migrations from "./migrations.json";
import * as schema from "./schema";
import type { MigrationConfig } from "drizzle-orm/migrator";

worker({
	async init(options) {
		const meta = options.meta;
		const pgLiteClient = await PGlite.create({
			dataDir: options.dataDir,
			extensions: {
				live,
			},
		});

		const db = drizzle({ client: pgLiteClient, schema });

		console.log("Running migrations");
		// @ts-expect-error
		await db.dialect.migrate(migrations, db.session, {
			migrationsTable: "drizzle_migrations",
		} satisfies Omit<MigrationConfig, "migrationsFolder">);
		console.log("Migrations ran");
		return pgLiteClient;
	},
});
