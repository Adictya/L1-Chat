import { clientIdTable, eventQueueTable, migrate, setupSyncEvents } from "l1-db";
import db from "l1-db/local";
import {
	getSyncClientEvent,
	type ITransport,
	type SyncEvent,
	SyncEventManager,
} from "l1-sync";
import {
	getDummyEvent,
	getSyncReadyForSyncEvent,
} from "l1-sync/src/transports/websocket";
import { nanoid } from "nanoid";
import { createClient } from "@openauthjs/openauth/client"
import { subject } from "l1-env";

migrate(db);

class SimpleTransport implements ITransport {
	id: string;
	private state: "ready" | "closed" | null = null;
	private messageHandler: ((event: SyncEvent) => void) | null = null;
	// Keeping this typo, sendler
	private messageSendler: ((event: string) => void) | null = null;
	private userId: string | null = null;

	constructor(id: string, userId: string | null) {
		this.id = id;
		this.userId = userId;
	}

	getUserId() {
		return this.userId;
	}

	forward(message: SyncEvent) {
		message.userId = this.userId ?? undefined;
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
	clientTransports: Record<string, SimpleTransport | null> = {};
	userClients: Record<string, string[]> = {};
	private enQueueMessageHandler:
		| ((event: SyncEvent, clientId: string) => void)
		| null = null;
	private dequeueMessageHandler:
		| ((clientId: string) => Promise<SyncEvent[]> | SyncEvent[])
		| null = null;

	constructor(id: string) {
		super(id, null);
	}

	getClientId() {
		return nanoid();
	}

	async addClient(userId: string, clientId: string, transport: SimpleTransport | null) {
		if (this.connectedClients >= 1) {
			console.log("[orchestrator] Client not added");
			return;
		}
		if (!transport) {
			console.log("[orchestrator] Client added but not connected", clientId);

			return;
		}
		this.userClients[userId].push(clientId);
		transport.send(getSyncClientEvent(clientId));
		console.log("[orchestrator] Client added:", clientId);
		// const pendingCLientMessages = await this.dequeueMessageHandler?.(clientId);
		// if (pendingCLientMessages) {
		// 	console.log(
		// 		"[orchestrator] Sending pending messages",
		// 		clientId,
		// 		pendingCLientMessages.length,
		// 	);
		// 	for (const message of pendingCLientMessages) {
		// 		transport.send(message);
		// 	}
		// }
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
		for (const userId in this.userClients) {
			if (this.userClients[userId].includes(clientId)) {
				this.userClients[userId] = this.userClients[userId].filter((id) => id !== clientId);
			}
		}
		delete this.clientTransports[clientId];
	}

	onClientMessage(clientId: string, event: SyncEvent) {
		if (!event.userId) {
			console.error("No user id found in event", event);
			return;
		}
		if (this.userClients[event.userId] && this.userClients[event.userId].length > 1) {
			for (const userClientId of this.userClients[event.userId]) {
				if (userClientId === clientId) continue;
				this.clientTransports[userClientId]?.send(event);
			}
		}
		if (this.userClients[event.userId] && this.userClients[event.userId].length === 1) {
			for (const otherClientId in this.clientTransports) {
				if (otherClientId === clientId) continue;
				if (this.clientTransports[otherClientId]) {
					this.clientTransports[otherClientId].send(event);
				} else {
					this.enQueueMessageHandler?.(event, otherClientId);
				}
			}
		}
	}

	send(event: SyncEvent): void {
		if (!event.userId) {
			console.error("No user id found in event", event);
			return;
		}
		if (this.userClients[event.userId] && this.userClients[event.userId].length > 1) {
			for (const clientId of this.userClients[event.userId]) {
				if (this.clientTransports[clientId]) {
					this.clientTransports[clientId].send(event);
			} else {
					// this.enQueueMessageHandler?.(event, clientId);
					console.log("Enqueuing message", event);
				}
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

const clientOrchestratorTransport = new ClientOrchestratorTransport(
	"client-orchestrator",
);

const syncEventManager = new SyncEventManager();

syncEventManager.addTransport(clientOrchestratorTransport);

const userClients = await db.select().from(clientIdTable);
for (const userClient of userClients) {
	if (userClient.userId) {
		clientOrchestratorTransport.addClient(userClient.userId, userClient.clientId, null);
	}
}

setupSyncEvents(syncEventManager, db);

const client = createClient({
	clientID: "nextjs",
	issuer: "http://localhost:3002",
});

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
			ws.send(JSON.stringify(getSyncClientEvent(nanoid())))
		},
		async message(ws, message) {
			console.log("Message", message);
			if (typeof message === "string") {
				const parsedMessage = JSON.parse(message) as SyncEvent;
				if (parsedMessage.type === "clientIdAck") {
					const res = await client.verify(subject, parsedMessage.tokens.access_token)
					if (!res || res.err) {
						console.log("Token not verified", res);
						return;
					}
					console.log("Token verified", res);
					const clientTranport = new SimpleTransport(parsedMessage.clientId, res.subject.properties.userId);
					clientTranport.ready();
					clientTranport.onSend((event) => {
						ws.send(event);
					});
					await db.insert(clientIdTable).values({
						userId: res.subject.properties.userId,
						clientId: parsedMessage.clientId,
					}).onConflictDoNothing();
					if (clientOrchestratorTransport.connectedClients < 2) {
						clientOrchestratorTransport.addClient(
							res.subject.properties.userId,
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
