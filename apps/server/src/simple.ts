import { client_id, eventQueueTable, migrate, setupSyncEvents } from "l1-db";
import db from "l1-db/local";
import {
	getSyncClientEvent,
	ITransport,
	SyncEvent,
	SyncEventManager,
} from "l1-sync";
import {
	getDummyEvent,
	getSyncReadyForSyncEvent,
} from "l1-sync/src/transports/websocket";
import { nanoid } from "nanoid";

migrate(db);

class SimpleTransport implements ITransport {
	id: string;
	private state: "ready" | "closed" | null = null;
	private messageHandler: ((event: SyncEvent) => void) | null = null;
	// Keeping this typo, sendler
	private messageSendler: ((event: string) => void) | null = null;

	constructor(id: string) {
		this.id = id;
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
	connectedClients = 0;
	clients: Record<string, SimpleTransport | null> = {};
	private enQueueMessageHandler:
		| ((event: SyncEvent, clientId: string) => void)
		| null = null;
	private dequeueMessageHandler:
		| ((clientId: string) => Promise<SyncEvent[]> | SyncEvent[])
		| null = null;

	constructor(id: string, clients: string[]) {
		super(id);
		this.clients = clients.reduce(
			(acc, clientId) => {
				acc[clientId] = null;
				return acc;
			},
			{} as Record<string, SimpleTransport | null>,
		);
	}

	getClientId() {
		return nanoid();
	}

	async addClient(clientId: string, transport: SimpleTransport | null) {
		if (this.connectedClients >= 1) {
			console.log("[orchestrator] Client not added");
			return;
		}
		if (!transport) {
			console.log("[orchestrator] Client added but not connected", clientId);
			this.clients[clientId] = null;
			return;
		}
		this.clients[clientId] = transport;
		transport.send(getSyncClientEvent(clientId));
		console.log("[orchestrator] Client added:", clientId);
		const pendingCLientMessages = await this.dequeueMessageHandler?.(clientId);
		if (pendingCLientMessages) {
			console.log(
				"[orchestrator] Sending pending messages",
				clientId,
				pendingCLientMessages.length,
			);
			for (const message of pendingCLientMessages) {
				transport.send(message);
			}
		}
		transport.send(getSyncReadyForSyncEvent());
		console.log("[orchestrator] Client ready for sync:", clientId);
		this.connectedClients++;
	}

	onQueueMessage(handler: (event: SyncEvent, clientId: string) => void): void {
		this.enQueueMessageHandler = handler.bind(this);
	}

	onDequeueMessage(handler: () => Promise<SyncEvent[]> | SyncEvent[]): void {
		this.dequeueMessageHandler = handler.bind(this);
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
				if (this.clients[otherClientId]) {
					this.clients[otherClientId].send(event);
				} else {
					this.enQueueMessageHandler?.(event, otherClientId);
				}
			}
		}
	}

	send(event: SyncEvent): void {
		for (const clientId in this.clients) {
			if (this.clients[clientId]) {
				this.clients[clientId].send(event);
			} else {
				this.enQueueMessageHandler?.(event, clientId);
			}
		}
	}

	forward(message: SyncEvent) {
		super.forward(message);
		if (message.clientId) {
			return this.onClientMessage(message.clientId, message);
		}
	}
}

const clients = await db.select().from(client_id);

const clientOrchestratorTransport = new ClientOrchestratorTransport(
	"client-orchestrator",
	clients.map((client) => client.serverTransportId),
);

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
		},
		message(ws, message) {
			console.log("Message", message);
			if (typeof message === "string") {
				const parsedMessage = JSON.parse(message) as SyncEvent;
				if (parsedMessage.type === "clientIdAck") {
					const clientTranport = new SimpleTransport(parsedMessage.clientId);
					clientTranport.ready();
					clientTranport.onSend((event) => {
						ws.send(event);
					});
					db.insert(client_id).values({
						serverTransportId: parsedMessage.clientId,
						clientId: clientOrchestratorTransport.id,
					});
					if (clientOrchestratorTransport.connectedClients < 2) {
						clientOrchestratorTransport.addClient(
							parsedMessage.clientId,
							clientTranport,
						);
					}
				} else {
					clientOrchestratorTransport.forward(parsedMessage);
				}
			}
		},
		close(ws) {
			console.log("Close");
		},
	},
});
