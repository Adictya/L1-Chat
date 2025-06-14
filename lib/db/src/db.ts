import type { PGlite } from "@electric-sql/pglite";
import type * as schema from "./schema";
import { PGliteWorker } from "@electric-sql/pglite/worker";
import type { PgliteDatabase } from "drizzle-orm/pglite";

export const createPGLite = async (worker: Worker, apiKey: string) => {
	return await PGliteWorker.create(worker, {
		dataDir: "idb://l1-chat-db",
		meta: {
			apiKey,
		},
	});
};

export type DB = PgliteDatabase<typeof schema> & {
	$client: PGlite;
};
