import db, { createPGLite } from "./src/db.ts";
export type { DB } from "./src/db.ts";

export default db;
export * from "./src/schema.ts";
export { createPGLite };
