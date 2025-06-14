import type { Conversation, ChatMessage, Source } from "l1-db";

// Core Event Types and Interfaces
export type SyncEventType =
	| "createConversation"
	| "addMessage"
	| "updateMessage"
	| "updateMessageStream"
	| "updateMessageStreamWithSources";

export interface BaseSyncEvent {
	type: SyncEventType;
	timestamp: number;
}

export interface CreateConversationEvent extends BaseSyncEvent {
	type: "createConversation";
	conversation: Conversation;
}

export interface AddMessageEvent extends BaseSyncEvent {
	type: "addMessage";
	conversationId: string;
	message: ChatMessage;
}

export interface UpdateMessageEvent extends BaseSyncEvent {
	type: "updateMessage";
	messageIndex: number;
	conversationId: string;
	message: ChatMessage;
}

export interface UpdateMessageStreamEvent extends BaseSyncEvent {
	type: "updateMessageStream";
	messageIndex: number;
	conversationId: string;
	part: string;
}

export interface UpdateMessageStreamWithSourcesEvent extends BaseSyncEvent {
	type: "updateMessageStreamWithSources";
	messageIndex: number;
	conversationId: string;
	source: Source;
}

export type SyncEvent =
	| CreateConversationEvent
	| AddMessageEvent
	| UpdateMessageEvent
	| UpdateMessageStreamEvent
	| UpdateMessageStreamWithSourcesEvent;

// Transport Interface
export interface ITransport {
	send(event: SyncEvent): void | Promise<void>;
	onMessage(handler: (event: SyncEvent) => void): void;
	close(): void;
}

// Event Handler Types
type EventHandler<E extends SyncEvent> = (payload: E) => void;
type HandlerMap = {
	[K in SyncEventType]?: EventHandler<Extract<SyncEvent, { type: K }>>[];
};

// SyncEventManager Class
export class SyncEventManager {
	private transports: ITransport[] = [];
	private handlers: HandlerMap = {};

	constructor() {}

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
	}

	emit<T extends SyncEventType>(
		eventData: Omit<Extract<SyncEvent, { type: T }>, "timestamp">,
	): void {
		const eventWithTimestamp = {
			...eventData,
			timestamp: Date.now(),
		} as Extract<SyncEvent, { type: T }>; // Asserting type after adding timestamp

		// console.log("[SyncEventManager] Emitting event:", eventWithTimestamp);
		this.transports.forEach((transport) => {
			try {
				transport.send(eventWithTimestamp);
			} catch (error) {
				console.error(
					"[SyncEventManager] Error sending event via transport:",
					error,
				);
			}
		});
	}

	on<T extends SyncEventType>(
		eventType: T,
		handler: EventHandler<Extract<SyncEvent, { type: T }>>,
	): void {
		if (!this.handlers[eventType]) {
			this.handlers[eventType] = [];
		}
		this.handlers[eventType]?.push(handler as any); // any due to complex conditional type
	}

	off<T extends SyncEventType>(
		eventType: T,
		handlerToRemove: EventHandler<Extract<SyncEvent, { type: T }>>,
	): void {
		const eventHandlers = this.handlers[eventType];
		if (eventHandlers) {
			// @ts-expect-error: TODO: Fix this
			this.handlers[eventType] = eventHandlers.filter(
				(handler) => handler !== (handlerToRemove as any), // any due to complex conditional type
			);
		}
	}

	private handleIncomingEvent(event: SyncEvent): void {
		const eventHandlers = this.handlers[event.type];
		if (eventHandlers) {
			eventHandlers.forEach((handler) => {
				try {
					handler(event as any); // any due to complex conditional type
				} catch (error) {
					console.error(
						`[SyncEventManager] Error executing handler for ${event.type}:`,
						error,
					);
				}
			});
		}
	}

	destroy(): void {
		this.transports.forEach((transport) => transport.close());
		this.transports = [];
		this.handlers = {};
	}
}

// Example: BroadcastChannel Transport (can be in its own file later)
export class BroadcastChannelTransport implements ITransport {
	private channel: BroadcastChannel;

	constructor(channelName: string) {
		this.channel = new BroadcastChannel(channelName);
	}

	send(event: SyncEvent): void {
		this.channel.postMessage(event);
	}

	onMessage(handler: (event: SyncEvent) => void): void {
		this.channel.onmessage = (msgEvent: MessageEvent<SyncEvent>) => {
			handler(msgEvent.data);
		};
	}

	close(): void {
		this.channel.close();
	}
}
