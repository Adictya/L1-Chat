import { QueryBuilder } from "drizzle-orm/pg-core";
import { createPGLite } from "./src/db.ts";
export type { DB } from "./src/db.ts";

const db = new QueryBuilder();

export { migrate } from "./src/migrate.ts";
export { setupSyncEvents } from "./src/setup-sync-events";
export default db;
export * from "./src/schema.ts";
export { createPGLite };
