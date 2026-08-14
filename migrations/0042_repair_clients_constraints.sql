ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_client_id_clients_id_fk";
--> statement-breakpoint
ALTER TABLE "client_aliases" DROP CONSTRAINT IF EXISTS "client_aliases_client_id_clients_id_fk";
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_clients_id_fk"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "client_aliases" ADD CONSTRAINT "client_aliases_client_id_clients_id_fk"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
