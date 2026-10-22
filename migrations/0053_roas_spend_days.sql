CREATE TABLE IF NOT EXISTS "roas_spend_days" (
  "id" serial PRIMARY KEY NOT NULL,
  "spend_date" date NOT NULL UNIQUE,
  "spend_brl" numeric(14, 2) NOT NULL,
  "fetched_at" timestamp DEFAULT now() NOT NULL
);
