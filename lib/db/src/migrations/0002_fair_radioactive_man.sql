CREATE TABLE "attachment" (
	"id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"conversation_id" varchar(255) NOT NULL,
	"data" jsonb NOT NULL,
	"file_data" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "attachment_user_id_conversation_id_id_pk" PRIMARY KEY("user_id","conversation_id","id")
);
