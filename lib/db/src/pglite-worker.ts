import { PGlite } from "@electric-sql/pglite";
import { worker } from "@electric-sql/pglite/worker";
import { drizzle } from "drizzle-orm/pglite";
import { and, asc, eq } from "drizzle-orm";
import migrations from "../migrations.json";
import * as schema from "./schema";
import type { MigrationConfig } from "drizzle-orm/migrator";
import type { ChatMessage } from "./schema";
import {
	SyncEventManager,
	BroadcastChannelTransport,
	WebSocketTransport,
	type SyncEvent,
} from "l1-sync";
import { setupSyncEvents } from "./setup-sync-events";

// Initialize SyncEventManager
worker({
	async init(options) {
		const pgLiteClient = await PGlite.create({
			dataDir: options.dataDir,
		});

		const db = drizzle({ client: pgLiteClient, schema });

		console.log("Running migrations", migrations.length);
		// @ts-expect-error
		await db.dialect.migrate(migrations, db.session, {
			migrationsTable: "drizzle_migrations",
		} satisfies Omit<MigrationConfig, "migrationsFolder">);
		console.log("Migrations ran");

		const syncEventManager = new SyncEventManager();
		const broadcastChannelTransport = new BroadcastChannelTransport(
			"tab-sync",
			"l1-chat-sync-events",
		);
		syncEventManager.addTransport(broadcastChannelTransport);

		const isBrave = navigator.userAgent.includes("Brave");

		const ws = new WebSocket(
			isBrave ? "wss://sync.l1.chat" : "ws://localhost:3000",
		);
		const websocketTransport = new WebSocketTransport("local-sync-server", ws);
		syncEventManager.addTransport(websocketTransport);

		websocketTransport.onQueueMessage(async (event) => {
			console.log("[WebSocketTransport] onQueueMessage", event);

			await db.insert(schema.eventQueueTable).values([
				{
					id: crypto.randomUUID(),
					transportId: event.transportId || "local-sync-server",
					event: event,
				},
			]);
		});

		websocketTransport.onDequeueMessage(async () => {
			const events = await db
				.select()
				.from(schema.eventQueueTable)
				.orderBy(asc(schema.eventQueueTable.createdAt));
			console.log("[WebSocketTransport] onDequeueMessage", events);
			return events.map((event) => event.event);
		});

		websocketTransport.onClearQueue(async () => {
			console.log("[WebSocketTransport] onClearQueue");
			await db
				.delete(schema.eventQueueTable)
				.where(eq(schema.eventQueueTable.transportId, websocketTransport.id));
		});

		websocketTransport.onSaveClientId(async (clientId, serverTransportId) => {
			console.log(
				"[WebSocketTransport] onSaveClientId",
				clientId,
				serverTransportId,
			);
			const existingClientId = await db
				.select()
				.from(schema.client_id)
				.where(eq(schema.client_id.serverTransportId, serverTransportId));
			if (existingClientId && existingClientId.length > 0) {
				console.log("[WebSocketTransport] Client ID already exists");
				return existingClientId[0]?.clientId;
			}
			await db.insert(schema.client_id).values({
				serverTransportId,
				clientId,
			});
			return clientId;
		});

		syncEventManager.addPipe(broadcastChannelTransport, websocketTransport);
		syncEventManager.addPipe(websocketTransport, broadcastChannelTransport);

		// Register event handlers
		setupSyncEvents(syncEventManager, db);

		return pgLiteClient;
	},
});
