CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  phone_key TEXT,
  contact_name TEXT,
  is_open BOOLEAN,
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  from_me BOOLEAN NOT NULL,
  body TEXT,
  media_type TEXT,
  sent_at TIMESTAMPTZ,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  media_text TEXT
);

CREATE INDEX IF NOT EXISTS messages_session_sent_idx ON messages (session_id, sent_at);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_text TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS bot_origin BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS bot_outbound (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  window_id TEXT,
  inbound_message_id TEXT,
  chatpro_message_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bot_outbound_session_idx ON bot_outbound (session_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS after_hours_notices (
  session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  window_id TEXT NOT NULL,
  inbound_message_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dry_run BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL,
  error TEXT,
  department_id TEXT,
  unassign_attempts INTEGER NOT NULL DEFAULT 0,
  next_unassign_at TIMESTAMPTZ,
  queue_verified_at TIMESTAMPTZ,
  alerted_at TIMESTAMPTZ,
  original_assing_to TEXT,
  original_date_assign TEXT,
  chatpro_message_id TEXT,
  delivery_status TEXT,
  delivery_confirmed_at TIMESTAMPTZ,
  delivery_alerted_at TIMESTAMPTZ,
  PRIMARY KEY (session_id, window_id)
);

ALTER TABLE after_hours_notices ADD COLUMN IF NOT EXISTS department_id TEXT;
ALTER TABLE after_hours_notices ADD COLUMN IF NOT EXISTS unassign_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE after_hours_notices ADD COLUMN IF NOT EXISTS next_unassign_at TIMESTAMPTZ;
ALTER TABLE after_hours_notices ADD COLUMN IF NOT EXISTS queue_verified_at TIMESTAMPTZ;
ALTER TABLE after_hours_notices ADD COLUMN IF NOT EXISTS alerted_at TIMESTAMPTZ;
ALTER TABLE after_hours_notices ADD COLUMN IF NOT EXISTS original_assing_to TEXT;
ALTER TABLE after_hours_notices ADD COLUMN IF NOT EXISTS original_date_assign TEXT;
ALTER TABLE after_hours_notices ADD COLUMN IF NOT EXISTS chatpro_message_id TEXT;
ALTER TABLE after_hours_notices ADD COLUMN IF NOT EXISTS delivery_status TEXT;
ALTER TABLE after_hours_notices ADD COLUMN IF NOT EXISTS delivery_confirmed_at TIMESTAMPTZ;
ALTER TABLE after_hours_notices ADD COLUMN IF NOT EXISTS delivery_alerted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS after_hours_notices_unassign_idx
  ON after_hours_notices (status, next_unassign_at);

CREATE TABLE IF NOT EXISTS playbook_runs (
  id BIGSERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  source TEXT NOT NULL,
  model TEXT,
  session_count INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  vault_path TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS worker_jobs (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_at TIMESTAMPTZ,
  run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  last_error TEXT,
  result JSONB,
  UNIQUE (kind, idempotency_key)
);

CREATE INDEX IF NOT EXISTS worker_jobs_claim_idx
  ON worker_jobs (status, run_after, id);

CREATE TABLE IF NOT EXISTS worker_cache (
  cache_key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS thread_summaries (
  session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  team TEXT NOT NULL,
  last_message_id TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  source_key TEXT NOT NULL,
  summary TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, team)
);

CREATE INDEX IF NOT EXISTS thread_summaries_team_idx ON thread_summaries (team, updated_at DESC);
