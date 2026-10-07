-- Keep only the newest ROI summary for each lead.
WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "lead_id"
      ORDER BY "evaluated_at" DESC, "id" DESC
    ) AS position
  FROM "chatpro_lead_evaluations"
)
DELETE FROM "chatpro_lead_evaluations" AS evaluation
USING ranked
WHERE evaluation."id" = ranked."id"
  AND ranked.position > 1;--> statement-breakpoint

-- Delivered events duplicate data already consumed by the local worker.
DELETE FROM "chatpro_outbox"
WHERE "delivered_at" IS NOT NULL
  AND "delivered_at" < now() - interval '15 days';--> statement-breakpoint

-- Preserve messages whose outbox delivery is still pending.
DELETE FROM "chatpro_messages" AS message
WHERE coalesce(message."event_at", message."created_at") < now() - interval '15 days'
  AND NOT EXISTS (
    SELECT 1
    FROM "chatpro_outbox" AS outbox
    WHERE outbox."message_id" = message."id"
      AND outbox."delivered_at" IS NULL
  );--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "chatpro_messages_lead_id_id_idx"
  ON "chatpro_messages" ("lead_id", "id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chatpro_lead_evaluations_latest_idx"
  ON "chatpro_lead_evaluations" ("lead_id", "evaluated_at" DESC, "id" DESC);
