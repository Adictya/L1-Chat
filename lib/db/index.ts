import db, { pgLiteClient } from "./db.ts";
// import { migrate } from "./migrate.ts";
export type { DB } from "./db.ts";

// migrate();

export default db;
export * from "./schema.ts";
export { pgLiteClient };
