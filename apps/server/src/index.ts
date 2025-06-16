import { createClient } from "@openauthjs/openauth/client";
import {
	chatMessageTable,
	conversation,
	migrate,
	setupSyncEvents,
	type ChatMessage,
} from "l1-db";
import { and, asc, desc, eq } from "drizzle-orm";
import db from "l1-db/local";
import { subject, userSchema } from "l1-env";
import { ITransport, SyncEvent, SyncEventManager } from "l1-sync";

migrate(db);

const client = createClient({
	clientID: "nextjs",
	issuer: "http://localhost:3002",
});

class SimpleTransport implements ITransport {
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

const syncEventManager = new SyncEventManager();
setupSyncEvents(syncEventManager, db);
const simpleTransport = new SimpleTransport("remote-to-db");
syncEventManager.addTransport(simpleTransport);

const server = Bun.serve<{ userId: string; clientId: string }, {}>({
	async fetch(req, server) {
		const url = new URL(req.url);
		if (url.pathname === "/sync") {
			const token = url.searchParams.get("token");
			if (!token) {
				return new Response("Missing token", { status: 400 });
			}
			const tokenRes = await client.verify(subject, token);
			if (!tokenRes || tokenRes.err) {
				return new Response("Invalid token " + tokenRes.err.message, {
					status: 400,
				});
			}
			const userId = tokenRes.subject.properties.userId;
			const success = server.upgrade(req, { data: { userId: userId } });
			return success
				? undefined
				: new Response("WebSocket upgrade error", { status: 400 });
		}

		if (url.pathname === "/getData") {
			const token = url.searchParams.get("token");
			if (!token) {
				return new Response("Missing token", { status: 400 });
			}
			const tokenRes = await client.verify(subject, token);
			if (!tokenRes || tokenRes.err) {
				return new Response("Invalid token " + tokenRes.err.message, {
					status: 400,
				});
			}
			const userId = tokenRes.subject.properties.userId;

			const conversations = await db.query.conversation.findMany({
				where: eq(conversation.userId, userId),
        orderBy: desc(conversation.createdAt),
			});
			const messages = await db.query.chatMessageTable.findMany({
				where: eq(chatMessageTable.userId, userId),
        orderBy: asc(chatMessageTable.createdAt),
			});

			return Response.json(
				{
					conversations,
					messages,
				},
				{
					headers: {
						"Access-Control-Allow-Origin": "*",
						"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
						"Access-Control-Allow-Headers": "Content-Type, Authorization",
					},
				},
			);
		}

		return new Response("Hello world");
	},
	websocket: {
		open(ws) {
			ws.subscribe(ws.data.userId);
		},
		message(ws, message) {
			if (typeof message === "string")
				simpleTransport.forward(
					JSON.parse(message) as SyncEvent,
					ws.data.userId,
				);
			ws.publish(ws.data.userId, message);
		},
		close(ws) {
			ws.unsubscribe(ws.data.userId);
		},
	},
});

console.log(`Listening on ${server.hostname}:${server.port}`);
