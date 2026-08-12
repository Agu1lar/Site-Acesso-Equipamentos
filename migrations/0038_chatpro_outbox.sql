CREATE TABLE IF NOT EXISTS "chatpro_outbox" (
  "id" serial PRIMARY KEY NOT NULL,
  "message_id" integer NOT NULL,
  "external_id" varchar(120) NOT NULL,
  "lead_id" integer,
  "phone_key" varchar(20) NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "delivered_at" timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS "chatpro_outbox_external_id_uidx" ON "chatpro_outbox" ("external_id");
CREATE INDEX IF NOT EXISTS "chatpro_outbox_pending_idx" ON "chatpro_outbox" ("delivered_at", "id");
