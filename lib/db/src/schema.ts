import {
  pgTable,
  varchar,
  timestamp,
  integer,
  index,
  text,
  jsonb,
  primaryKey,
} from "drizzle-orm/pg-core";
import type { SyncEvent } from "l1-sync";
import type { ModelsEnum } from "l1-sync/types";

export const account = pgTable(
  "account",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    oauth_id: varchar("oauth_id", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("account_oauth_id_index").on(table.oauth_id)]
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
  createdAt: number;
  updatedAt: number;
};

export const conversation = pgTable(
  "conversation",
  {
    id: varchar("id", { length: 255 }).notNull(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    data: jsonb("data").$type<Conversation>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.id] }),
  })
);

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
  createdAt: number;
  updatedAt: number;
  meta_tokens: number;
  role: "assistant" | "user";
  meta_model?: ModelsEnum;
  meta_provider?: string;
  reasoning?: string;
  reasoningParts?: string[];
  sources?: Source[];
  parts?: string[];
  attachments?: string[];
  status?:
    | "submitted"
    | "reasoning"
    | "generating"
    | "done"
    | "errored"
    | "stopped";
  error?: string;
};

export const chatMessageTable = pgTable(
  "chat_message",
  {
    id: varchar("id", { length: 255 }).notNull(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    conversationId: varchar("conversation_id", { length: 255 }).notNull(),
    data: jsonb("data").$type<ChatMessage>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.conversationId, table.id] }),
  })
);

export const eventQueueTable = pgTable("event_queue", {
  id: varchar("id", { length: 255 }).primaryKey(),
  transportId: varchar("transport_id", { length: 255 }).notNull(),
  event: jsonb("event").$type<SyncEvent>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const clientIdTable = pgTable(
  "clients-store",
  {
    clientId: varchar("client_id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 }),
  },
);

export type MessageEntry = typeof chatMessageTable.$inferSelect;

export type Attachment = {
  id: string;
  name: string;
  type: string;
  sent: boolean;
  timestamp: number;
};

export const attachmentTable = pgTable(
  "attachment",
  {
    id: varchar("id", { length: 255 }).notNull(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    conversationId: varchar("conversation_id", { length: 255 }).notNull(),
    data: jsonb("data").$type<Attachment>().notNull(),
    fileData: text("file_data").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.conversationId, table.id] }),
  })
);

export type AttachmentEntry = typeof attachmentTable.$inferSelect;
