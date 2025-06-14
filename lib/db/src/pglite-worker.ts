import { PGlite } from "@electric-sql/pglite";
import { worker } from "@electric-sql/pglite/worker";
import { drizzle } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import migrations from "../migrations.json";
import * as schema from "./schema";
import type { MigrationConfig } from "drizzle-orm/migrator";
import type { ChatMessage } from "./schema";
import {
	SyncEventManager,
	BroadcastChannelTransport,
	WebSocketTransport,
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
			"l1-chat-sync-events",
		);
		syncEventManager.addTransport(broadcastChannelTransport);

		const ws = new WebSocket("ws://localhost:3000");
		const websocketTransport = new WebSocketTransport(ws);
		syncEventManager.addTransport(websocketTransport);

		syncEventManager.addPipe(broadcastChannelTransport, websocketTransport);
		syncEventManager.addPipe(websocketTransport, broadcastChannelTransport);

		// Register event handlers
		setupSyncEvents(syncEventManager, db);

		return pgLiteClient;
	},
});
