import type { ChatMessage } from "l1-db";
import type {
  SyncEvent,
  CreateConversationBranchEvent,
  UpdateMessageEvent,
  SyncEventManager,
} from "./sync-events";

const unravel_batch_events = (events: SyncEvent[]) => {
  const unraveledEvents: SyncEvent[] = [];
  for (const event of events) {
    if (event.type === "eventsBatch") {
      unraveledEvents.push(...event.events);
    } else {
      unraveledEvents.push(event);
    }
  }
  return unraveledEvents;
};

export const resolveConflicts = (
  pendingClientEvents: SyncEvent[],
  pendingServerEvents: SyncEvent[] = []
) => {
  const clientEvents = unravel_batch_events(pendingClientEvents);
  const serverEvents = unravel_batch_events(pendingServerEvents);

  const DEBUG = false;
  const serverTransportId = serverEvents[0]?.transportId || "server";
  const clientTransportId = clientEvents[0]?.transportId || "client";
  const sendToServerEvents: SyncEvent[] = [];

  const sendToClientEvents: SyncEvent[] = [];

  const getSendQueue = (transportId: string) => {
    return transportId === serverTransportId
      ? sendToClientEvents
      : sendToServerEvents;
  };

  const getSearchQueue = (transportId: string) => {
    return transportId === serverTransportId
      ? sendToServerEvents
      : sendToClientEvents;
  };

  const conversationAddMessagesIndexes: Record<string, number> = {};

  const messageIdxRemap: Map<
    string,
    {
      branchId: string;
      messageId: string;
    }
  > = new Map();

  const getMessageIdxRemapKey = (
    transportId: string,
    conversationId: string,
    messageIndex: number
  ) => {
    return `${transportId}:${conversationId}:${messageIndex}`;
  };

  const events = [...serverEvents, ...clientEvents].filter(
    (e) => e.transportId !== undefined
  ) as (SyncEvent & { transportId: string })[];

  for (const event of events.sort((a, b) => a.timestamp - b.timestamp)) {
    console.log("[Conflic Resolution] Processing event", event);

    switch (event.type) {
      case "updateMessageStream":
      case "updateMessageStreamWithSources":
      case "updateMessage": {
        const { messageId, messageIndex, conversationId } = event;

        const messageIdxRemapEntry = messageIdxRemap.get(
          getMessageIdxRemapKey(event.transportId, conversationId, messageIndex)
        );

        if (DEBUG) {
          console.log(
            "==== MessageIdxRemap ==== ",
            messageIdxRemap,
            messageIdxRemapEntry,
            getMessageIdxRemapKey(
              event.transportId,
              conversationId,
              messageIndex
            )
          );
        }

        let trueConversationId = conversationId;
        let trueMessageId = messageId;
        if (messageIdxRemapEntry) {
          trueConversationId = messageIdxRemapEntry.branchId;
          trueMessageId = messageIdxRemapEntry.messageId;
        }

        const existingEvent = getSearchQueue(event.transportId)
          .filter((e) => e.type === "updateMessage")
          .find((e) => e.messageId === messageId);

        let newMessageDetails: Partial<ChatMessage> =
          existingEvent?.message || {};

        switch (event.type) {
          case "updateMessageStream":
            newMessageDetails = {
              ...newMessageDetails,
              parts: [...(newMessageDetails.parts || []), event.part],
            };
            break;
          case "updateMessageStreamWithSources":
            newMessageDetails = {
              ...newMessageDetails,
              sources: [...(newMessageDetails.sources || []), event.source],
            };
            break;
          case "updateMessage":
            if (event.type === "updateMessage") {
              newMessageDetails = {
                ...newMessageDetails,
                ...event.message,
              };
            }
            break;
        }

        newMessageDetails.conversationId = trueConversationId;
        newMessageDetails.id = trueMessageId;

        if (existingEvent?.messageId === messageId) {
          existingEvent.message = {
            ...existingEvent.message,
            ...newMessageDetails,
          };
          existingEvent.timestamp = event.timestamp;
        } else {
          getSendQueue(event.transportId).push({
            transportId: event.transportId,
            type: "updateMessage",
            conversationId: trueMessageId,
            messageId: trueMessageId,
            messageIndex,
            timestamp: event.timestamp,
            message: newMessageDetails as ChatMessage,
          });
        }
        break;
      }
      case "addMessage": {
        const { messageIndex, conversationId, message, transportId } = event;

        let messageDetails = message;

        let trueConversationId = conversationId;

        const messageIdxRemapEntry = messageIdxRemap.get(
          getMessageIdxRemapKey(transportId, conversationId, messageIndex)
        );

        if (messageIdxRemapEntry) {
          trueConversationId = messageIdxRemapEntry.branchId;
        }

        const previousConversationMessgeIndex =
          conversationAddMessagesIndexes[trueConversationId];

        if (previousConversationMessgeIndex) {
          if (previousConversationMessgeIndex + 1 == messageIndex) {
            conversationAddMessagesIndexes[trueConversationId] = messageIndex;
          } else {
            if (DEBUG) {
              console.log(
                "[Conflic Resolution] Conflict detected. Message index is not sequential. Previous index:",
                previousConversationMessgeIndex,
                "Current index:",
                messageIndex,
                "transportId",
                transportId
              );
            }

            const branchEvent = getSendQueue(transportId).find(
              (e) =>
                e.type === "createConversationBranch" &&
                e.sourceId === trueConversationId
            ) as CreateConversationBranchEvent | undefined;

            const branchId = branchEvent?.branchId;

            if (!branchId) {
              trueConversationId = crypto.randomUUID();
              const remappedMessageIds = new Array(messageIndex)
                .fill("")
                .map(() => crypto.randomUUID());

              for (const [idx, id] of remappedMessageIds.entries()) {
                messageIdxRemap.set(
                  getMessageIdxRemapKey(transportId, conversationId, idx),
                  {
                    branchId: trueConversationId,
                    messageId: id,
                  }
                );
              }

              const createBranchEvent: SyncEvent = {
                transportId: transportId,
                type: "createConversationBranch",
                branchId: trueConversationId,
                sourceId: conversationId,
                messageIndex: messageIndex - 1,
                timestamp: event.timestamp,
                messageIds: remappedMessageIds,
              };

              sendToServerEvents.unshift(createBranchEvent);
              sendToClientEvents.unshift(createBranchEvent);
            }

            const newMessageId = crypto.randomUUID();

            messageIdxRemap.set(
              getMessageIdxRemapKey(transportId, conversationId, messageIndex),
              {
                branchId: trueConversationId,
                messageId: newMessageId,
              }
            );
            messageDetails = {
              ...messageDetails,
              id: newMessageId,
              conversationId: trueConversationId,
            };

            conversationAddMessagesIndexes[trueConversationId] = messageIndex;
          }
        } else {
          conversationAddMessagesIndexes[conversationId] = messageIndex;
        }

        getSendQueue(transportId).push({
          transportId: transportId,
          type: "addMessage",
          conversationId: trueConversationId,
          messageIndex,
          message: messageDetails,
          timestamp: event.timestamp,
        });
        break;
      }
      default:
        if (event.transportId === serverTransportId) {
          sendToClientEvents.push(event);
        } else {
          sendToServerEvents.push(event);
        }
    }
  }
  return { sendToServerEvents, sendToClientEvents };
};
