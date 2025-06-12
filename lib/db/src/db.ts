import { live } from "@electric-sql/pglite/live";
import { QueryBuilder } from "drizzle-orm/pg-core";
import { PGliteWorker } from "@electric-sql/pglite/worker";

export const createPGLite = async (worker: Worker, apiKey: string) => {
	return await PGliteWorker.create(worker, {
		dataDir: "idb://l1-chat-db",
		meta: {
			apiKey,
		},
		extensions: {
			live,
		},
	});
};

const db = new QueryBuilder();

export type DB = typeof db;

export default db;
