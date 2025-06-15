import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from "./src/schema.ts";
const sqlite = new Database('sqlite.db');
const db = drizzle({ client: sqlite, schema });

export { migrate } from "./src/migrate.ts";
export default db;
export * from "./src/schema.ts";
