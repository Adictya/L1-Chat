import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrator, setupSyncEvents } from "l1-db-sqlite";
import * as schema from "l1-db-sqlite/schema";
import { subject } from "l1-env";
import { SimpleTransport, SyncEventManager, type SyncEvent } from "l1-sync";
import type { BunRequest } from "bun";
import { getHonoApp, DbCtx } from "./app";
import { MemoryStorage } from "@openauthjs/openauth/storage/memory";
import { Database } from "bun:sqlite";
import drizzleConfig from "../drizzle.config";
import getApp from "./auth";
import { createClient } from "@openauthjs/openauth/client";

const sqlite = new Database("sqlite.db");
const db = drizzle({ client: sqlite, schema });

migrator(db, drizzleConfig.out);

const storage = MemoryStorage({
	persist: "./auth.json",
});

const authApp = getApp(
	storage,
	process.env.GITHUB_CLIENT_ID,
	process.env.GITHUB_CLIENT_SECRET,
);

const client = createClient({
	clientID: "nextjs",
	issuer: process.env.BACKEND_URL,
});

authApp.use("*", async (c: DbCtx, next) => {
	console.log("Setting db");
	// @ts-expect-error: Some issue with drizzle-orm bunsql database type
	c.set("db", db);
	c.set("openauth", client);
	await next();
});

// @ts-expect-error: hacking around
const app = getHonoApp(authApp);

const syncEventManager = new SyncEventManager();
setupSyncEvents(syncEventManager, db);
const simpleTransport = new SimpleTransport("remote-to-db");
syncEventManager.addTransport(simpleTransport);

const server = Bun.serve<{ userId: string; clientId: string }, {}>({
	routes: {
		"/api/sync": async (req: BunRequest) => {
			const access_token = req.cookies.get("access_token");
			const refresh_token = req.cookies.get("refresh_token");
			if (!access_token || !refresh_token) {
				return new Response("Missing token", { status: 400 });
			}

			const token = access_token;
			const tokenRes = await client.verify(subject, token);
			if (!tokenRes || tokenRes.err) {
				return new Response(`Invalid token ${tokenRes.err.message}`, {
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
	fetch: app.fetch,
	websocket: {
		open(ws) {
			ws.subscribe(ws.data.userId);
			simpleTransport.onSend((event) => {
				server.publish(ws.data.userId, event);
			});
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
