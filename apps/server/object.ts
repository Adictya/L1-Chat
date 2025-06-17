import { DurableObject } from "cloudflare:workers";
import { Cloudflare } from "@cloudflare/workers-types";
import { SimpleTransport, SyncEventManager } from "l1-sync";
import { drizzle } from "drizzle-orm/d1";
import { setupSyncEvents } from "l1-db-sqlite/cloudflare";

export class ExcalidrawWebSocketServer extends DurableObject<Cloudflare> {
	id?: string;
	elements: any[] = [];
	syncEventManager: SyncEventManager;
	simpleTransport: SimpleTransport;

	constructor(ctx: DurableObjectState, env: Cloudflare) {
		super(ctx, env);
		ctx.blockConcurrencyWhile(async () => {
			this.elements = (await ctx.storage.get("elements")) || [];
		});
		if (ctx.id.name) {
			this.id = ctx.id.name;
		}
		this.syncEventManager = new SyncEventManager();
		this.simpleTransport = new SimpleTransport("remote-to-db");

		this.syncEventManager.addTransport(this.simpleTransport);
		this.simpleTransport.onSend((event) => {
			this.broadcastMsg(event);
		});

		const db = drizzle(env.DB);

		setupSyncEvents(this.syncEventManager, db);
	}

	async fetch(request: Request): Promise<Response> {
		const webSocketPair = new WebSocketPair();
		const client = webSocketPair[1];
		const server = webSocketPair[0];
		this.ctx.acceptWebSocket(server);
		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	async webSocketOpen(ws: WebSocket) {
		console.log("WebSocket opened");
	}

	async webSocketMessage(
		ws: WebSocket,
		message: string | ArrayBuffer,
	): Promise<void> {
		if (typeof message === "string" && this.id)
			this.simpleTransport.forward(JSON.parse(message), this.id);

		this.broadcastMsg(message, ws);
	}

	webSocketClose(ws: WebSocket) {
		console.log("WebSocket closed");
	}

	webSocketError(ws: WebSocket, error: unknown): void | Promise<void> {
		console.log("Error:", error);
	}

	broadcastMsg(message: string | ArrayBuffer, ws?: WebSocket) {
		for (const session of this.ctx.getWebSockets()) {
			if (!ws) {
        console.log("Sending message to all sessions", message);
				session.send(message);
			} else if (session !== ws) {
				session.send(message);
			} else {
        console.log("not Sending message to self", message);
      }
		}
	}

	async getElements() {
		return {
			data: this.elements,
		};
	}
}
