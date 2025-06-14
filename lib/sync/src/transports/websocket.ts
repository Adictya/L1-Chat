import type { ClientIdSync, SyncEvent } from "../sync-events";
import type { ITransport } from "./transport";

export const getSyncClientEvent = (clientId: string): ClientIdSync => ({
	type: "clientIdSync",
	clientId,
	timestamp: Date.now(),
});

export class ClientWebSocketTransport implements ITransport {
  id: string
	private clientId?: string;
	private ws: WebSocket;
	private messageHandler: ((event: SyncEvent) => void) | null = null;

	constructor(ws: WebSocket) {
    this.id = crypto.randomUUID();
		this.ws = ws;
		this.ws.onmessage = (event) => {
			console.log("[WebSocketTransport] Message raw:", event.data);
			try {
				const data = JSON.parse(event.data as string) as
					| SyncEvent
					| ClientIdSync;
			  console.log("[WebSocketTransport] Message:", data);
				if (data.type === "clientIdSync") {
					console.log("[WebSocketTransport] Client ID sync:", data.clientId);
					this.clientId = data.clientId;
					return;
				}
				if (this.messageHandler) {
          data.transportId = this.id;
					this.messageHandler(data);
				}
			} catch (error) {
				console.error("[WebSocketTransport] Error parsing message:", error);
			}
		};

		this.ws.onerror = (error) => {
			console.error("[WebSocketTransport] WebSocket error:", error);
		};
	}

	send(event: SyncEvent): void {
		console.log("[WebSocketTransport] Sending message", event);
    event.transportId = this.id;
		if (!this.clientId) {
			console.warn("[WebSocketTransport] Client ID not set. Message not sent.");
		}
		event.clientId = this.clientId;
		if (this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(event));
		} else {
			console.warn(
				"[WebSocketTransport] WebSocket is not open. Message not sent.",
			);
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
