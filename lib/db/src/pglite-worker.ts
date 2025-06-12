import { PGlite } from "@electric-sql/pglite";
import { worker } from "@electric-sql/pglite/worker";
import { live } from "@electric-sql/pglite/live";
import { drizzle } from "drizzle-orm/pglite";
import migrations from "./migrations.json";
import * as schema from "./schema";
import type { MigrationConfig } from "drizzle-orm/migrator";
import { addMessage, getMessages, updateMessage } from "./mutations";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { smoothStream, streamText, type CoreMessage } from "ai";

const getPrompt = () => {
	return `
You are L1 Chat, an AI assistant powered by the Gemini 2.0 Flash model. Your role is to assist and engage in conversation while being helpful, respectful, and engaging.

If you are specifically asked about the model you are using, you may mention that you use the Gemini 2.5 Flash model. If you are not asked specifically about the model you are using, you do not need to mention it.
The current date and time including timezone is ${new Date().toISOString()}.

Ensure code is properly formatted using Prettier with a print width of 80 characters
Present code in Markdown code blocks with the correct language extension indicated
  `;
};

worker({
	async init(options) {
		const meta = options.meta;
		const pgLiteClient = await PGlite.create({
			dataDir: options.dataDir,
			extensions: {
				live,
			},
		});

		const db = drizzle({ client: pgLiteClient, schema });

		console.log("Running migrations");
		// @ts-expect-error
		await db.dialect.migrate(migrations, db.session, {
			migrationsTable: "drizzle_migrations",
		} satisfies Omit<MigrationConfig, "migrationsFolder">);
		console.log("Migrations ran");

		const google = createGoogleGenerativeAI({
			apiKey: meta.apiKey as string,
		});

		console.log("Google init");

		const bc = new BroadcastChannel("ai-channel");

		bc.onmessage = async (event: unknown) => {
			const castedEvent = event.data as {
				message: string;
				conversationId: number;
			};

			console.log("Event", castedEvent);

		};
		return pgLiteClient;
	},
});
