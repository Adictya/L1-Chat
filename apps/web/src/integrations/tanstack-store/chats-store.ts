import type { PGliteWorker } from "@electric-sql/pglite/worker";
import { Derived, Store } from "@tanstack/store";
import { asc, eq } from "drizzle-orm";
import db, {
	conversation,
	type ConversationEntry,
	type Conversation,
	chatMessageTable,
	type MessageEntry,
	type ChatMessage,
	type Source,
} from "l1-db";
import { useStore } from "@tanstack/react-store";
import { useMemo } from "react";

type SyncEventType =
	| "populateConversations"
	| "createConversation"
	| "addMessage"
	| "updateMessage"
	| "updateMessageStream"
	| "updateMessageStreamWithSources";

interface BaseSyncEvent {
	type: SyncEventType;
	timestamp: number;
}

interface PopulateConversationsEvent extends BaseSyncEvent {
	type: "populateConversations";
	pg: PGliteWorker;
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

interface UpdateMessageStreamWithSourcesEvent extends BaseSyncEvent {
	type: "updateMessageStreamWithSources";
	messageIndex: number;
	conversationId: string;
	source: Source;
}
type SyncEvent =
	| PopulateConversationsEvent
	| CreateConversationEvent
	| AddMessageEvent
	| UpdateMessageEvent
	| UpdateMessageStreamEvent
	| UpdateMessageStreamWithSourcesEvent;

const syncChannel = new BroadcastChannel("l1-chat-sync-events");

function broadcastEvent<T extends SyncEventType>(
	event: Omit<Extract<SyncEvent, { type: T }>, "timestamp">,
) {
	console.log("[Broadcast] Sending event:", {
		type: event.type,
		params: event,
		timestamp: Date.now(),
	});
	syncChannel.postMessage({
		...event,
		timestamp: Date.now(),
	});
}

export type ConversationStore = Store<Conversation>;

export const conversationMapStore = new Store<
	Record<Conversation["id"], ConversationStore>
>({});

export const conversationsListStore = new Derived<ConversationStore[]>({
	fn: () => {
		console.log("Conversation list store changed", conversationMapStore.state);
		return Object.values(conversationMapStore.state);
	},
	deps: [conversationMapStore],
});
conversationsListStore.mount();

export type ChatMessageStore = Store<ChatMessage>;

export type ChatMessageListStore = Store<ChatMessageStore[]>;

export const chatsStore = new Store<
	Record<Conversation["id"], ChatMessageListStore>
>({});

export const chatsListStore = new Derived({
	fn: () => Object.values(chatsStore.state),
	deps: [chatsStore],
});

chatsListStore.mount();

export async function PopulateConversations(pg: PGliteWorker) {
	const query = db
		.select()
		.from(conversation)
		.orderBy(asc(conversation.createdAt))
		.toSQL();
	const dbRows = await pg.query<ConversationEntry>(query.sql, query.params);
	for (const row of dbRows.rows) {
		conversationMapStore.setState((prev) => ({
			...prev,
			[row.id]: new Store(row.data),
		}));
		const chatQuery = db
			.select()
			.from(chatMessageTable)
			.where(eq(chatMessageTable.conversationId, row.id))
			.orderBy(asc(chatMessageTable.createdAt))
			.toSQL();
		const chatDbRows = await pg.query<MessageEntry>(
			chatQuery.sql,
			chatQuery.params,
		);
		console.log("Chat db rows", chatDbRows.rows);

		chatsStore.setState((prev) => ({
			...prev,
			[row.id]: new Store(chatDbRows.rows.map((row) => new Store(row.data))),
		}));
	}
}

export function useSubscribeConversations() {
	return useStore(conversationsListStore);
}

export function useSubscribeConversationMessages(conversationId?: string) {
	const chatMessagesStore = useStore(chatsStore, (state) =>
		conversationId ? state[conversationId] : undefined,
	);
	const chatMessages = useStore(
		chatMessagesStore || new Store([] as ChatMessageStore[]),
	);

	const chatHistory = useMemo(() => {
		return chatMessages.map((message) => message.state);
	}, [chatMessages]);

	return [chatHistory, chatMessages] as const;
}

export function createConversation(title: string, noBroadcast?: boolean) {
	const conversationId = crypto.randomUUID();
	const newConversation: Conversation = {
		id: conversationId,
		title,
		branch: false,
		generating: false,
		meta: {
			tokens: 0,
			activeTokens: 0,
		},
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};

	conversationMapStore.setState((prev) => ({
		...prev,
		[conversationId]: new Store(newConversation),
	}));
	chatsStore.setState((prev) => ({
		...prev,
		[conversationId]: new Store([] as ChatMessageStore[]),
	}));

	if (!noBroadcast) {
		broadcastEvent<"createConversation">({
			type: "createConversation",
			conversation: newConversation,
		});
	}

	console.log(
		"Conversation created",
		conversationId,
		conversationMapStore.state,
	);

	return conversationId;
}

conversationMapStore.subscribe((state) => {
	console.log("Conversation map store changed", state);
});
conversationsListStore.subscribe((state) => {
	console.log("Conversation list store changed", state);
});

export function addMessage(
	conversationId: string,
	message: Omit<ChatMessage, "id">,
	noBroadcast?: boolean,
) {
	const id = crypto.randomUUID();
	const chatMessageListStore = chatsStore.state[conversationId];
	if (!chatMessageListStore) {
		console.log(chatsStore.state);
		throw new Error("Conversation not found");
	}

	const fullMessage: ChatMessage = { id, ...message };
	const messageStore = new Store<ChatMessage>(fullMessage);
	chatMessageListStore.setState((prev) => [...prev, messageStore]);

	if (!noBroadcast) {
		broadcastEvent<"addMessage">({
			type: "addMessage",
			conversationId,
			message: fullMessage,
		});
	}

	return [id, chatMessageListStore.state.length - 1] as const;
}

export function updateMessage(
	messageIndex: number,
	conversationId: string,
	message:
		| Partial<Omit<ChatMessage, "id" | "conversationId" | "role">>
		| ((prev: ChatMessage) => ChatMessage),
	noBroadcast?: boolean,
) {
	const existingMessage = chatsStore.state[conversationId]?.state[messageIndex];
	if (!existingMessage) {
		throw new Error("Message not found");
	}
	let newMessage: ChatMessage = existingMessage.state;
	existingMessage.setState((prev) => {
		newMessage =
			typeof message === "function"
				? message(prev)
				: {
						...prev,
						...message,
						id: prev.id,
						conversationId: prev.conversationId,
						role: prev.role,
					};
		return newMessage;
	});

	if (!noBroadcast) {
		broadcastEvent<"updateMessage">({
			type: "updateMessage",
			messageIndex,
			conversationId,
			message: newMessage,
		});
	}
}

export function updateMessageStream(
	messageIndex: number,
	conversationId: string,
	part: string,
	noBroadcast?: boolean,
) {
	const existingMessage = chatsStore.state[conversationId]?.state[messageIndex];

	if (!existingMessage) {
		throw new Error("Message not found");
	}

	existingMessage.setState((prev) =>
		prev.role === "assistant"
			? ({
					...prev,
					role: "assistant",
					parts: [...(prev.parts || []), part],
				} as ChatMessage)
			: prev,
	);

	if (!noBroadcast) {
		broadcastEvent<"updateMessageStream">({
			type: "updateMessageStream",
			messageIndex,
			conversationId,
			part,
		});
	}
}

export function updateMessageStreamWithSources(
	messageIndex: number,
	conversationId: string,
	source: Source,
	noBroadcast?: boolean,
) {
	const existingMessage = chatsStore.state[conversationId]?.state[messageIndex];

	if (!existingMessage) {
		throw new Error("Message not found");
	}

	existingMessage.setState((prev) =>
		prev.role === "assistant"
			? ({
					...prev,
					sources: [...(prev.sources || []), source],
				} as ChatMessage)
			: prev,
	);

	if (!noBroadcast) {
		broadcastEvent<"updateMessageStreamWithSources">({
			type: "updateMessageStreamWithSources",
			messageIndex,
			conversationId,
			source,
		});
	}
}

syncChannel.onmessage = (event: MessageEvent<SyncEvent>) => {
	const { type, ...params } = event.data;

	console.log("[Broadcast] Received event:", {
		type,
		params,
		timestamp: Date.now(),
	});

	switch (type) {
		case "createConversation": {
			const { conversation } = params as CreateConversationEvent;
			console.log("[Broadcast] Processing createConversation event:", {
				conversation,
			});
			conversationMapStore.setState((prev) => ({
				...prev,
				[conversation.id]: new Store(conversation),
			}));
			chatsStore.setState((prev) => ({
				...prev,
				[conversation.id]: new Store([] as ChatMessageStore[]),
			}));
			break;
		}
		case "addMessage": {
			const { conversationId, message } = params as AddMessageEvent;
			console.log("[Broadcast] Processing addMessage event:", {
				conversationId,
				message,
			});
			const chatMessageListStore = chatsStore.state[conversationId];
			if (!chatMessageListStore) {
				console.error("Conversation not found for message:", message);
				break;
			}
			const messageStore = new Store<ChatMessage>(message);
			chatMessageListStore.setState((prev) => [...prev, messageStore]);
			break;
		}
		case "updateMessage": {
			const { messageIndex, conversationId, message } =
				params as UpdateMessageEvent;
			console.log("[Broadcast] Processing updateMessage event:", {
				messageIndex,
				conversationId,
				message,
			});
			updateMessage(messageIndex, conversationId, message, true);
			break;
		}
		case "updateMessageStream": {
			const { messageIndex, conversationId, part } =
				params as UpdateMessageStreamEvent;
			console.log("[Broadcast] Processing updateMessageStream event:", {
				messageIndex,
				conversationId,
				part,
			});
			updateMessageStream(messageIndex, conversationId, part, true);
			break;
		}
		case "updateMessageStreamWithSources": {
			const { messageIndex, conversationId, source } =
				params as UpdateMessageStreamWithSourcesEvent;
			console.log(
				"[Broadcast] Processing updateMessageStreamWithSources event:",
				{ messageIndex, conversationId, source },
			);
			updateMessageStreamWithSources(
				messageIndex,
				conversationId,
				source,
				true,
			);
			break;
		}
	}
};
