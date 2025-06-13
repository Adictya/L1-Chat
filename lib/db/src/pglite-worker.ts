import { PGlite } from "@electric-sql/pglite";
import { worker } from "@electric-sql/pglite/worker";
import { drizzle } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import migrations from "../migrations.json";
import * as schema from "./schema";
import type { MigrationConfig } from "drizzle-orm/migrator";
import type { Conversation, ChatMessage } from "./schema";

type SyncEventType =
	| "populateConversations"
	| "createConversation"
	| "addMessage"
	| "updateMessage"
	| "updateMessageStream";

interface BaseSyncEvent {
	type: SyncEventType;
	timestamp: number;
}

interface CreateConversationEvent extends BaseSyncEvent {
	type: "createConversation";
	conversation: Conversation;
}

interface AddMessageEvent extends BaseSyncEvent {
	type: "addMessage";
	conversationId: string;
	message: ChatMessage;
}

interface UpdateMessageEvent extends BaseSyncEvent {
	type: "updateMessage";
	messageIndex: number;
	conversationId: string;
	message: ChatMessage;
}

interface UpdateMessageStreamEvent extends BaseSyncEvent {
	type: "updateMessageStream";
	messageIndex: number;
	conversationId: string;
	part: string;
}

type SyncEvent =
	| CreateConversationEvent
	| AddMessageEvent
	| UpdateMessageEvent
	| UpdateMessageStreamEvent;

worker({
	async init(options) {
		const pgLiteClient = await PGlite.create({
			dataDir: options.dataDir,
		});

		const db = drizzle({ client: pgLiteClient, schema });

		console.log("Running migrations", migrations.length);
		// @ts-expect-error
		await db.dialect.migrate(migrations, db.session, {
			migrationsTable: "drizzle_migrations",
		} satisfies Omit<MigrationConfig, "migrationsFolder">);
		console.log("Migrations ran");

		// Set up broadcast channel listener
		const syncChannel = new BroadcastChannel("l1-chat-sync-events");
		syncChannel.onmessage = (message: unknown) => {
			const event = message as MessageEvent<SyncEvent>;
			const data = event.data;
			const { type, ...params } = data;

			console.log("[Broadcast] Received event in worker:", {
				type,
				params,
				timestamp: Date.now(),
			});

			switch (type) {
				case "createConversation": {
					const { conversation } = params as CreateConversationEvent;
					console.log("[DB] Persisting conversation:", conversation);
					db.insert(schema.conversation)
						.values({
							id: conversation.id,
							data: conversation,
						})
						.then(() => {
							console.log("Conversation persisted:", conversation.id);
						})
						.catch((error) => {
							console.error("Error persisting conversation:", error);
						});
					console.log("[DB] Conversation persisted:", conversation.id);
					break;
				}
				case "addMessage": {
					const { message } = params as AddMessageEvent;
					console.log("[DB] Persisting message:", message);
					db.insert(schema.chatMessageTable)
						.values({
							id: message.id,
							conversationId: message.conversationId,
							data: message,
						})
						.then(() => {
							console.log("Message persisted:", message.id);
						})
						.catch((error) => {
							console.error("Error persisting message:", error);
						});
					console.log("[DB] Message persisted:", message.id);
					break;
				}
				case "updateMessage": {
					const { conversationId, message } = params as UpdateMessageEvent;
					// For update messages, we need to fetch the existing message first
					console.log("[DB] Updating message:", message);
					db.query.chatMessageTable
						.findFirst({
							where: and(
								eq(schema.chatMessageTable.id, message.id),
								eq(schema.chatMessageTable.conversationId, conversationId),
							),
						})
						.then(async (existingMessage) => {
							if (existingMessage) {
								const updatedMessage = { ...existingMessage.data, ...message };

								await db
									.update(schema.chatMessageTable)
									.set({ data: updatedMessage as ChatMessage })
									.where(eq(schema.chatMessageTable.id, existingMessage.id));
								console.log("Message updated:", existingMessage.id);
							}
						})
						.catch((error) => {
							console.error("Error updating message:", error);
						});
					console.log("[DB] Message updated:", conversationId);
					break;
				}
			}
		};

		return pgLiteClient;
	},
});
