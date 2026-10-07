UPDATE "equipment"
SET "slug" = 'plataforma-elevatoria-s80-j'
WHERE "slug" = 'plataforma-elevatoria-s60'
  AND NOT EXISTS (
    SELECT 1 FROM "equipment" WHERE "slug" = 'plataforma-elevatoria-s80-j'
  );

INSERT INTO "equipment_slug_redirects" ("from_slug", "to_slug", "equipment_id")
SELECT
  'plataforma-elevatoria-s60',
  'plataforma-elevatoria-s80-j',
  e.id
FROM "equipment" e
WHERE e.slug = 'plataforma-elevatoria-s80-j'
ON CONFLICT ("from_slug") DO UPDATE
SET
  "to_slug" = EXCLUDED."to_slug",
  "equipment_id" = EXCLUDED."equipment_id",
  "created_at" = now();
