import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
} from "drizzle-orm/sqlite-core";

import type { SyncEvent } from "l1-sync";

export const account = sqliteTable(
	"account",
	{
		id: text("id").primaryKey().default(sql`(uuid())`),
		oauth_id: text("oauth_id").notNull(),
		name: text("name").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull().defaultNow(),
		updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().defaultNow(),
	},
	(table) => [index("account_oauth_id_index").on(table.oauth_id)],
);

export type Account = typeof account.$inferSelect;

export type Conversation = {
	id: string;
	title: string;
	branch: boolean;
	branchOf?: string;
	generating: boolean;
	meta: {
		tokens: number;
		activeTokens: number;
	};
	createdAt: string;
	updatedAt: string;
};

export const conversation = sqliteTable("conversation", {
	id: text("id").notNull(),
	userId: text("user_id").notNull(),
	data: text("data", { mode: "json" }).$type<Conversation>().notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull().defaultNow(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().defaultNow(),
}, (table) => ({
	pk: primaryKey({ columns: [table.userId, table.id] })
}));

export type ConversationEntry = typeof conversation.$inferSelect;

export type Source = {
	id: string;
	sourceType: string;
	title?: string;
	url: string;
};

const ChatMessageRoles = {
	User: "user",
	Assistant: "assistant",
} as const;

export type ChatMessageRole =
	(typeof ChatMessageRoles)[keyof typeof ChatMessageRoles];

export type ChatMessage = {
	id: string;
	conversationId: string;
	message: string;
	disabled?: boolean;
	createdAt: string;
	updatedAt: string;
	meta_tokens: number;
	role: "assistant" | "user";
	meta_model?: string;
	meta_provider?: string;
	reasoning?: string;
	sources?: Source[];
	parts?: string[];
	status?:
		| "submitted"
		| "reasoning"
		| "generating"
		| "done"
		| "errored"
		| "stopped";
	error?: string;
};

export const chatMessageTable = sqliteTable("chat_message", {
	id: text("id").notNull(),
	userId: text("user_id").notNull(),
	conversationId: text("conversation_id")
		.notNull()
		.references(() => conversation.id, { onDelete: "cascade" }),
	data: text("data", { mode: "json" }).$type<ChatMessage>().notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull().defaultNow(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().defaultNow(),
}, (table) => ({
	pk: primaryKey({ columns: [table.userId, table.conversationId, table.id] })
}));

export const eventQueueTable = sqliteTable("event_queue", {
	id: text("id").primaryKey(),
	transportId: text("transport_id").notNull(),
	event: text("event", { mode: "json" }).$type<SyncEvent>().notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull().defaultNow(),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().defaultNow(),
});

export const client_id = sqliteTable("client_id", {
	serverTransportId: text("server_transport_id").primaryKey(),
	clientId: text("clientId"),
});

export type MessageEntry = typeof chatMessageTable.$inferSelect;
