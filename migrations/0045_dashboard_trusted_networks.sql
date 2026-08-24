CREATE TABLE IF NOT EXISTS "dashboard_trusted_networks" (
  "id" serial PRIMARY KEY NOT NULL,
  "device_id" varchar(120) NOT NULL,
  "label" varchar(160) NOT NULL,
  "ip_address" varchar(80) NOT NULL,
  "last_seen_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "dashboard_trusted_networks_device_uidx"
  ON "dashboard_trusted_networks" USING btree ("device_id");

CREATE UNIQUE INDEX IF NOT EXISTS "dashboard_trusted_networks_ip_uidx"
  ON "dashboard_trusted_networks" USING btree ("ip_address");
