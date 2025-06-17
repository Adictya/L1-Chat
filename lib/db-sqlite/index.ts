import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "./src/schema.ts";
const sqlite = new Database("sqlite.db");
const db = drizzle({ client: sqlite, schema });

export { migrator } from "./src/migrate.ts";
export { setupSyncEvents } from "./src/setup-sync-events.ts";
export default db;
