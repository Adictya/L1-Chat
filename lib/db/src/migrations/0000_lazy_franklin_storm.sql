CREATE TABLE "account" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "account_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"oauth_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"conversation_id" varchar(255) NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_message_user_id_conversation_id_id_pk" PRIMARY KEY("user_id","conversation_id","id")
);
--> statement-breakpoint
CREATE TABLE "clients-store" (
	"client_id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_user_id_id_pk" PRIMARY KEY("user_id","id"),
	CONSTRAINT "conversation_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "event_queue" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"transport_id" varchar(255) NOT NULL,
	"event" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "account_oauth_id_index" ON "account" USING btree ("oauth_id");