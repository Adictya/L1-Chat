import { resolveConflicts } from "./conflict-resolver";
import type { ChatMessage, Source } from "l1-db";
import type {
  AddMessageEvent,
  BaseSyncEvent,
  SyncEvent,
  UpdateMessageEvent,
  UpdateMessageStreamEvent,
  UpdateMessageStreamWithSourcesEvent,
} from "./sync-events";

describe("Conflict Resolver Advanced", () => {
  const serverTransportId = "server";
  const clientTransportId = "client";

  let clock = Date.now();

  const createBaseEvent = <T extends BaseSyncEvent["type"]>(
    type: T,
    transportId: string
  ): BaseSyncEvent & { type: T } => ({
    type,
    timestamp: clock++,
    transportId,
  });

  const createBaseMessage = (
    id: string,
    conversationId: string
  ): ChatMessage => ({
    id,
    conversationId,
    message: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    meta_tokens: 0,
    role: "user",
  });

  const createAddMessageEvent = (
    id: string,
    conversationId: string,
    index: number,
    transportId: string
  ): AddMessageEvent => ({
    ...createBaseEvent("addMessage", transportId),
    message: createBaseMessage(id, conversationId),
    messageIndex: index,
    conversationId,
  });

  const createUpdateMessageEvent = (
    id: string,
    conversationId: string,
    index: number,
    transportId: string,
    edits: Partial<ChatMessage>
  ): UpdateMessageEvent => {
    const message = createBaseMessage(id, conversationId);
    return {
      ...createBaseEvent("updateMessage", transportId),
      message: { ...message, ...edits },
      messageIndex: index,
      messageId: id,
      conversationId,
    };
  };

  const createUpdateMessageStreamEvent = (
    id: string,
    conversationId: string,
    index: number,
    transportId: string,
    part: string
  ): UpdateMessageStreamEvent => {
    return {
      ...createBaseEvent("updateMessageStream", transportId),
      conversationId,
      messageId: id,
      messageIndex: index,
      part,
    };
  };

  const createSource = (id: string, title: string, url: string): Source => ({
    id: crypto.randomUUID(),
    title,
    url,
    sourceType: "url",
  });

  const createUpdateSourceEvent = (
    id: string,
    conversationId: string,
    index: number,
    transportId: string,
    source: Source
  ): UpdateMessageStreamWithSourcesEvent => {
    return {
      ...createBaseEvent("updateMessageStreamWithSources", transportId),
      conversationId,
      messageId: id,
      messageIndex: index,
      source,
    };
  };

  const createQueues = () => {
    const clientEvents: SyncEvent[] = [];
    const serverEvents: SyncEvent[] = [];

    const cp = (event: SyncEvent) => {
      clientEvents.push(event);
    };

    const sp = (event: SyncEvent) => {
      serverEvents.push(event);
    };

    return { clientEvents, serverEvents, cp, sp };
  };

  it("should combine multiple updateMessage events for the same message into a single updateMessage event", () => {
    const { clientEvents, serverEvents, cp, sp } = createQueues();

    cp(createUpdateMessageStreamEvent("msg1", "conv1", 1, clientTransportId, "part1"));
    cp(createUpdateMessageStreamEvent("msg1", "conv1", 1, clientTransportId, "part2"));

    sp(createUpdateMessageStreamEvent("msg2", "conv1", 1, serverTransportId, "part1"));
    sp(createUpdateMessageStreamEvent("msg2", "conv1", 1, serverTransportId, "part2"));

    const [resolvedEvents, resolvedClientEvents] = resolveConflicts(
      clientEvents,
      serverEvents
    );
    console.log("Client events:", clientEvents);
    console.log("Server events:", serverEvents);
    console.log("Resolved events:", resolvedEvents);
    console.log("Resolved client events:", resolvedClientEvents);

    expect(resolvedEvents).toHaveLength(1);
  });

  it("should resolve conflicts between addMessage and updateMessage events", () => {
    const { clientEvents, serverEvents, cp, sp } = createQueues();

    cp(createAddMessageEvent("msg1", "conv1", 1, clientTransportId));

    sp(createAddMessageEvent("msg1", "conv1", 1, serverTransportId));

    cp(
      createUpdateMessageEvent("msg1", "conv1", 1, clientTransportId, {
        message: "Hello",
      })
    );

    console.log("Client events:", clientEvents);
    console.log("Server events:", serverEvents);

    const [resolvedEvents, resolvedClientEvents] = resolveConflicts(
      clientEvents,
      serverEvents
    );

    console.log("Send to server events:", resolvedEvents);
    console.log("Send to client events:", resolvedClientEvents);

    expect(resolvedEvents).toHaveLength(1);
  });
});
