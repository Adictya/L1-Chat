import { eq, asc } from "drizzle-orm";
import db, {
	chatMessage,
	conversation,
	type ChatMessage,
	type Conversation,
} from "l1-db";
import { useSubscription } from "@/hooks/use-subscriptions";
import pg from "./pglite";

export function useSubscribeConversations() {
	const { data } = useSubscription<Conversation>(
		db.select().from(conversation).orderBy(asc(conversation.createdAt)).toSQL(),
	);

	return data;
}

export function useSubscribeConversationMessages(conversationId: number) {
	const { data: msgs } = useSubscription<ChatMessage>(
		db
			.select()
			.from(chatMessage)
			.where(eq(chatMessage.conversationId, conversationId))
			.orderBy(asc(chatMessage.createdAt))
			.toSQL(),
	);

	return msgs;
}

export async function createConversation(title: string) {
	const result = await pg.query<{ id: number }>(
		"INSERT INTO conversation (title) VALUES ($1) RETURNING id",
		[title],
	);
	return result.rows[0]?.id;
}

export async function addMessage(
	conversationId: number,
	role: "user" | "assistant" | "system",
	content: string,
	meta: ChatMessage["meta"],
) {
	const result = await pg.query<{ id: number }>(
		"INSERT INTO chat_message (conversation_id, role, content, meta) VALUES ($1, $2, $3, $4	) RETURNING id",
		[conversationId, role, content, meta],
	);
	return result.rows[0]?.id;
}

// Should  be able to update meta
export async function updateMessage(messageId: number, content: string, meta?: Partial<ChatMessage["meta"]>) {
	await pg.query(
		"UPDATE chat_message SET content = $1, meta = COALESCE(meta, '{}'::jsonb) || $2::jsonb WHERE id = $3",
		[content, meta || {}, messageId]
	);
}
