import { drizzle } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";

const pglite = new PGlite("./pg-data");
const db = drizzle({ client: pglite, schema });

export default db;
