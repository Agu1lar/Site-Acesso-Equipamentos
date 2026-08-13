-- Make leads.email optional (WhatsApp campaign clicks have phone only).
ALTER TABLE "leads" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
-- Clear synthetic inbound emails generated for WhatsApp attribution.
UPDATE "leads"
SET "email" = NULL
WHERE "email" ILIKE 'wa+%@inbound.acessoequipamentos.com.br';
