import type { MigrationConfig } from "drizzle-orm/migrator";
import db from "./db";
import migrations from "./migrations.json";
import { chatMessageTable, conversation } from "./schema";

export async function migrate() {
	console.log("Running migration");
	// @ts-expect-error: non public APIS
	await db.dialect.migrate(migrations, db.session, {
		migrationsTable: "drizzle_migrations",
	} satisfies Omit<MigrationConfig, "migrationsFolder">);

	const conversations = await db.select().from(conversation);
	const chats = await db.select().from(chatMessageTable);

	console.log("conversations", conversations);
	console.log("chats", chats);

	console.log("migration ran");
}
