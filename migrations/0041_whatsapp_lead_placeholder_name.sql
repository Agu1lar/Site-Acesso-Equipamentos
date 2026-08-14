-- Use a neutral label for WhatsApp leads that have not identified themselves yet.
UPDATE "leads"
SET "name" = 'Lead ainda não identificado'
WHERE "name" = 'Lead WhatsApp (campanha)';
