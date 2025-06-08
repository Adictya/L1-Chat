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
