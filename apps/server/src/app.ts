import * as schema from "l1-db-sqlite/schema";
import { createClient } from "@openauthjs/openauth/client";
import { and, asc, desc, eq } from "drizzle-orm";
import { subject, type User } from "l1-env";
import { getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import type { Context, Hono } from "hono";
import type { DrizzleD1Database } from "drizzle-orm/d1";

const client = createClient({
	clientID: "nextjs",
	issuer: "http://localhost:3000",
});

export type DbCtx = Context<{
	Variables: {
		db: DrizzleD1Database<typeof schema>;
	};
}>;
type UidCtx = Context<{
	Variables: {
		userId: string;
		user: User;
		db: DrizzleD1Database<typeof schema>;
	};
}>;

export const getHonoApp = (app: Hono) => {
	app.use(
		cors({
			origin: "http://localhost:3001",
			credentials: true,
		}),
	);

	app.use("/api/*", async (c: UidCtx, next) => {
		const access_token = getCookie(c, "access_token");
		const refresh_token = getCookie(c, "refresh_token");
		if (!access_token || !refresh_token) {
			console.log("No cookie");
			return c.text("Missing token", 400);
		}

		const tokenRes = await client.verify(subject, access_token);
		if (!tokenRes || tokenRes.err) {
			console.log("No res", tokenRes.err.message);
			return c.text(`Invalid token ${tokenRes.err.message}`, 400);
		}

		if (tokenRes.tokens) {
			setCookie(c, "access_token", tokenRes.tokens.access, {
				httpOnly: true,
				maxAge: 3600 * 24,
			});
			setCookie(c, "refresh_token", tokenRes.tokens.refresh, {
				httpOnly: true,
				maxAge: 3600 * 24,
			});
		}

		c.set("userId", tokenRes.subject.properties.userId);
		c.set("user", tokenRes.subject.properties);
		await next();
	});

	// Add routes to Hono app
	app.get("/login", async (c) => {
		const url = await client.authorize(
			"http://localhost:3000/auth-callback",
			"code",
		);

		const openAuthReq = new Request(url.url);

		const openAuthRes = await app.fetch(openAuthReq);

		return openAuthRes;
	});

	app.get("/test", async (c) => {
		return c.text("ok", 200);
	});

	app.get("/auth-callback", async (c) => {
		const url = new URL(c.req.url);
		const code = url.searchParams.get("code");
		setCookie(c, "test", "test");

		if (!code) {
			return c.text("Missing code", 400);
		}
		const result = await client.exchange(
			code,
			"http://localhost:3000/auth-callback",
		);

		if (result.err) {
			return c.text(`Error: ${result.err.message}`, 400);
		}

		const access_token = result.tokens.access;
		const refresh_token = result.tokens.refresh;

		if (access_token && refresh_token) {
			const result = await client.verify(subject, access_token);
			if (!result || result.err) {
				return c.text(`Invalid token ${result.err.message}`, 400);
			}
			setCookie(c, "access_token", access_token, {
				httpOnly: true,
				maxAge: 3600 * 24,
				domain: ".localhost",
			});
			setCookie(c, "refresh_token", refresh_token, {
				httpOnly: true,
				maxAge: 3600 * 24,
				domain: ".localhost",
			});

			const res = c.redirect(c.env.FRONTEND_URL, 302);

			return res;
		}

		return c.text("Invalid token", 400);
	});

	app.get("/logout", async (c) => {
		setCookie(c, "access_token", "", {
			httpOnly: true,
			maxAge: 1,
		});
		setCookie(c, "refresh_token", "", {
			httpOnly: true,
			maxAge: 1,
		});

		return c.text("Logged out", 200);
	});

	app.get("/api/get-user", async (c: UidCtx) => {
		const access_token = getCookie(c, "access_token");
		const refresh_token = getCookie(c, "refresh_token");
		if (!access_token || !refresh_token) {
			return c.text("Missing token", 400);
		}

		console.log(await c.var.db.select().from(schema.account).all());

		return c.json(c.var.user, 200);
	});

	app.post("/api/upload", async (c: UidCtx) => {
		const formData = await c.req.formData();
		const file = formData.get("file") as File;
		const conversationId = formData.get("conversationId") as string;

		if (!file || !conversationId) {
			return c.text("Missing file or conversationId", 400);
		}

		const fileId = formData.get("id") as string;
		const fileData = await file.arrayBuffer();
		const base64Data = Buffer.from(fileData).toString("base64");

		const attachment = {
			id: fileId,
			name: file.name,
			type: file.type,
			timestamp: Date.now(),
			sent: true,
		};

		// Store in database
		await c.var.db.insert(schema.attachmentTable).values({
			id: fileId,
			userId: c.var.userId,
			conversationId,
			data: attachment,
			fileData: base64Data,
		});

		return c.json({ id: fileId }, 200);
	});

	app.get("/api/download", async (c: UidCtx) => {
		const userId = c.var.userId;
		const url = new URL(c.req.url);
		const conversationId = url.searchParams.get("conversationId");
		const attachmentId = url.searchParams.get("attachmentId");

		let attachments:
			| {
					attachmentInfo: schema.Attachment;
					attachmentId: string;
					fileData: string;
			  }[]
			| undefined;
		if (attachmentId) {
			// Get specific attachment
			attachments = await c.var.db
				.select({
					attachmentInfo: schema.attachmentTable.data,
					attachmentId: schema.attachmentTable.id,
					fileData: schema.attachmentTable.fileData,
				})
				.from(schema.attachmentTable)
				.where(
					and(
						eq(schema.attachmentTable.userId, userId),
						// eq(schema.attachmentTable.conversationId, conversationId),
						eq(schema.attachmentTable.id, attachmentId),
					),
				)
				.limit(1);
			if (!attachments) {
				return c.text("Attachment not found", 404);
			}
			return c.json(attachments);
		}

		if (!conversationId) {
			return c.text("Missing conversationId", 400);
		}
		// Get all attachments for conversation
		attachments = await c.var.db
			.select({
				attachmentInfo: schema.attachmentTable.data,
				attachmentId: schema.attachmentTable.id,
				fileData: schema.attachmentTable.fileData,
			})
			.from(schema.attachmentTable)
			.where(
				and(
					eq(schema.attachmentTable.userId, userId),
					eq(schema.attachmentTable.conversationId, conversationId),
				),
			);

		return c.json(attachments, 200);
	});

	app.get("/api/getData", async (c: UidCtx) => {
		const userId = c.var.userId;

		const conversations = await c.var.db.query.conversation.findMany({
			where: eq(schema.conversation.userId, userId),
      orderBy: desc(schema.conversation.updatedAt),
		});
		const messages = await c.var.db.query.chatMessageTable.findMany({
			where: eq(schema.chatMessageTable.userId, userId),
      orderBy: desc(schema.chatMessageTable.createdAt),
		});
		const attachments = await c.var.db.query.attachmentTable.findMany({
			where: eq(schema.chatMessageTable.userId, userId),
		});

		return c.json({
			conversations: conversations.map((c) => c.data),
			messages: messages.map((m) => m.data),
			attachments: attachments.map((a) => a.data),
		});
	});

	return app;
};

export { client, subject };
