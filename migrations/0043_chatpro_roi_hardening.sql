-- Outbox lease so only one local consumer claims each undelivered event.
ALTER TABLE "chatpro_outbox" ADD COLUMN IF NOT EXISTS "locked_at" timestamp;--> statement-breakpoint
ALTER TABLE "chatpro_outbox" ADD COLUMN IF NOT EXISTS "locked_by" varchar(120);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chatpro_outbox_pending_lock_idx"
  ON "chatpro_outbox" ("delivered_at", "locked_at", "id");--> statement-breakpoint

-- Keep one evaluation per lead + last message watermark (prefer newest row).
DELETE FROM "chatpro_lead_evaluations" AS older
USING "chatpro_lead_evaluations" AS newer
WHERE older."lead_id" = newer."lead_id"
  AND older."last_message_id" IS NOT NULL
  AND older."last_message_id" = newer."last_message_id"
  AND older."id" < newer."id";--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "chatpro_lead_evaluations_lead_last_message_uidx"
  ON "chatpro_lead_evaluations" ("lead_id", "last_message_id")
  WHERE "last_message_id" IS NOT NULL;
