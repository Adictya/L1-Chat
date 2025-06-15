import { resolveConflicts } from "../conflict-resolver";
import type {
	ClientIdSync,
	DummyEvent,
	ReadyForSync,
	SyncEvent,
} from "../sync-events";
import type { ITransport } from "./transport";

export const getSyncClientEvent = (clientId: string): ClientIdSync => ({
	type: "clientIdSync",
	clientId,
	timestamp: Date.now(),
});

export const getAckClientEvent = (clientId: string): ClientIdSync => ({
	type: "clientIdAck",
	clientId,
	timestamp: Date.now(),
});

export const getSyncReadyForSyncEvent = (): ReadyForSync => ({
	type: "readyForSync",
	timestamp: Date.now(),
});

export const getDummyEvent = (): DummyEvent => ({
	type: "dummyEvent",
	timestamp: Date.now(),
});

export class ClientWebSocketTransport implements ITransport {
	id: string;
	status: "ready" | "syncing" | "closed" = "closed";
	private clientId?: string;
	private ws: WebSocket;
	private messageHandler: ((event: SyncEvent) => void) | null = null;
	private queueMessageHandler: ((event: SyncEvent) => void) | null = null;
	private dequeueMessageHandler:
		| (() => Promise<SyncEvent[]> | SyncEvent[])
		| null = null;
	private onClearQueueHandler: (() => void) | null = null;
	private syncEventQueue: SyncEvent[] = [];
	private serverEvents: SyncEvent[] = [];
	private syncEventQueueLock: Promise<void> | null = null;

	constructor(id: string, ws: WebSocket) {
		this.id = id;
		this.ws = ws;
		this.ws.onopen = async () => {
			console.log("[WebSocketTransport] Connected");
			let releaseLock: () => void = () => {};
			this.syncEventQueueLock = new Promise((resolve) => {
				releaseLock = resolve;
			});
			this.syncEventQueue = (await this.dequeueMessageHandler?.()) || [];
			console.log("[WebSocketTransport] syncEventQueue", this.syncEventQueue);
			releaseLock();
			this.status = "syncing";
		};
		this.ws.onclose = () => {
			this.status = "closed";
		};
		this.ws.onmessage = async (wsevent) => {
			try {
				const event = JSON.parse(wsevent.data as string) as
					| SyncEvent
					| ClientIdSync;
				console.log("[WebSocketTransport] Message:", event);
				switch (event.type) {
					case "clientIdSync":
						console.log("[WebSocketTransport] Client ID sync:", event.clientId);
						let clientId = event.clientId;
						this.clientId = clientId;
						this.ws.send(JSON.stringify(getAckClientEvent(clientId)));
						return;
					case "readyForSync": {
						console.log("[WebSocketTransport] Ready for sync:", event.clientId);
						await this.syncEventQueueLock;
						const { sendToServerEvents, sendToClientEvents } = resolveConflicts(
							this.syncEventQueue,
							this.serverEvents,
						);
						const ServerBatchEvent: SyncEvent = {
							type: "eventsBatch",
							events: sendToServerEvents,
							timestamp: Date.now(),
						};
						this.onClearQueueHandler?.();
						this.send(ServerBatchEvent);
						for (const event of sendToClientEvents) {
							event.transportId = this.id;
							this.messageHandler?.(event);
						}
						this.status = "ready";
						return;
					}
				}
				if (this.status === "syncing") {
					this.serverEvents.push(event);
					return;
				}
				if (this.messageHandler) {
					event.transportId = this.id;
					this.messageHandler(event);
				}
			} catch (error) {
				console.error("[WebSocketTransport] Error parsing message:", error);
			}
		};
	}

	onQueueMessage(handler: (event: SyncEvent) => void): void {
		this.queueMessageHandler = handler.bind(this);
	}

	onDequeueMessage(handler: () => Promise<SyncEvent[]> | SyncEvent[]): void {
		this.dequeueMessageHandler = handler.bind(this);
	}

	onClearQueue(handler: () => Promise<void> | void): void {
		this.onClearQueueHandler = handler.bind(this);
	}

	send(event: SyncEvent): void {
		console.log("[WebSocketTransport] Sending message", event);
		event.transportId = this.id;
		if (!this.clientId) {
			console.warn("[WebSocketTransport] Client ID not set. Message not sent.");
		}
		event.clientId = this.clientId;
		try {
			if (this.ws.readyState === WebSocket.OPEN || this.status === "ready") {
				this.ws.send(JSON.stringify(event));
			} else {
				throw new Error("WebSocket is not open");
			}
		} catch (error) {
			console.warn("[WebSocketTransport] Error sending message:", error);
			this.status = "closed";
			this.queueMessageHandler?.(event);
		}
	}

	onMessage(handler: (event: SyncEvent) => void): void {
		this.messageHandler = handler;
	}

	close(): void {
		this.ws.close();
		this.messageHandler = null;
	}
}
