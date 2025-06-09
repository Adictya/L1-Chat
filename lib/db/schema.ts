import {
	pgTable,
	serial,
	varchar,
	pgEnum,
	timestamp,
	decimal,
	integer,
	index,
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

export const conversation = pgTable("conversation", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	title: varchar("title", { length: 255 }).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const chatMessage = pgTable("chat_message", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	chatId: integer("chat_id")
		.notNull()
		.references(() => conversation.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 255 }).notNull(),
	content: varchar("content", { length: 255 }).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessage.$inferSelect;

export const chatInput = pgTable("chat_input", {
	id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
	chatId: integer("chat_id")
		.notNull()
		.references(() => conversation.id, { onDelete: "cascade" }),
	input: varchar("input", { length: 255 }).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
