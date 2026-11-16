ALTER TABLE "closed_proposals" ADD COLUMN IF NOT EXISTS "segment_plataformas" numeric(14, 2);
ALTER TABLE "closed_proposals" ADD COLUMN IF NOT EXISTS "segment_guindastes" numeric(14, 2);
ALTER TABLE "closed_proposals" ADD COLUMN IF NOT EXISTS "segment_andaimes" numeric(14, 2);
ALTER TABLE "closed_proposals" ADD COLUMN IF NOT EXISTS "segment_ferramentas" numeric(14, 2);
