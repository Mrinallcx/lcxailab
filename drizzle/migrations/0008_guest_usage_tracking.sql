CREATE TABLE IF NOT EXISTS "guest_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"ip_address" text NOT NULL,
	"user_agent" text,
	"search_count" integer NOT NULL DEFAULT 0,
	"date" timestamp DEFAULT now() NOT NULL,
	"reset_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
); 