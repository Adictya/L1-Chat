import type { PGlite } from "@electric-sql/pglite";
import { type MessageEntry } from "./schema";

export async function createConversation(pg: PGlite, title: string) {
	const result = await pg.query<{ id: number }>(
		"INSERT INTO conversation (title) VALUES ($1) RETURNING id",
		[title],
	);
	return result.rows[0]?.id;
}

export async function addMessage(
	pg: PGlite,
	conversationId: number,
	role: "user" | "assistant" | "system",
	content: string,
) {
	const result = await pg.query<{ id: number }>(
		"INSERT INTO chat_message (conversation_id, role, content) VALUES ($1, $2, $3) RETURNING id",
		[conversationId, role, content],
	);
	return result.rows[0]?.id;
}

export async function updateMessage(
	pg: PGlite,
	messageId: number,
	content: string,
) {
	await pg.query("UPDATE chat_message SET content = $1 WHERE id = $2", [
		content,
		messageId,
	]);
}

export async function getMessages(pg: PGlite, conversationId: number) {
	return await pg.query<MessageEntry>(
		"select * from chat_message WHERE conversation_id = $1",
		[conversationId],
	);
}
