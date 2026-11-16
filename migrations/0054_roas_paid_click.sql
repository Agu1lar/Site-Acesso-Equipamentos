ALTER TABLE "closed_proposals" ALTER COLUMN "approved_at" DROP NOT NULL;
ALTER TABLE "closed_proposals" ADD COLUMN IF NOT EXISTS "proposal_created_at" timestamp;
ALTER TABLE "closed_proposals" ADD COLUMN IF NOT EXISTS "closed" boolean DEFAULT true NOT NULL;
UPDATE "closed_proposals"
SET "proposal_created_at" = "approved_at"
WHERE "proposal_created_at" IS NULL
  AND "approved_at" IS NOT NULL;
