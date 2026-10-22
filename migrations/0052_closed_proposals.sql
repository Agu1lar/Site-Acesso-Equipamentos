CREATE TABLE IF NOT EXISTS "closed_proposals" (
  "id" serial PRIMARY KEY NOT NULL,
  "proposal_id" varchar(40) NOT NULL UNIQUE,
  "numero" varchar(40) NOT NULL,
  "approved_at" timestamp NOT NULL,
  "valor_total" numeric(14, 2) NOT NULL,
  "match_kind" varchar(20) NOT NULL,
  "lead_id" integer,
  "traffic" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
