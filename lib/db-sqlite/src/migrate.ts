import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

export async function migrator(
	db: BunSQLiteDatabase<typeof schema>,
	folder: string,
) {
	console.log("Running migration");
	migrate(db, {
		migrationsFolder: folder,
	});

	const conversations = await db.select().from(schema.conversation);
	const chats = await db.select().from(schema.chatMessageTable);

	console.log("conversations", conversations);
	console.log("chats", chats);

	console.log("migration ran");
}
