CREATE TABLE IF NOT EXISTS "chatpro_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "lead_id" integer,
  "phone_key" varchar(20) NOT NULL,
  "chatpro_event" varchar(80) NOT NULL,
  "from_me" boolean DEFAULT false NOT NULL,
  "message_text" text,
  "media_type" varchar(40),
  "media_url" text,
  "media_filename" varchar(255),
  "media_mimetype" varchar(120),
  "external_id" varchar(120),
  "raw_payload" jsonb,
  "event_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "chatpro_messages_external_id_uidx" ON "chatpro_messages" ("external_id");

CREATE TABLE IF NOT EXISTS "chatpro_lead_evaluations" (
  "id" serial PRIMARY KEY NOT NULL,
  "lead_id" integer NOT NULL,
  "evaluated_at" timestamp DEFAULT now() NOT NULL,
  "message_count" integer DEFAULT 0 NOT NULL,
  "last_message_id" integer,
  "model" varchar(80) NOT NULL,
  "trigger" varchar(40) DEFAULT 'daily_worker' NOT NULL,
  "result" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "chatpro_messages_lead_id_idx" ON "chatpro_messages" ("lead_id");
CREATE INDEX IF NOT EXISTS "chatpro_messages_phone_key_event_at_idx" ON "chatpro_messages" ("phone_key", "event_at");
CREATE INDEX IF NOT EXISTS "chatpro_lead_evaluations_lead_id_evaluated_at_idx" ON "chatpro_lead_evaluations" ("lead_id", "evaluated_at");
