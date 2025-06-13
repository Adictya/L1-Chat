import { PGlite } from "@electric-sql/pglite";
import { worker } from "@electric-sql/pglite/worker";
import { live } from "@electric-sql/pglite/live";
import { drizzle } from "drizzle-orm/pglite";
import migrations from "../migrations.json";
import * as schema from "./schema";
import type { MigrationConfig } from "drizzle-orm/migrator";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

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

		console.log("Running migrations", migrations.length);
		// @ts-expect-error
		await db.dialect.migrate(migrations, db.session, {
			migrationsTable: "drizzle_migrations",
		} satisfies Omit<MigrationConfig, "migrationsFolder">);
		console.log("Migrations ran");

		const google = createGoogleGenerativeAI({
			apiKey: meta.apiKey as string,
		});

		console.log("Google init");

		const bc = new BroadcastChannel("ai-channel");

		bc.onmessage = async (event: unknown) => {
			const castedEvent = event.data as {
				message: string;
				conversationId: number;
			};

			console.log("Event", castedEvent);
		};
		return pgLiteClient;
	},
});
