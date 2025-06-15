CREATE TABLE "event_queue" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"transport_id" varchar(255) NOT NULL,
	"event" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
