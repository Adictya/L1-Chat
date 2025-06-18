import type { Conversation, ChatMessage, Source, Attachment } from "l1-db";
import type { ITransport } from "./transports/transport";
import type { ModelsEnum, ProvidersEnum } from "./types";

// Core Event Types and Interfaces
export type SyncEventType =
	| "createConversation"
	| "updateConversation"
	| "createConversationBranch"
	| "addMessage"
	| "updateMessage"
	| "updateMessageStream"
	| "updateMessageStreamWithSources"
	| "clientIdSync"
	| "clientIdAck"
	| "readyForSync"
	| "dummyEvent"
	| "giveData"
	| "takeData"
	| "modelPreferenceUpdated"
	| "eventsBatch"
	| "generateResponse"
	| "stopGeneration"
	| "addAttachment"
	| "removeAttachment"
	| "apiKeyChanged"
	| "clearMessages";

export interface BaseSyncEvent {
	type: SyncEventType;
	timestamp: number;
	transportId?: string;
	clientId?: string;
	userId?: string;
}

export interface CreateConversationEvent extends BaseSyncEvent {
	type: "createConversation";
	conversation: Conversation;
}

export interface UpdateConversationEvent extends BaseSyncEvent {
	type: "updateConversation";
	conversationId: string;
	data: Partial<Omit<Conversation, "id">>;
}

export interface CreateConversationBranchEvent extends BaseSyncEvent {
	type: "createConversationBranch";
	sourceId: string;
	branchId: string;
	messageIndex: number;
	messageIds?: string[];
}

export interface AddMessageEvent extends BaseSyncEvent {
	type: "addMessage";
	conversationId: string;
	messageIndex: number;
	message: ChatMessage;
}

export interface UpdateMessageEvent extends BaseSyncEvent {
	type: "updateMessage";
	messageId: string;
	messageIndex: number;
	conversationId: string;
	message: ChatMessage;
}

export interface UpdateMessageStreamEvent extends BaseSyncEvent {
	type: "updateMessageStream";
	messageId: string;
	messageIndex: number;
	conversationId: string;
	streamType?: "text" | "reasoning";
	part: string;
}

export interface UpdateMessageStreamWithSourcesEvent extends BaseSyncEvent {
	type: "updateMessageStreamWithSources";
	messageId: string;
	messageIndex: number;
	conversationId: string;
	source: Source;
}

export interface ClientIdAck extends BaseSyncEvent {
	type: "clientIdAck";
	clientId: string;
	tokens: {
		access_token: string;
		refresh_token: string;
	};
}

export interface ClientIdSync extends BaseSyncEvent {
	type: "clientIdSync";
	clientId: string;
	tokens: {
		access_token: string;
		refresh_token: string;
	};
}

export interface GiveData extends BaseSyncEvent {
	type: "giveData";
}

export interface TakeData extends BaseSyncEvent {
	type: "takeData";
	data: {
		conversations: Conversation[];
		messages: ChatMessage[];
		attachments: Attachment[];
	};
}

export interface DummyEvent extends BaseSyncEvent {
	type: "dummyEvent";
}

export interface ReadyForSync extends BaseSyncEvent {
	type: "readyForSync";
}

export interface ModelPreferenceUpdated extends BaseSyncEvent {
	type: "modelPreferenceUpdated";
	model: ModelsEnum;
	provider: ProvidersEnum;
}

export interface EventsBatch extends BaseSyncEvent {
	type: "eventsBatch";
	events: SyncEvent[];
}

export interface ClearMessagesEvent extends BaseSyncEvent {
	type: "clearMessages";
	conversationId: string;
	messageIndex: number;
}

export interface GenerateResponseEvent extends BaseSyncEvent {
	type: "generateResponse";
	targetClientId: string;
	conversationId: string;
	selectedModel: ModelsEnum;
	selectedProvider: ProvidersEnum;
  generationConfig: Record<string, any>;
}

export interface StopGenerationEvent extends BaseSyncEvent {
	type: "stopGeneration";
	conversationId: string;
}

export interface AddAttachmentEvent extends BaseSyncEvent {
	type: "addAttachment";
	attachment: Attachment;
}

export interface RemoveAttachmentEvent extends BaseSyncEvent {
	type: "removeAttachment";
	id: string;
}

export interface ApiKeyChangedEvent extends BaseSyncEvent {
	type: "apiKeyChanged";
  keys: string;
	// google: string;
	// openai: string;
	// anthropic: string;
	// openrouter: string;
}

export type SyncEvent =
	| DummyEvent
	| CreateConversationEvent
	| UpdateConversationEvent
	| CreateConversationBranchEvent
	| AddMessageEvent
	| UpdateMessageEvent
	| UpdateMessageStreamEvent
	| UpdateMessageStreamWithSourcesEvent
	| ClientIdSync
	| ClientIdAck
	| ReadyForSync
	| GiveData
	| TakeData
	| EventsBatch
	| ClearMessagesEvent
	| GenerateResponseEvent
	| AddAttachmentEvent
	| RemoveAttachmentEvent
	| ApiKeyChangedEvent
	| StopGenerationEvent;

// Event Handler Types
type EventHandler<E extends SyncEvent> = (payload: E) => void;
type HandlerMap = {
	[K in SyncEventType]?: EventHandler<Extract<SyncEvent, { type: K }>>[];
};

type TransformFunction = (event: SyncEvent) => SyncEvent;

interface Pipe {
	from: ITransport;
	to: ITransport;
	transform?: TransformFunction;
}

// SyncEventManager Class
export class SyncEventManager {
	private transports: ITransport[] = [];
	private handlers: HandlerMap = {};
	private pipes: Pipe[] = [];

	addTransport(transport: ITransport): void {
		this.transports.push(transport);
		transport.onMessage(this.handleIncomingEvent.bind(this));
	}

	removeTransport(transportToRemove: ITransport): void {
		this.transports = this.transports.filter((transport) => {
			if (transport === transportToRemove) {
				transport.close();
				return false;
			}
			return true;
		});

		// Remove any pipes that use this transport
		this.pipes = this.pipes.filter(
			(pipe) =>
				pipe.from !== transportToRemove && pipe.to !== transportToRemove,
		);
	}

	addPipe(
		from: ITransport,
		to: ITransport,
		transform?: TransformFunction,
	): void {
		// Ensure both transports are registered
		if (!this.transports.includes(from)) {
			throw new Error(
				"Source transport must be added to SyncEventManager first",
			);
		}
		if (!this.transports.includes(to)) {
			throw new Error(
				"Target transport must be added to SyncEventManager first",
			);
		}

		// Check for existing pipe
		const existingPipe = this.pipes.find(
			(pipe) => pipe.from === from && pipe.to === to,
		);
		if (existingPipe) {
			throw new Error(
				`Pipe already exists from ${from.constructor.name} to ${to.constructor.name}`,
			);
		}

		// Store pipe configuration
		this.pipes.push({ from, to, transform });
	}

	removePipe(from: ITransport, to: ITransport): void {
		this.pipes = this.pipes.filter(
			(pipe) => pipe.from !== from || pipe.to !== to,
		);
	}

	emit<T extends SyncEventType>(
		eventData: Omit<Extract<SyncEvent, { type: T }>, "timestamp">,
	): void {
		const eventWithTimestamp = {
			...eventData,
			timestamp: Date.now(),
		} as Extract<SyncEvent, { type: T }>;
		for (const transport of this.transports) {
			try {
				transport.send(eventWithTimestamp);
			} catch (error) {
				console.error(
					"[SyncEventManager] Error sending event via transport:",
					error,
				);
			}
		}
	}

	on<T extends SyncEventType>(
		eventType: T,
		handler: EventHandler<Extract<SyncEvent, { type: T }>>,
	): void {
		if (!this.handlers[eventType]) {
			this.handlers[eventType] = [];
		}
		// biome-ignore lint/suspicious/noExplicitAny: complex conditional type
		this.handlers[eventType]?.push(handler as any);
	}

	off<T extends SyncEventType>(
		eventType: T,
		handlerToRemove: EventHandler<Extract<SyncEvent, { type: T }>>,
	): void {
		const eventHandlers = this.handlers[eventType];
		if (eventHandlers) {
			// @ts-expect-error: TODO: Fix this
			this.handlers[eventType] = eventHandlers.filter(
				// biome-ignore lint/suspicious/noExplicitAny: complex conditional type
				(handler) => handler !== (handlerToRemove as any),
			);
		}
	}

	private handleIncomingEvent(event: SyncEvent): void {
		console.log("Incoming event", event);
		if (!event.transportId) {
			console.warn("Event has no transportId", event);
			return;
		}
		if (event.type === "eventsBatch") {
			for (const batchedEvent of event.events) {
				this.handleIncomingEvent(batchedEvent);
			}
		}
		const eventHandlers = this.handlers[event.type];
		if (eventHandlers) {
			for (const handler of eventHandlers) {
				try {
					handler(
						// @ts-expect-error: TODO: Fix this
						event as unknown as Extract<SyncEvent, { type: typeof event.type }>,
					);
				} catch (error) {
					console.error(
						`[SyncEventManager] Error executing handler for ${event.type}:`,
						error,
					);
				}
			}
		}
		const pipes = this.pipes.filter(
			(pipe) => pipe.from.id === event.transportId,
		);
		for (const pipe of pipes) {
			const transformedEvent = pipe.transform ? pipe.transform(event) : event;
			pipe.to.send(transformedEvent);
		}
	}

	destroy(): void {
		for (const transport of this.transports) {
			transport.close();
		}
		this.transports = [];
		this.handlers = {};
		this.pipes = [];
	}
}
