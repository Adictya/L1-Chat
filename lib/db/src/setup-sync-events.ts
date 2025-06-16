import * as schema from "./schema";
import type { ChatMessage } from "./schema";
import { and, asc, eq } from "drizzle-orm";
import type { DB } from "./db";
import type { SyncEventManager } from "l1-sync";

export function setupSyncEvents(syncEventManager: SyncEventManager, db: DB) {
	syncEventManager.on<"createConversation">(
		"createConversation",
		async (eventData) => {
			const { conversation, userId } = eventData;
			if (!userId) {
				console.error("No user id found");
				return;
			}
			console.log("[DB] Persisting conversation:", conversation);
			try {
				await db.insert(schema.conversation).values({
					id: conversation.id,
					userId,
					data: conversation,
				});
				console.log("[DB] Conversation persisted:", conversation.id);
			} catch (error) {
				console.error("Error persisting conversation:", error);
			}
		},
	);

	syncEventManager.on<"addMessage">("addMessage", async (eventData) => {
		const { message, userId } = eventData;
		if (!userId) {
			console.error("No user ID found in event data");
			return;
		}
		console.log("[DB] Persisting message:", message);
		try {
			await db.insert(schema.chatMessageTable).values({
				userId,
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
		const { conversationId, message, userId } = eventData;
		if (!userId) {
			console.error("No user id found");
			return;
		}
		console.log("[DB] Updating message:", message);
		try {
			const existingMessage = await db.query.chatMessageTable.findFirst({
				where: and(
					eq(schema.chatMessageTable.id, message.id),
					eq(schema.chatMessageTable.conversationId, conversationId),
					eq(schema.chatMessageTable.userId, userId),
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

	syncEventManager.on<"createConversationBranch">(
		"createConversationBranch",
		async (eventData) => {
			const { branchId, sourceId, messageIndex, messageIds, userId } =
				eventData;
			if (!userId) {
				console.error("No user id found");
				return;
			}
			console.log("[DB] Processing createConversationBranch event:", {
				branchId,
				sourceId,
				messageIndex,
				messageIds,
			});

			const originalConversation = await db.query.conversation.findFirst({
				where: and(
					eq(schema.conversation.id, sourceId),
					eq(schema.conversation.userId, userId),
				),
			});

			const messages = await db.query.chatMessageTable.findMany({
				where: and(
					eq(schema.chatMessageTable.conversationId, sourceId),
					eq(schema.chatMessageTable.userId, userId),
				),
				orderBy: asc(schema.chatMessageTable.createdAt),
			});

			if (originalConversation) {
				// Create the new branch conversation
				await db.insert(schema.conversation).values({
					id: branchId,
					userId,
					data: {
						...originalConversation.data,
						id: branchId,
						branch: true,
						branchOf: sourceId,
					},
				});

				// Copy messages up to the specified index
				const messagesToCopy = messages.slice(0, messageIndex + 1);
				for (const message of messagesToCopy) {
					const newMessageId =
						messageIds?.[messagesToCopy.indexOf(message)] ||
						crypto.randomUUID();
					await db.insert(schema.chatMessageTable).values({
						id: newMessageId,
						userId,
						conversationId: branchId,
						data: {
							...message.data,
							id: newMessageId,
							conversationId: branchId,
						},
					});
				}
				console.log("[DB] Conversation branch created:", branchId);
			}
		},
	);

	syncEventManager.on<"updateConversation">(
		"updateConversation",
		async (eventData) => {
			const { conversationId, data, userId } = eventData;
			if (!userId) {
				console.error("No user id found");
				return;
			}
			console.log("[DB] Updating conversation:", conversationId);
			try {
				const existingConversation = await db.query.conversation.findFirst({
					where: and(
						eq(schema.conversation.id, conversationId),
						eq(schema.conversation.userId, userId),
					),
				});

				if (existingConversation) {
					const updatedConversation = { ...existingConversation.data, ...data };
					await db
						.update(schema.conversation)
						.set({ data: updatedConversation })
						.where(eq(schema.conversation.id, conversationId));
					console.log("[DB] Conversation updated:", conversationId);
				}
			} catch (error) {
				console.error("Error updating conversation:", error);
			}
		},
	);

	syncEventManager.on<"clearMessages">("clearMessages", async (eventData) => {
		const { conversationId, messageIndex, userId } = eventData;
		if (!userId) {
			console.error("No user id found");
			return;
		}
		console.log("[DB] Clearing messages after index:", messageIndex);
		try {
			// Get all messages for the conversation
			const messages = await db.query.chatMessageTable.findMany({
				where: and(
					eq(schema.chatMessageTable.conversationId, conversationId),
					eq(schema.chatMessageTable.userId, userId),
				),
				orderBy: asc(schema.chatMessageTable.createdAt),
			});

			// Delete messages after the specified index
			const messagesToDelete = messages.slice(messageIndex + 1);
			for (const message of messagesToDelete) {
				await db
					.delete(schema.chatMessageTable)
					.where(eq(schema.chatMessageTable.id, message.id));
			}
			console.log("[DB] Messages cleared after index:", messageIndex);
		} catch (error) {
			console.error("Error clearing messages:", error);
		}
	});

	// syncEventManager.on<"giveData">("giveData", async (eventData) => {
	//   const { userId } = eventData;
	//   if (!userId) {
	//     console.error("No user id found")
	//     return
	//   }
	//   const conversations = await db.query.conversation.findMany({
	//     where: eq(schema.conversation.userId, userId),
	//   })
	//   const messages = await db.query.chatMessageTable.findMany({
	//     where: eq(schema.chatMessageTable.userId, userId),
	//   })
	//   syncEventManager.emit<"takeData">({
	//     type: "takeData",
	//     data: {
	//       conversations: conversations.map((c) => c.data),
	//       messages: messages.map((m) => m.data),
	//     },
	//   })
	// })
}
