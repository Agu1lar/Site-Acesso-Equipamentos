-- Idempotent repair for analytics dashboard queries (events, daily aggregates, click ids)
CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "event_type" varchar(40) NOT NULL,
  "origin" varchar(80),
  "equipment_slug" varchar(120),
  "equipment_name" varchar(300),
  "pathname" varchar(500),
  "device" varchar(20),
  "utm_source" varchar(120),
  "utm_medium" varchar(120),
  "utm_campaign" varchar(200),
  "utm_content" varchar(200),
  "utm_term" varchar(200),
  "referrer" varchar(500),
  "landing_page" varchar(500),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_created_at_idx" ON "analytics_events" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_event_type_idx" ON "analytics_events" ("event_type");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "analytics_daily" (
  "date" date PRIMARY KEY NOT NULL,
  "page_views" integer DEFAULT 0 NOT NULL,
  "unique_sessions" integer DEFAULT 0 NOT NULL,
  "whatsapp_clicks" integer DEFAULT 0 NOT NULL,
  "quote_submits" integer DEFAULT 0 NOT NULL,
  "top_sources" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "gclid" varchar(255);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "gbraid" varchar(255);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "wbraid" varchar(255);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "last_activity_at" timestamp;
--> statement-breakpoint
UPDATE "leads" SET "last_activity_at" = "created_at" WHERE "last_activity_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN IF NOT EXISTS "gclid" varchar(255);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN IF NOT EXISTS "gbraid" varchar(255);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN IF NOT EXISTS "wbraid" varchar(255);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN IF NOT EXISTS "analytics_consent" boolean;
