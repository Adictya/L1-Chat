import type { SyncEvent } from "../sync-events";
import type { ITransport } from "./transport";

export class SimpleTransport implements ITransport {
	id: string;
	private messageHandler: ((event: SyncEvent) => void) | null = null;
	private messageSendler: ((event: string) => void) | null = null;

	constructor(id: string) {
		this.id = id;
	}

	forward(message: SyncEvent, userId: string) {
		console.log("Forwarding message", message);
		message.userId = userId;
		if (this.messageHandler) {
			message.transportId = this.id;
			this.messageHandler(message);
		}
	}

	send(event: SyncEvent): void {
		event.transportId = this.id;
		if (this.messageSendler) {
			this.messageSendler(JSON.stringify(event));
		} else {
			console.warn(
				"[WebSocketTransport] WebSocket is not open. Message not sent.",
			);
		}
	}

	onMessage(handler: (event: SyncEvent) => void): void {
		this.messageHandler = handler;
	}

	onSend(handler: (event: string) => void): void {
		this.messageSendler = handler;
	}

	close(): void {
		this.messageHandler = null;
		this.messageSendler = null;
	}
}
