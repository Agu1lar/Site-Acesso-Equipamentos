ALTER TABLE "whatsapp_attribution_tokens" ADD COLUMN "meta_context" jsonb;
--> statement-breakpoint
ALTER TABLE "whatsapp_attribution_tokens" ADD COLUMN "meta_contact_sent_at" timestamp;
