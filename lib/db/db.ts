import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { live } from "@electric-sql/pglite/live";

const client = await PGlite.create({
  dataDir: "idb://l1-chat-db",
  extensions: {
    live,
  },
});

const db = drizzle({ client });

export default db;
