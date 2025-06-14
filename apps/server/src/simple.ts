import { migrate, setupSyncEvents } from "l1-db";
import db from "l1-db/local";
import {
	getSyncClientEvent,
	ITransport,
	SyncEvent,
	SyncEventManager,
} from "l1-sync";
import { nanoid } from "nanoid";

migrate(db);

class SimpleTransport implements ITransport {
	id: string;
	private state: "ready" | "closed" | null = null;
	private messageHandler: ((event: SyncEvent) => void) | null = null;
	// Keeping this typo, sendler
	private messageSendler: ((event: string) => void) | null = null;

	constructor() {
		this.id = nanoid();
	}

	forward(message: SyncEvent) {
		if (this.messageHandler) {
      message.transportId = this.id;
			this.messageHandler(message);
		}
	}
	send(event: SyncEvent): void {
    event.transportId = this.id;
		if (this.state === "ready" && this.messageSendler) {
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
		this.state = "closed";
		this.messageHandler = null;
		this.messageSendler = null;
	}

	ready(): void {
		this.state = "ready";
	}
}

class ClientOrchestratorTransport extends SimpleTransport {
	clients: Record<string, SimpleTransport> = {};

	addClient(transport: SimpleTransport) {
		const clientId = nanoid();
		this.clients[clientId] = transport;
		transport.send(getSyncClientEvent(clientId));
		console.log("[orchestrator] Client added:", clientId);
	}

	removeClient(clientId: string) {
		delete this.clients[clientId];
	}

	onClientMessage(clientId: string, event: SyncEvent) {
		console.log(
			"[orchestrator] Client message:",
			clientId,
			!!this.clients[clientId],
			Object.keys(this.clients),
		);
		if (this.clients[clientId]) {
			for (const otherClientId in this.clients) {
				if (otherClientId === clientId) continue;
				this.clients[otherClientId].send(event);
			}
		}
	}

	send(event: SyncEvent): void {
		for (const clientId in this.clients) {
			this.clients[clientId].send(event);
		}
	}

	forward(message: SyncEvent) {
		super.forward(message);
		if (message.clientId) {
			return this.onClientMessage(message.clientId, message);
		}
	}
}

const clientOrchestratorTransport = new ClientOrchestratorTransport();

const syncEventManager = new SyncEventManager();

syncEventManager.addTransport(clientOrchestratorTransport);

setupSyncEvents(syncEventManager, db);

const server = Bun.serve({
	port: 3000,
	fetch(request, server) {
		if (server.upgrade(request)) {
			return;
		}

		return new Response("Helloooooo World");
	},
	websocket: {
		open(ws) {
			console.log("Connection opened");
			const clientTranport = new SimpleTransport();
			clientTranport.ready();
			clientTranport.onSend((event) => {
				ws.send(event);
			});
			clientOrchestratorTransport.addClient(clientTranport);
		},
		message(ws, message) {
			console.log("Message", message);
			if (typeof message === "string") {
				clientOrchestratorTransport.forward(JSON.parse(message));
			}
		},
		close(ws) {
			console.log("Close");
		},
	},
});
