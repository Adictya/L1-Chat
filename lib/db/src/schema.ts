import {
	pgTable,
	varchar,
	timestamp,
	integer,
	index,
	text,
	jsonb,
} from "drizzle-orm/pg-core";

export const account = pgTable(
	"account",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		oauth_id: varchar("oauth_id", { length: 255 }).notNull(),
		name: varchar("name", { length: 255 }).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [index("account_oauth_id_index").on(table.oauth_id)],
);

export type Account = typeof account.$inferSelect;

export type Conversation = {
	id: string;
	title: string;
	branch: boolean;
	generating: boolean;
	meta: {
		tokens: number;
		activeTokens: number;
	};
	createdAt: string;
	updatedAt: string;
};

export const conversation = pgTable("conversation", {
	id: varchar("id", { length: 255 }).primaryKey(),
	data: jsonb("data").$type<Conversation>().notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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

export const chatMessageTable = pgTable("chat_message", {
	id: varchar("id", { length: 255 }).primaryKey(),
	conversationId: varchar("conversation_id", { length: 255 })
		.notNull()
		.references(() => conversation.id, { onDelete: "cascade" }),
	data: jsonb("data").$type<ChatMessage>().notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type MessageEntry = typeof chatMessageTable.$inferSelect;
