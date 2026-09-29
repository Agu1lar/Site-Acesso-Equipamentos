ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "qualification" varchar(40) DEFAULT 'pending' NOT NULL;

ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "qualified_at" timestamp;
