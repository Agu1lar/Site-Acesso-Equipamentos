CREATE TABLE IF NOT EXISTS "whatsapp_attribution_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "token" varchar(12) NOT NULL,
  "origin" varchar(80) NOT NULL,
  "equipment_slug" varchar(120),
  "equipment_name" varchar(300),
  "pathname" varchar(500),
  "device" varchar(20),
  "utm_source" varchar(120),
  "utm_medium" varchar(120),
  "utm_campaign" varchar(200),
  "utm_content" varchar(200),
  "utm_term" varchar(200),
  "gclid" varchar(255),
  "gbraid" varchar(255),
  "wbraid" varchar(255),
  "referrer" varchar(500),
  "landing_page" varchar(500),
  "lead_id" integer,
  "phone_key" varchar(20),
  "claimed_at" timestamp,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_attribution_tokens_token_uidx"
  ON "whatsapp_attribution_tokens" ("token");

CREATE INDEX IF NOT EXISTS "whatsapp_attribution_tokens_unclaimed_idx"
  ON "whatsapp_attribution_tokens" ("token")
  WHERE "claimed_at" IS NULL;
