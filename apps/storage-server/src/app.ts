import type { D1Database } from "@cloudflare/workers-types";
import { Hono } from "hono";
import { account } from "l1-db-sqlite/schema";
import { getDb } from "l1-db-sqlite/cloudflare";
import { drizzle } from "drizzle-orm/d1";

const app = new Hono();

type Bindings = {
	MY_BUCKET: D1Database;
	USERNAME: string;
	PASSWORD: string;
};

app.get("/", async (c) => {
	// const db = getDb(c.env);

  const db = drizzle(c.env.DB)

  console.log(db);
	console.log(await db.select().from(account).all());
	return c.text("Hello Cloudflare Workers!");
});

export default app;
