import type { PGliteWorker } from "@electric-sql/pglite/worker";
import { Derived, Effect, Store } from "@tanstack/store";
import { asc, eq } from "drizzle-orm";
import db, {
	conversation,
	type ConversationEntry,
	type Conversation, // Keep this for Store typing
	chatMessageTable,
	type MessageEntry,
	type ChatMessage, // Keep this for Store typing
	type Source, // Keep this for Store typing
} from "l1-db";
import { useStore } from "@tanstack/react-store";
import { useMemo } from "react";
import { SyncEventManager, BroadcastChannelTransport } from "l1-sync";
import {
	ClientWebSocketTransport,
	SimpleWebSocketTransport,
} from "l1-sync/src/transports/websocket";
import authStore, { getTokens } from "./auth-store";

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
	fn: () => {
		console.log("Chats list store changed", chatsStore.state);
		return Object.values(chatsStore.state);
	},
	deps: [chatsStore],
});

chatsListStore.mount();

// Initialize SyncEventManager
const syncEventManager = new SyncEventManager();

// const ws = new WebSocket("ws://localhost:3000/chat");
// const wsTransport = new ClientWebSocketTransport("ws-transport", ws, getTokens());
// syncEventManager.addTransport(wsTransport);

export const webSocketTransport = new SimpleWebSocketTransport(
	"ws-transport",
	"ws://localhost:3000",
);
syncEventManager.addTransport(webSocketTransport);
if (authStore.state.access_token) {
	console.log("Token updated", authStore.state.access_token);
	webSocketTransport.close();
	webSocketTransport.connect(authStore.state.access_token);
}
authStore.subscribe(({ currentVal }) => {
	if (currentVal.access_token) {
		console.log("Token updated", currentVal);
		webSocketTransport.close();
		webSocketTransport.connect(currentVal.access_token);
	}
});

// const broadcastChannelTransport = new BroadcastChannelTransport(
// 	"local-tab-sync",
// 	"l1-chat-sync-events",
// );
// syncEventManager.addTransport(broadcastChannelTransport);

export async function PopulateConversations(pg: PGliteWorker) {
	console.log("Populating conversations");
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
	console.log("Chat Messages Store", chatsStore);
	const chatMessages = useStore(
		chatMessagesStore || new Store([] as ChatMessageStore[]),
	);

	console.log("Chat Messages", chatMessages);

	const chatHistory = useMemo(() => {
		return chatMessages.map((message) => message.state);
	}, [chatMessages]);

	return [chatHistory, chatMessages] as const;
}

export function createConversationDirect(conversation: Conversation) {
	console.log("Creating conversation", conversation);
	conversationMapStore.setState((prev) => ({
		...prev,
		[conversation.id]: new Store(conversation),
	}));
	chatsStore.setState((prev) => ({
		...prev,
		[conversation.id]: new Store([] as ChatMessageStore[]),
	}));
}

export function createConversation(title: string, noBroadcast?: boolean) {
	const conversationId = crypto.randomUUID();
	const newConversation: Conversation = {
		id: conversationId,
		title,
		branch: false,
		branchOf: undefined,
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
		syncEventManager.emit<"createConversation">({
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

export function createConversationBranch(
	conversationId: string,
	messageIndex: number,
	branchId?: string,
	messageIds?: string[],
	noBroadcast?: boolean,
) {
	const conversation = conversationMapStore.state[conversationId]?.state;
	if (!conversation) {
		throw new Error("Conversation not found");
	}
	const newConversationId = crypto.randomUUID();
	const newConversation: Conversation = {
		id: branchId || newConversationId,
		title: conversation.title,
		branch: true,
		branchOf: conversationId,
		generating: conversation.generating,
		meta: conversation.meta,
		createdAt: conversation.createdAt,
		updatedAt: conversation.updatedAt,
	};

	conversationMapStore.setState((prev) => ({
		...prev,
		[newConversationId]: new Store(newConversation),
	}));

	const newMessageIds =
		messageIds ||
		new Array(messageIndex).fill("").map(() => crypto.randomUUID());

	const newMessages = chatsStore.state[conversationId].state
		.slice(0, messageIndex)
		.map(
			(message, index) =>
				new Store<ChatMessage>({
					...message.state,
					id: newMessageIds[index],
				}),
		);

	chatsStore.setState((prev) => ({
		...prev,
		[newConversationId]: new Store(newMessages),
	}));

	if (!noBroadcast) {
		syncEventManager.emit<"createConversationBranch">({
			type: "createConversationBranch",
			branchId: newConversationId,
			sourceId: conversationId,
			messageIndex,
			messageIds: newMessageIds,
		});
	}

	console.log(
		"Conversation branch created",
		newConversationId,
		conversationId,
		conversationMapStore.state,
	);

	return newConversationId;
}

export function addMessageDirect(conversationId: string, message: ChatMessage) {
	console.log("Adding message", message);
	const chatMessageListStore = chatsStore.state[conversationId];
	if (!chatMessageListStore) {
		console.log(chatsStore.state);
		console.warn("Conversation not found", conversationId);
		return;
	}
	const messageStore = new Store<ChatMessage>(message);
	chatMessageListStore.setState((prev) => [...prev, messageStore]);
}

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
		syncEventManager.emit<"addMessage">({
			type: "addMessage",
			messageIndex: chatMessageListStore.state.length - 1,
			conversationId,
			message: fullMessage,
		});
	}

	return [id, chatMessageListStore.state.length - 1] as const;
}

export function updateMessage(
	messageId: string,
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
		syncEventManager.emit<"updateMessage">({
			type: "updateMessage",
			messageId,
			messageIndex,
			conversationId,
			message: newMessage,
		});
	}
}

export function updateMessageStream(
	messageId: string,
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
		syncEventManager.emit<"updateMessageStream">({
			type: "updateMessageStream",
			messageId,
			messageIndex,
			conversationId,
			part,
		});
	}
}

export function updateMessageStreamWithSources(
	messageId: string,
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
		syncEventManager.emit<"updateMessageStreamWithSources">({
			type: "updateMessageStreamWithSources",
			messageId,
			messageIndex,
			conversationId,
			source,
		});
	}
}

// Register event handlers
syncEventManager.on<"createConversation">("createConversation", (eventData) => {
	const { conversation } = eventData;
	createConversationDirect(conversation);
});

syncEventManager.on<"createConversationBranch">(
	"createConversationBranch",
	(eventData) => {
		const { branchId, sourceId, messageIndex, messageIds } = eventData;
		console.log(
			"[SyncEventManager] Processing createConversationBranch event:",
			{
				branchId,
				sourceId,
				messageIndex,
				messageIds,
			},
		);
		createConversationBranch(
			sourceId,
			messageIndex,
			branchId,
			messageIds,
			true,
		);
	},
);

syncEventManager.on<"addMessage">("addMessage", (eventData) => {
	const { conversationId, message } = eventData;
	console.log("[SyncEventManager] Processing addMessage event:", {
		conversationId,
		message,
	});
	addMessageDirect(conversationId, message);
});

syncEventManager.on<"updateMessage">("updateMessage", (eventData) => {
	const { messageId, messageIndex, conversationId, message } = eventData;
	console.log("[SyncEventManager] Processing updateMessage event:", {
		messageId,
		messageIndex,
		conversationId,
		message,
	});
	updateMessage(messageId, messageIndex, conversationId, message, true);
});

syncEventManager.on<"updateMessageStream">(
	"updateMessageStream",
	(eventData) => {
		const { messageId, messageIndex, conversationId, part } = eventData;
		console.log("[SyncEventManager] Processing updateMessageStream event:", {
			messageIndex,
			conversationId,
			part,
		});
		updateMessageStream(messageId, messageIndex, conversationId, part, true);
	},
);

syncEventManager.on<"updateMessageStreamWithSources">(
	"updateMessageStreamWithSources",
	(eventData) => {
		const { messageId, messageIndex, conversationId, source } = eventData;
		console.log(
			"[SyncEventManager] Processing updateMessageStreamWithSources event:",
			{ messageId, messageIndex, conversationId, source },
		);
		updateMessageStreamWithSources(
			messageId,
			messageIndex,
			conversationId,
			source,
			true,
		);
	},
);

// syncEventManager.on<"takeData">("takeData", (eventData) => {
// 	const { data } = eventData;
// 	const { conversations, messages } = data;
// 	console.log("[SyncEventManager] Processing takeData event:", {
// 		conversations,
// 		messages,
// 	});
// 	for (const conversation of conversations) {
// 		createConversationDirect(conversation);
// 	}
// 	for (const message of messages) {
// 		addMessageDirect(message.conversationId, message);
// 	}
// });

