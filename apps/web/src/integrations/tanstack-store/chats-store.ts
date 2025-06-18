import type { PGliteWorker } from "@electric-sql/pglite/worker";
import { Derived, Effect, Store } from "@tanstack/store";
import { asc, eq, not } from "drizzle-orm";
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
import { SyncEventManager, BroadcastChannelTransport } from "l1-sync";
import { SimpleWebSocketTransport } from "l1-sync";
import { generateAnswer } from "@/hooks/use-stream-text";
import type { ModelsEnum, ProvidersEnum } from "l1-sync/types";
import {
	selectedModelPreferencesStore,
	type ModelPreference,
} from "./settings-store";
import { addAttachment, removeAttachment } from "./attachments-store";
import Worker from "../../sync/workering?worker";
import { SyncWorker } from "@/sync/worker";

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

const stopGenerationStore = new Store<Record<string, AbortController | null>>(
	{},
);

// Initialize SyncEventManager
export const syncEventManager = new SyncEventManager();

// const ws = new WebSocket("ws://localhost:3000/chat");
// const wsTransport = new ClientWebSocketTransport("ws-transport", ws, getTokens());
// syncEventManager.addTransport(wsTransport);
const worker = new Worker();

worker.onmessage = (event) => {
	console.log("Worker message", event);
	if (event.data === "Initiate websocket") {
		console.log("Initiating websocket");
		const webSocketTransport = new SimpleWebSocketTransport(
			"ws-transport",
			"ws://localhost:3000",
		);
		syncEventManager.addTransport(webSocketTransport);
		webSocketTransport.connect();
	}
};

new SyncWorker(worker, crypto.randomUUID());

// const webSocketTransport = new SimpleWebSocketTransport(
// 	"ws-transport",
// 	"ws://localhost:3000",
// );
// syncEventManager.addTransport(webSocketTransport);
// webSocketTransport.connect();

const broadcastChannelTransport = new BroadcastChannelTransport(
	"local-tab-sync",
	"l1-chat-sync-events",
);
syncEventManager.addTransport(broadcastChannelTransport);

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

	return chatMessages;
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
		createdAt: Date.now(),
		updatedAt: Date.now(),
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

export function updateConversation(
	conversationId: string,
	data:
		| ((msg: Conversation) => Partial<Omit<Conversation, "id">>)
		| Partial<Omit<Conversation, "id">>,
	noBroadcast?: boolean,
) {
	const existingConversation = conversationMapStore.state[conversationId];
	if (!existingConversation) {
		throw new Error("Conversation not found");
	}
	existingConversation.setState((prev) => ({
		...prev,
		...(data instanceof Function ? data(prev) : data),
		id: conversationId,
		updatedAt: Date.now(),
	}));

	if (!noBroadcast) {
		syncEventManager.emit<"updateConversation">({
			type: "updateConversation",
			conversationId,
			data: existingConversation.state,
		});
	}
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
	const newConversationId = branchId || crypto.randomUUID();
	const newConversation: Conversation = {
		id: newConversationId,
		title: conversation.title,
		branch: true,
		branchOf: conversationId,
		generating: false,
		meta: conversation.meta,
		createdAt: conversation.createdAt,
		updatedAt: Date.now(),
	};

	conversationMapStore.setState((prev) => ({
		[newConversationId]: new Store(newConversation),
		...prev,
	}));

	const newMessageIds =
		messageIds ||
		new Array(messageIndex).fill("").map(() => crypto.randomUUID());

	const newMessages = chatsStore.state[conversationId].state
		.slice(0, messageIndex + 1)
		.map(
			(message, index) =>
				new Store<ChatMessage>({
					...message.state,
					id: newMessageIds[index],
					conversationId: newConversationId,
					updatedAt: Date.now(),
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
	message: Omit<ChatMessage, "id" | "createdAt" | "updatedAt">,
	noBroadcast?: boolean,
) {
	const id = crypto.randomUUID();
	const chatMessageListStore = chatsStore.state[conversationId];
	if (!chatMessageListStore) {
		console.log(chatsStore.state);
		throw new Error("Conversation not found");
	}

	const fullMessage: ChatMessage = {
		...message,
		id,
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};
	const messageStore = new Store<ChatMessage>(fullMessage);
	chatMessageListStore.setState((prev) => [...prev, messageStore]);

	updateConversation(conversationId, { updatedAt: Date.now() }, noBroadcast);

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
						updatedAt: Date.now(),
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
	streamType?: "text" | "reasoning",
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
					...(streamType === "reasoning"
						? { reasoningParts: [...(prev.reasoningParts || []), part] }
						: { parts: [...(prev.parts || []), part] }),
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
			streamType,
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

export function clearMessages(
	conversationId: string,
	messageIndex: number,
	noBroadcast?: boolean,
) {
	const chatMessageListStore = chatsStore.state[conversationId];
	if (!chatMessageListStore) {
		throw new Error("Conversation not found");
	}

	chatMessageListStore.setState((prev) => prev.slice(0, messageIndex + 1));

	if (!noBroadcast) {
		syncEventManager.emit<"clearMessages">({
			type: "clearMessages",
			conversationId,
			messageIndex,
		});
	}
}

export async function generateResponse(
	conversationId: string,
	selectedModel?: ModelsEnum,
	selectedProvider?: ProvidersEnum,
	selectedSettings?: ModelPreference,
) {
	const messageHistory = chatsStore.state[conversationId].state.map(
		(message) => message.state,
	);

	const message = messageHistory
		.filter((message) => message.role === "user")
		.at(-1);

	if (!message) {
		console.warn("No user message found in conversation");
		return;
	}

	const abortController = new AbortController();

	stopGenerationStore.setState((prev) => ({
		...prev,
		[conversationId]: abortController,
	}));

	const selectedModelPreferences = selectedModelPreferencesStore.state;

	generateAnswer(
		message.message,
		conversationId,
		selectedModel || selectedModelPreferences.model,
		selectedProvider || selectedModelPreferences.provider,
		selectedSettings || selectedModelPreferences.settings,
		messageHistory,
		abortController.signal,
	);
}

export function stopGeneration(conversationId: string) {
	const abortController = stopGenerationStore.state[conversationId];

	if (!abortController) {
		console.warn("No abort controller found for conversation");
		return;
	}

	abortController.abort();

	stopGenerationStore.setState((prev) => ({
		...prev,
		[conversationId]: null,
	}));
}

// Register event handlers

syncEventManager.on("takeData", (eventData) => {
	const { data } = eventData;
	for (const conversation of data.conversations.sort(
		(a, b) => a.updatedAt - b.updatedAt,
	)) {
		createConversationDirect(conversation);
	}

	for (const message of data.messages.sort(
		(a, b) => a.createdAt - b.createdAt,
	)) {
		addMessageDirect(message.conversationId, message);
	}

	for (const attachment of data.attachments.filter((e) => e.sent))
		addAttachment(attachment);
});

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

syncEventManager.on<"updateConversation">("updateConversation", (eventData) => {
	const { conversationId, data } = eventData;
	console.log("[SyncEventManager] Processing updateConversation event:", {
		data,
	});
	updateConversation(conversationId, data, true);
});

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
		const { messageId, messageIndex, conversationId, part, streamType } =
			eventData;
		console.log("[SyncEventManager] Processing updateMessageStream event:", {
			messageIndex,
			conversationId,
			part,
		});
		updateMessageStream(
			messageId,
			messageIndex,
			conversationId,
			part,
			streamType,
			true,
		);
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

syncEventManager.on<"clearMessages">("clearMessages", (eventData) => {
	const { conversationId, messageIndex } = eventData;
	console.log("[SyncEventManager] Processing clearMessages event:", {
		conversationId,
		messageIndex,
	});
	clearMessages(conversationId, messageIndex, true);
});

syncEventManager.on<"generateResponse">("generateResponse", (eventData) => {
	const { targetClientId, conversationId, selectedModel, selectedProvider } =
		eventData;
	console.log("[SyncEventManager] Processing generateResponse event:", {
		targetClientId,
		conversationId,
		selectedModel,
		selectedProvider,
	});

	generateResponse(conversationId, selectedModel, selectedProvider);
});

syncEventManager.on<"stopGeneration">("stopGeneration", (eventData) => {
	const { conversationId } = eventData;
	console.log("[SyncEventManager] Processing stopGeneration event:", {
		conversationId,
	});

	stopGeneration(conversationId);
});

syncEventManager.on<"addAttachment">("addAttachment", (eventData) => {
	const { attachment } = eventData;
	console.log("[SyncEventManager] Processing addAttachment event:", {
		attachment,
	});

	addAttachment(attachment);
});

syncEventManager.on<"removeAttachment">("removeAttachment", (eventData) => {
	const { id } = eventData;
	console.log("[SyncEventManager] Processing removeAttachment event:", {
		id,
	});

	removeAttachment(id, true);
});

// syncEventManager.on("", (eventData) => {
// 	const { conversationId } = eventData;
// 	console.log("[SyncEventManager] Processing stopGeneration event:", {
// 		conversationId,
// 	});
//
// 	stopGeneration(conversationId);
// });
