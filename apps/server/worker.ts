import { drizzle } from "drizzle-orm/d1";
import * as schema from "l1-db-sqlite/schema";
import { Hono, type Context } from "hono";
export { ExcalidrawWebSocketServer } from "./object";
import { z } from "zod";
import { DbCtx, getHonoApp } from "./src/app";
import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare";
import { env } from "cloudflare:workers";
import getApp from "./src/auth";
import { createClient } from "@openauthjs/openauth/client";

type Bindings = {
	OPENAUTH_KV: KVNamespace;
	DURABLE_OBJECT: DurableObjectNamespace;
	DB: D1Database;
};

const storage = CloudflareStorage({
	namespace: env.OPENAUTH_KV,
});

const authApp = new Hono();

// const authApp = getApp(
// 	storage,
// 	process.env.GITHUB_CLIENT_ID,
// 	process.env.GITHUB_CLIENT_SECRET,
// );
//
// console.log("frontend", process.env.FRONTEND_URL);
//

authApp.use(
	async (c: Context<{ Variables: DbCtx["var"]; Bindings: Bindings }>, next) => {
		c.set("db", drizzle(env.DB, { schema: schema }));

		const client = createClient({
			clientID: "nextjs",
			issuer:
				"https://openauth-adictya-cloudflareauthscript.adictya.workers.dev",
		});

		c.set("openauth", client);

		await next();
	},
);

const app = getHonoApp(authApp);

app.get(
	"/api/sync",
	(c: Context<{ Variables: { userId: string }; Bindings: Bindings }>) => {
		const upgradeHeader = c.req.header("Upgrade");
		if (!upgradeHeader || upgradeHeader !== "websocket") {
			return c.text("Expected websocket", 400);
		}

		const id = c.env.DURABLE_OBJECT.idFromName(c.var.userId);
		const stub = c.env.DURABLE_OBJECT.get(id);

		return stub.fetch(c.req.raw);
	},
);

export default app;
