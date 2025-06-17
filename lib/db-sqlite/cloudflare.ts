import { drizzle } from "drizzle-orm/d1";
import * as schema from "./src/schema.ts";

export { setupSyncEvents } from "./src/setup-sync-events.ts";
export const getDb = (env: any) => drizzle({ client: env.DB, schema: schema });
