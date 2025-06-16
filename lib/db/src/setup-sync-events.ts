
import * as schema from "./schema";
import type { ChatMessage } from "./schema";
import { and, eq } from "drizzle-orm";
import type { DB } from "./db";
import type { SyncEventManager } from "l1-sync";

export function setupSyncEvents(syncEventManager: SyncEventManager, db: DB) {
  syncEventManager.on<"createConversation">(
    "createConversation",
    async (eventData) => {
      const { conversation, userId } = eventData;
      if (!userId) {
        console.error("No user id found")
        return
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
    }
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
      console.error("No user id found")
      return
    }
    console.log("[DB] Updating message:", message);
    try {
      const existingMessage = await db.query.chatMessageTable.findFirst({
        where: and(
          eq(schema.chatMessageTable.id, message.id),
          eq(schema.chatMessageTable.conversationId, conversationId),
          eq(schema.chatMessageTable.userId, userId)
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
