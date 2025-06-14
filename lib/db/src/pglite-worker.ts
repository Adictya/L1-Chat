import { PGlite } from "@electric-sql/pglite";
import { worker } from "@electric-sql/pglite/worker";
import { drizzle } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import migrations from "../migrations.json";
import * as schema from "./schema";
import type { MigrationConfig } from "drizzle-orm/migrator";
import type { ChatMessage } from "./schema";
import { SyncEventManager, BroadcastChannelTransport } from "l1-sync";

// Initialize SyncEventManager
const syncEventManager = new SyncEventManager();
const broadcastChannelTransport = new BroadcastChannelTransport(
	"l1-chat-sync-events",
);
syncEventManager.addTransport(broadcastChannelTransport);

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

		// Register event handlers
		syncEventManager.on<"createConversation">("createConversation", async (eventData) => {
			const { conversation } = eventData;
			console.log("[DB] Persisting conversation:", conversation);
			try {
				await db.insert(schema.conversation).values({
					id: conversation.id,
					data: conversation,
				});
				console.log("[DB] Conversation persisted:", conversation.id);
			} catch (error) {
				console.error("Error persisting conversation:", error);
			}
		});

		syncEventManager.on<"addMessage">("addMessage", async (eventData) => {
			const { message } = eventData;
			console.log("[DB] Persisting message:", message);
			try {
				await db.insert(schema.chatMessageTable).values({
					id: message.id,
					conversationId: message.conversationId,
					data: message,
				});
				console.log("[DB] Message persisted:", message.id);
			} catch (error) {
				console.error("Error persisting message:", error);
			}
		});

		syncEventManager.on<"updateMessage">("updateMessage", async (eventData) => {
			const { conversationId, message } = eventData;
			console.log("[DB] Updating message:", message);
			try {
				const existingMessage = await db.query.chatMessageTable.findFirst({
					where: and(
						eq(schema.chatMessageTable.id, message.id),
						eq(schema.chatMessageTable.conversationId, conversationId),
					),
				});

				if (existingMessage) {
					const updatedMessage = { ...existingMessage.data, ...message };
					await db
						.update(schema.chatMessageTable)
						.set({ data: updatedMessage as ChatMessage })
						.where(eq(schema.chatMessageTable.id, existingMessage.id));
					console.log("[DB] Message updated:", existingMessage.id);
				}
			} catch (error) {
				console.error("Error updating message:", error);
			}
		});

		return pgLiteClient;
	},
});
