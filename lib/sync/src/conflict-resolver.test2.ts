import { resolveConflicts } from "./conflict-resolver";
import type { ChatMessage, Source } from "l1-db";
import type { SyncEvent } from "./sync-events";

// Helper type for test messages
type TestMessage = {
  id: string;
  conversationId: string;
  message: string;
  disabled?: boolean;
  createdAt: string;
  updatedAt: string;
  meta_tokens: number;
  role: "assistant" | "user";
  meta_model?: string;
  meta_provider?: string;
  reasoning?: string;
  sources?: Source[];
  parts?: string[];
  status?: "submitted" | "reasoning" | "generating" | "done" | "errored" | "stopped";
  error?: string;
};

describe("Conflict Resolver", () => {
  const createTestMessage = (id: string, content: string): TestMessage => ({
    id,
    conversationId: "conv1",
    message: content,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    meta_tokens: 0,
    role: "user",
  });

  const createTestSource = (url: string, title: string): Source => ({
    id: crypto.randomUUID(),
    sourceType: "web",
    url,
    title,
  });

  it("should handle sequential message additions without conflicts", () => {
    const events: SyncEvent[] = [
      {
        type: "addMessage",
        conversationId: "conv1",
        messageIndex: 0,
        message: createTestMessage("msg1", "Hello"),
        timestamp: 1000,
      },
      {
        type: "addMessage",
        conversationId: "conv1",
        messageIndex: 1,
        message: createTestMessage("msg2", "World"),
        timestamp: 2000,
      },
    ];

    console.log("\nTest: Sequential message additions");
    console.log("Input events:", events);

    const [resolvedEvents, resolvedClientEvents] = resolveConflicts(events);

    console.log("Output resolved events:", resolvedEvents);
    console.log("Output client events:", resolvedClientEvents);

    expect(resolvedEvents).toHaveLength(2);
    expect(resolvedClientEvents).toHaveLength(0);
    expect(resolvedEvents[0]?.type).toBe("addMessage");
    expect(resolvedEvents[1]?.type).toBe("addMessage");
  });

  it("should handle message updates correctly", () => {
    const events: SyncEvent[] = [
      {
        type: "addMessage",
        conversationId: "conv1",
        messageIndex: 0,
        message: createTestMessage("msg1", "Hello"),
        timestamp: 1000,
      },
      {
        type: "updateMessage",
        conversationId: "conv1",
        messageId: "msg1",
        messageIndex: 0,
        message: { ...createTestMessage("msg1", "Hello World"), message: "Hello World" },
        timestamp: 2000,
      },
    ];

    console.log("\nTest: Message updates");
    console.log("Input events:", events);

    const [resolvedEvents, resolvedClientEvents] = resolveConflicts(events);

    console.log("Output resolved events:", resolvedEvents);
    console.log("Output client events:", resolvedClientEvents);

    expect(resolvedEvents).toHaveLength(2);
    const updateEvent = resolvedEvents[1];
    if (updateEvent?.type === "updateMessage") {
      expect(updateEvent.message.message).toBe("Hello World");
    } else {
      fail("Expected updateMessage event");
    }
  });

  it("should handle message stream updates", () => {
    const events: SyncEvent[] = [
      {
        type: "addMessage",
        conversationId: "conv1",
        messageIndex: 0,
        message: createTestMessage("msg1", ""),
        timestamp: 1000,
      },
      {
        type: "updateMessageStream",
        conversationId: "conv1",
        messageId: "msg1",
        messageIndex: 0,
        part: "Hello",
        timestamp: 2000,
      },
      {
        type: "updateMessageStream",
        conversationId: "conv1",
        messageId: "msg1",
        messageIndex: 0,
        part: " World",
        timestamp: 3000,
      },
    ];

    console.log("\nTest: Message stream updates");
    console.log("Input events:", events);

    const [resolvedEvents, resolvedClientEvents] = resolveConflicts(events);

    console.log("Output resolved events:", resolvedEvents);
    console.log("Output client events:", resolvedClientEvents);

    // Should have 2 events: addMessage and a single updateMessage that combines all stream updates
    expect(resolvedEvents).toHaveLength(2);
    
    // First event should be the addMessage
    expect(resolvedEvents[0]?.type).toBe("addMessage");
    
    // Second event should be the combined updateMessage
    const updateEvent = resolvedEvents[1];
    if (updateEvent?.type === "updateMessage") {
      // Verify that all parts are present in the correct order
      expect(updateEvent.message.parts).toEqual(["Hello", " World"]);
    } else {
      fail("Expected updateMessage event");
    }
  });

  it("should create a branch when non-sequential message indices are detected", () => {
    const events: SyncEvent[] = [
      {
        type: "addMessage",
        conversationId: "conv1",
        messageIndex: 2,
        message: createTestMessage("msg1", "Second"),
        timestamp: 1000,
      },
      {
        type: "addMessage",
        conversationId: "conv1",
        messageIndex: 1,
        message: createTestMessage("msg2", "First"),
        timestamp: 2000,
      },
    ];

    console.log("\nTest: Non-sequential message indices");
    console.log("Input events:", events);

    const [resolvedEvents, resolvedClientEvents] = resolveConflicts(events);

    console.log("Output resolved events:", resolvedEvents);
    console.log("Output client events:", resolvedClientEvents);

    expect(resolvedEvents).toHaveLength(3); // Original messages + branch creation
    expect(resolvedClientEvents).toHaveLength(1); // Branch creation event
    expect(resolvedEvents[1]?.type).toBe("createConversationBranch");
  });

  it("should handle message stream with sources", () => {
    const events: SyncEvent[] = [
      {
        type: "addMessage",
        conversationId: "conv1",
        messageIndex: 0,
        message: createTestMessage("msg1", ""),
        timestamp: 1000,
      },
      {
        type: "updateMessageStreamWithSources",
        conversationId: "conv1",
        messageId: "msg1",
        messageIndex: 0,
        source: createTestSource("https://example.com", "Example"),
        timestamp: 2000,
      },
    ];

    console.log("\nTest: Message stream with sources");
    console.log("Input events:", events);

    const [resolvedEvents, resolvedClientEvents] = resolveConflicts(events);

    console.log("Output resolved events:", resolvedEvents);
    console.log("Output client events:", resolvedClientEvents);

    expect(resolvedEvents).toHaveLength(2);
    const updateEvent = resolvedEvents[1];
    if (updateEvent?.type === "updateMessage") {
      expect(updateEvent.message.sources).toHaveLength(1);
      expect(updateEvent.message.sources?.[0].url).toBe("https://example.com");
    } else {
      fail("Expected updateMessage event");
    }
  });

//   it("should handle events in correct timestamp order", () => {
//     const events: SyncEvent[] = [
//       {
//         type: "addMessage",
//         conversationId: "conv1",
//         messageIndex: 0,
//         message: createTestMessage("msg1", "First"),
//         timestamp: 2000,
//       },
//       {
//         type: "addMessage",
//         conversationId: "conv1",
//         messageIndex: 1,
//         message: createTestMessage("msg2", "Second"),
//         timestamp: 1000,
//       },
//     ];

//     console.log("\nTest: Timestamp ordering");
//     console.log("Input events:", events);

//     const [resolvedEvents, resolvedClientEvents] = resolveConflicts(events);

//     console.log("Output resolved events:", resolvedEvents);
//     console.log("Output client events:", resolvedClientEvents);

//     expect(resolvedEvents).toHaveLength(2);
//     expect(resolvedEvents[0]?.timestamp).toBe(1000);
//     expect(resolvedEvents[1]?.timestamp).toBe(2000);
//   });

  it("should combine multiple update events for the same message into a single updateMessage event", () => {
    const messageId = "msg1";
    const events: SyncEvent[] = [
      {
        type: "addMessage",
        conversationId: "conv1",
        messageIndex: 0,
        message: createTestMessage(messageId, "Initial"),
        timestamp: 1000,
        transportId: "client1",
      },
      {
        type: "updateMessageStream",
        conversationId: "conv1",
        messageId: messageId,
        messageIndex: 0,
        part: "Stream part 1",
        timestamp: 2000,
        transportId: "client1",
      },
      {
        type: "updateMessageStreamWithSources",
        conversationId: "conv1",
        messageId: messageId,
        messageIndex: 0,
        source: createTestSource("https://example.com", "Example Source"),
        timestamp: 3000,
        transportId: "client1",
      },
      {
        type: "updateMessage",
        conversationId: "conv1",
        messageId: messageId,
        messageIndex: 0,
        message: { ...createTestMessage(messageId, "Updated content"), message: "Updated content" },
        timestamp: 4000,
        transportId: "client1",
      },
    ];

    console.log("\nTest: Multiple update events combination");
    console.log("Input events:", events);

    const [resolvedEvents, resolvedClientEvents] = resolveConflicts(events);

    console.log("Output resolved events:", resolvedEvents);
    console.log("Output client events:", resolvedClientEvents);

    // Should have 2 events: addMessage and a single updateMessage that combines all updates
    expect(resolvedEvents).toHaveLength(2);
    
    // First event should be the addMessage
    expect(resolvedEvents[0]?.type).toBe("addMessage");
    
    // Second event should be the combined updateMessage
    const updateEvent = resolvedEvents[1];
    if (updateEvent?.type === "updateMessage") {
      // Verify that all parts are present
      expect(updateEvent.message.parts).toEqual(["Stream part 1"]);
      
      // Verify that the source was added
      expect(updateEvent.message.sources).toHaveLength(1);
      expect(updateEvent.message.sources?.[0].url).toBe("https://example.com");
      
      // Verify that the message content was updated
      expect(updateEvent.message.message).toBe("Updated content");
    } else {
      fail("Expected updateMessage event");
    }
  });

  it("should create a branch when non-sequential message indices are detected and handle message remapping", () => {
    const events: SyncEvent[] = [
      {
        type: "addMessage",
        conversationId: "conv1",
        messageIndex: 2,
        message: createTestMessage("msg1", "Second message"),
        timestamp: 1000,
        transportId: "client1",
      },
      {
        type: "addMessage",
        conversationId: "conv1",
        messageIndex: 1,
        message: createTestMessage("msg2", "First message"),
        timestamp: 2000,
        transportId: "client1",
      },
    ];

    console.log("\nTest: Branch creation and message remapping");
    console.log("Input events:", events);

    const [resolvedEvents, resolvedClientEvents] = resolveConflicts(events);

    console.log("Output resolved events:", resolvedEvents);
    console.log("Output client events:", resolvedClientEvents);

    // Should have 3 events: first message, branch creation, second message
    expect(resolvedEvents).toHaveLength(3);
    expect(resolvedClientEvents).toHaveLength(1);

    // First event should be the first addMessage
    expect(resolvedEvents[0]?.type).toBe("addMessage");
    expect(resolvedEvents[0]?.messageIndex).toBe(2);

    // Second event should be the branch creation
    const branchEvent = resolvedEvents[1];
    if (branchEvent?.type === "createConversationBranch") {
      expect(branchEvent.sourceId).toBe("conv1");
      expect(branchEvent.messageIndex).toBe(1);
      expect(branchEvent.branchId).toBeDefined();
      
      // Verify that the client received the branch event
      expect(resolvedClientEvents[0]?.type).toBe("createConversationBranch");
      expect(resolvedClientEvents[0]?.sourceId).toBe("conv1");
      expect(resolvedClientEvents[0]?.branchId).toBe(branchEvent.branchId);
    } else {
      fail("Expected createConversationBranch event");
    }

    // Third event should be the second message with updated conversationId
    const secondMessage = resolvedEvents[2];
    if (secondMessage?.type === "addMessage") {
      expect(secondMessage.messageIndex).toBe(1);
      expect(secondMessage.conversationId).toBe(branchEvent?.branchId);
    } else {
      fail("Expected addMessage event");
    }
  });

  it("should handle message updates after branch creation with correct IDs", () => {
    const events: SyncEvent[] = [
      {
        type: "addMessage",
        conversationId: "conv1",
        messageIndex: 2,
        message: createTestMessage("msg1", "First message"),
        timestamp: 1000,
        transportId: "client1",
      },
      {
        type: "addMessage",
        conversationId: "conv1",
        messageIndex: 1,
        message: createTestMessage("msg2", "Second message"),
        timestamp: 2000,
        transportId: "client1",
      },
      {
        type: "updateMessage",
        conversationId: "conv1",
        messageId: "msg2",
        messageIndex: 1,
        message: { ...createTestMessage("msg2", "Updated second message"), message: "Updated second message" },
        timestamp: 3000,
        transportId: "client1",
      },
    ];

    console.log("\nTest: Message updates after branch creation");
    console.log("Input events:", events);

    const [resolvedEvents, resolvedClientEvents] = resolveConflicts(events);

    console.log("Output resolved events:", resolvedEvents);
    console.log("Output client events:", resolvedClientEvents);

    // Should have 4 events: first message, branch creation, second message, update
    expect(resolvedEvents).toHaveLength(4);
    expect(resolvedClientEvents).toHaveLength(1);

    // First event should be the first addMessage
    expect(resolvedEvents[0]?.type).toBe("addMessage");
    expect(resolvedEvents[0]?.messageIndex).toBe(2);

    // Second event should be the branch creation
    const branchEvent = resolvedEvents[1];
    if (branchEvent?.type === "createConversationBranch") {
      expect(branchEvent.sourceId).toBe("conv1");
      expect(branchEvent.messageIndex).toBe(1);
      expect(branchEvent.branchId).toBeDefined();
      
      // Verify that the client received the branch event
      expect(resolvedClientEvents[0]?.type).toBe("createConversationBranch");
      expect(resolvedClientEvents[0]?.sourceId).toBe("conv1");
      expect(resolvedClientEvents[0]?.branchId).toBe(branchEvent.branchId);

      // Third event should be the second message with updated conversationId
      const secondMessage = resolvedEvents[2];
      if (secondMessage?.type === "addMessage") {
        expect(secondMessage.messageIndex).toBe(1);
        expect(secondMessage.conversationId).toBe(branchEvent.branchId);

        // Fourth event should be the update with correct IDs
        const updateEvent = resolvedEvents[3];
        if (updateEvent?.type === "updateMessage") {
          // Verify that the update event has the correct conversationId (branch ID)
          expect(updateEvent.conversationId).toBe(branchEvent.branchId);
          // Verify that the message content was updated
          expect(updateEvent.message.message).toBe("Updated second message");
        } else {
          fail("Expected updateMessage event");
        }
      } else {
        fail("Expected addMessage event");
      }
    } else {
      fail("Expected createConversationBranch event");
    }
  });
}); 
