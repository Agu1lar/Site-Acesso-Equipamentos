CREATE TABLE IF NOT EXISTS "google_ads_offline_conversions" (
  "id" serial PRIMARY KEY NOT NULL,
  "analytics_event_id" integer,
  "lead_id" integer,
  "click_id" varchar(255) NOT NULL,
  "click_id_type" varchar(20) NOT NULL,
  "conversion_action" varchar(255) NOT NULL,
  "order_id" varchar(80) NOT NULL,
  "status" varchar(40) DEFAULT 'pending' NOT NULL,
  "request_payload" jsonb,
  "response_payload" jsonb,
  "error_message" text,
  "uploaded_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "google_ads_offline_conversions" ADD CONSTRAINT "google_ads_offline_conversions_analytics_event_id_analytics_events_id_fk" FOREIGN KEY ("analytics_event_id") REFERENCES "public"."analytics_events"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "google_ads_offline_conversions" ADD CONSTRAINT "google_ads_offline_conversions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "google_ads_offline_conversions_analytics_event_uidx" ON "google_ads_offline_conversions" USING btree ("analytics_event_id");
CREATE UNIQUE INDEX IF NOT EXISTS "google_ads_offline_conversions_order_uidx" ON "google_ads_offline_conversions" USING btree ("order_id");
