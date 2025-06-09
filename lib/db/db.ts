import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { live } from "@electric-sql/pglite/live";
import * as schema from "./schema";

export const pgLiteClient = await PGlite.create({
	dataDir: "idb://l1-chat-db",
	extensions: {
		live,
	},
});

const db = drizzle({ client: pgLiteClient, schema });

export type DB = typeof db

export default db;
