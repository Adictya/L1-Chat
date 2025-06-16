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
import { BunRequest } from "bun";

migrate(db);

// TODO: env
const secret = new TextEncoder().encode("secret");

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
	routes: {
		"/login": async () => {
			const url = await client.authorize("http://localhost:3000/auth", "code");
			return Response.redirect(url.url, 302);
		},
		"/auth": async (req: BunRequest) => {
			const url = new URL(req.url);

			const code = url.searchParams.get("code");

			console.log("code", code);
			if (!code) {
				return new Response("Missing code", { status: 400 });
			}
			const result = await client.exchange(code, "http://localhost:3000/auth");

			if (result.err) {
				return new Response("Error: " + result.err.message, {
					status: 400,
				});
			}

			const access_token = result.tokens.access;
			const refresh_token = result.tokens.refresh;

			if (access_token && refresh_token) {
				const result = await client.verify(subject, access_token);
				if (!result || result.err) {
					return new Response("Invalid token " + result.err.message, {
						status: 400,
					});
				}

				// TODO: env
				const res = Response.redirect("http://localhost:3001", 302);
				req.cookies.set("access_token", access_token, {
					httpOnly: true,
					maxAge: 3600 * 24,
				});
				req.cookies.set("refresh_token", refresh_token, {
					httpOnly: true,
					maxAge: 3600 * 24,
				});

				return res;
			}

			return new Response("Invalid token", {
				status: 400,
			});
		},
		"/get-user": async (req: BunRequest) => {
			const access_token = req.cookies.get("access_token");
			const refresh_token = req.cookies.get("refresh_token");
			if (!access_token || !refresh_token) {
				return new Response("Missing token", { status: 400 });
			}

			let token = access_token;
			// const tokenExpiry = jose.decodeJwt(access_token).exp;
			// check if token has expired
			// if (tokenExpiry && tokenExpiry < Date.now() / 1000) {
			// 	token = refresh_token;
			// }

			const tokenRes = await client.verify(subject, token);
			if (!tokenRes || tokenRes.err) {
				return new Response("Invalid token " + tokenRes.err.message, {
					status: 400,
				});
			}
			if (tokenRes.tokens) {
				req.cookies.set("access_token", tokenRes.tokens.access, {
					httpOnly: true,
					maxAge: 3600 * 24,
				});
				req.cookies.set("refresh_token", tokenRes.tokens.refresh, {
					httpOnly: true,
					maxAge: 3600 * 24,
				});
			}

			return Response.json(tokenRes.subject.properties, {
				headers: {
					"Access-Control-Allow-Origin": "http://localhost:3001",
					"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
					"Access-Control-Allow-Headers": "Content-Type, Authorization",
					"Access-Control-Allow-Credentials": "true",
				},
			});
		},
		"/sync": async (req: BunRequest) => {
			const access_token = req.cookies.get("access_token");
			const refresh_token = req.cookies.get("refresh_token");
			if (!access_token || !refresh_token) {
				return new Response("Missing token", { status: 400 });
			}

			console.log("New access token", access_token);

			let token = access_token;
			// const tokenExpiry = jose.decodeJwt(access_token).exp;
			// check if token has expired
			// if (tokenExpiry && tokenExpiry < Date.now() / 1000) {
			// 	token = refresh_token;
			// }

			const tokenRes = await client.verify(subject, token);
			if (!tokenRes || tokenRes.err) {
				return new Response("Invalid token " + tokenRes.err.message, {
					status: 400,
				});
			}
			if (tokenRes.tokens) {
				req.cookies.set("access_token", tokenRes.tokens.access, {
					httpOnly: true,
					maxAge: 3600 * 24,
				});
				req.cookies.set("refresh_token", tokenRes.tokens.refresh, {
					httpOnly: true,
					maxAge: 3600 * 24,
				});
			}
			const userId = tokenRes.subject.properties.userId;
			const success = server.upgrade(req, { data: { userId: userId } });
			return success
				? undefined
				: new Response("WebSocket upgrade error", { status: 400 });
		},
	},
	async fetch(req, server) {
		// const url = new URL(req.url);
		// console.log("hostName", server.hostname);
		// const hash = url.hash.substring(1); // Remove the # character
		// console.log("hash", hash);
		// console.log("req", req);
		//
		// if (url.pathname === "/auth-callback") {
		// 	const hash = url.hash.substring(1); // Remove the # character
		//
		// 	const searchParams = new URLSearchParams(hash);
		//
		// 	const access_token = searchParams.get("access_token");
		// 	const refresh_token = searchParams.get("refresh_token");
		//
		// 	return Response.redirect(
		// 		"http://localhost:3000/auth?access_token=" +
		// 			access_token +
		// 			"&refresh_token=" +
		// 			refresh_token,
		// 		302,
		// 	);
		// }

		// if (url.pathname === "/getData") {
		// 	const conversations = await db.query.conversation.findMany({
		// 		where: eq(conversation.userId, userId),
		// 		orderBy: desc(conversation.createdAt),
		// 	});
		// 	const messages = await db.query.chatMessageTable.findMany({
		// 		where: eq(chatMessageTable.userId, userId),
		// 		orderBy: asc(chatMessageTable.createdAt),
		// 	});
		//
		// 	return Response.json(
		// 		{
		// 			conversations,
		// 			messages,
		// 		},
		// 		{
		// 			headers: {
		// 				"Access-Control-Allow-Origin": "*",
		// 				"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
		// 				"Access-Control-Allow-Headers": "Content-Type, Authorization",
		// 			},
		// 		},
		// 	);

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
