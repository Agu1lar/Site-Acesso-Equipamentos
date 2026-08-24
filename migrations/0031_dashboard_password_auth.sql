ALTER TABLE "dashboard_allowlist" ADD COLUMN IF NOT EXISTS "password_hash" varchar(255);

-- Dashboard credentials are provisioned through an authenticated administrative
-- workflow. Never seed reusable e-mails or password hashes in migrations.
