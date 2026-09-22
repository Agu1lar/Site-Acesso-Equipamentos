import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { type BotOutboundKind, matchBotOutbound } from './bot-origin.js';

/** Opens a Postgres pool for the local playbook database. */
export function createPlaybookPool(databaseUrl: string) {
  return new Pool({ connectionString: databaseUrl, max: 4 });
}

/**
 * Applies the local schema if tables are missing.
 * @param pool Connected playbook pool.
 */
export async function migratePlaybookSchema(pool: Pool) {
  const sqlPath = resolve(import.meta.dirname, '../sql/001_init.sql');
  await pool.query(readFileSync(sqlPath, 'utf8'));
}

export type SessionRow = {
  id: string;
  phone_key: string | null;
  contact_name: string | null;
  is_open: boolean | null;
  opened_at: Date | null;
  closed_at: Date | null;
  raw?: Record<string, unknown>;
};

export type MessageRow = {
  id: string;
  session_id: string;
  from_me: boolean;
  body: string | null;
  media_type: string | null;
  sent_at: Date | null;
  media_text?: string | null;
  bot_origin?: boolean;
  raw?: Record<string, unknown>;
};

export type UpsertSessionInput = {
  id: string;
  phoneKey: string | null;
  contactName: string | null;
  isOpen: boolean | null;
  openedAt: Date | null;
  closedAt: Date | null;
  raw: Record<string, unknown>;
};

export type UpsertMessageInput = {
  id: string;
  sessionId: string;
  fromMe: boolean;
  body: string | null;
  mediaType: string | null;
  sentAt: Date | null;
  raw: Record<string, unknown>;
};

/**
 * Inserts or updates a ChatPro session in local Postgres.
 */
export async function upsertSession(pool: Pool, session: UpsertSessionInput) {
  await pool.query(
    `INSERT INTO sessions (id, phone_key, contact_name, is_open, opened_at, closed_at, raw, synced_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
     ON CONFLICT (id) DO UPDATE SET
       phone_key = COALESCE(EXCLUDED.phone_key, sessions.phone_key),
       contact_name = EXCLUDED.contact_name,
       is_open = EXCLUDED.is_open,
       opened_at = EXCLUDED.opened_at,
       closed_at = EXCLUDED.closed_at,
       raw = EXCLUDED.raw,
       synced_at = now()`,
    [
      session.id,
      session.phoneKey,
      session.contactName,
      session.isOpen,
      session.openedAt,
      session.closedAt,
      JSON.stringify(session.raw),
    ],
  );
}

/**
 * Inserts or updates a ChatPro message in local Postgres.
 */
export async function upsertMessage(pool: Pool, message: UpsertMessageInput) {
  const botOrigin = message.fromMe
    ? await resolveBotOrigin(pool, {
      messageId: message.id,
      sessionId: message.sessionId,
      body: message.body,
    })
    : false;
  await pool.query(
    `INSERT INTO messages (id, session_id, from_me, body, media_type, sent_at, raw, bot_origin)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
     ON CONFLICT (id) DO UPDATE SET
       body = EXCLUDED.body,
       media_type = EXCLUDED.media_type,
       sent_at = EXCLUDED.sent_at,
       raw = EXCLUDED.raw,
       bot_origin = messages.bot_origin OR EXCLUDED.bot_origin
     WHERE messages.body IS DISTINCT FROM EXCLUDED.body
        OR messages.media_type IS DISTINCT FROM EXCLUDED.media_type
        OR messages.sent_at IS DISTINCT FROM EXCLUDED.sent_at
        OR messages.raw IS DISTINCT FROM EXCLUDED.raw
        OR messages.bot_origin IS DISTINCT FROM (messages.bot_origin OR EXCLUDED.bot_origin)`,
    [
      message.id,
      message.sessionId,
      message.fromMe,
      message.body,
      message.mediaType,
      message.sentAt,
      JSON.stringify(message.raw),
      botOrigin,
    ],
  );
}

async function resolveBotOrigin(pool: Pool, options: {
  messageId: string;
  sessionId: string;
  body: string | null;
}) {
  const result = await pool.query<{
    id: string;
    body: string;
    chatpro_message_id: string | null;
  }>(
    `SELECT id, body, chatpro_message_id
     FROM bot_outbound
     WHERE session_id = $1
     ORDER BY sent_at DESC
     LIMIT 8`,
    [options.sessionId],
  );
  const matched = matchBotOutbound({
    messageId: options.messageId,
    body: options.body,
    rows: result.rows,
  });
  if (!matched) {
    return false;
  }
  await pool.query(
    `UPDATE bot_outbound
     SET chatpro_message_id = COALESCE(chatpro_message_id, $2)
     WHERE id = $1`,
    [matched.id, options.messageId],
  );
  return true;
}

/**
 * Records a WhatsApp line we posted so later sync can mark it as bot origin.
 */
export async function insertBotOutbound(options: {
  pool: Pool;
  id: string;
  sessionId: string;
  kind: BotOutboundKind;
  body: string;
  windowId: string | null;
  inboundMessageId: string | null;
  chatproMessageId: string | null;
}) {
  await options.pool.query(
    `INSERT INTO bot_outbound
      (id, session_id, kind, body, window_id, inbound_message_id, chatpro_message_id, sent_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (id) DO UPDATE SET
       body = EXCLUDED.body,
       inbound_message_id = EXCLUDED.inbound_message_id,
       chatpro_message_id = COALESCE(EXCLUDED.chatpro_message_id, bot_outbound.chatpro_message_id),
       sent_at = now()`,
    [
      options.id,
      options.sessionId,
      options.kind,
      options.body,
      options.windowId,
      options.inboundMessageId,
      options.chatproMessageId,
    ],
  );
}

/**
 * Loads the most recent threads for playbook analysis.
 * Caps distinct WhatsApp numbers; extra sessions of a transferred client stay in.
 */
export async function listThreadsForPlaybook(options: {
  pool: Pool;
  lookbackDays: number;
  maxSessions: number;
  messageLimit?: number;
}) {
  const messageLimit = options.messageLimit ?? 8;
  const sessionResult = await options.pool.query<SessionRow>(
    `WITH ranked AS (
       SELECT
         s.id,
         s.phone_key,
         s.contact_name,
         s.is_open,
         s.opened_at,
         s.closed_at,
         s.raw,
         MAX(COALESCE(m.sent_at, s.opened_at, s.synced_at)) AS last_at
       FROM sessions s
       LEFT JOIN messages m ON m.session_id = s.id
       GROUP BY s.id
     ),
     lead_rank AS (
       SELECT COALESCE(NULLIF(phone_key, ''), id) AS lead_key
       FROM ranked
       GROUP BY COALESCE(NULLIF(phone_key, ''), id)
       ORDER BY MAX(last_at) DESC NULLS LAST
       LIMIT $1
     )
     SELECT r.id, r.phone_key, r.contact_name, r.is_open, r.opened_at, r.closed_at, r.raw
     FROM ranked r
     INNER JOIN lead_rank l
       ON COALESCE(NULLIF(r.phone_key, ''), r.id) = l.lead_key
     ORDER BY r.last_at DESC NULLS LAST`,
    [options.maxSessions],
  );

  const threads = [];
  for (const session of sessionResult.rows) {
    const messageResult = await options.pool.query<MessageRow>(
      `SELECT id, session_id, from_me, body, media_type, sent_at, media_text, raw, bot_origin
       FROM messages
       WHERE session_id = $1
       ORDER BY sent_at DESC NULLS LAST
       LIMIT $2`,
      [session.id, messageLimit],
    );
    threads.push({ session, messages: messageResult.rows.toReversed() });
  }

  return threads;
}

export type ThreadSummaryRow = {
  session_id: string;
  team: string;
  last_message_id: string;
  message_count: number;
  source_key: string;
  summary: string;
};

/**
 * Loads stored ROI-style summaries for the given sessions and team.
 */
export async function listThreadSummaries(options: {
  pool: Pool;
  team: string;
  sessionIds: string[];
}) {
  if (options.sessionIds.length === 0) {
    return [];
  }
  const result = await options.pool.query<ThreadSummaryRow>(
    `SELECT session_id, team, last_message_id, message_count, source_key, summary
     FROM thread_summaries
     WHERE team = $1 AND session_id = ANY($2::text[])`,
    [options.team, options.sessionIds],
  );
  return result.rows;
}

/**
 * Latest summary per session, used in the Obsidian inbox.
 */
export async function listLatestThreadSummaries(options: {
  pool: Pool;
  sessionIds: string[];
}) {
  if (options.sessionIds.length === 0) {
    return [];
  }
  const result = await options.pool.query<{ session_id: string; summary: string }>(
    `SELECT DISTINCT ON (session_id) session_id, summary
     FROM thread_summaries
     WHERE session_id = ANY($1::text[])
     ORDER BY session_id, updated_at DESC`,
    [options.sessionIds],
  );
  return result.rows;
}

/**
 * Upserts one thread summary. Same source_key is a no-op rewrite.
 */
export async function upsertThreadSummary(options: {
  pool: Pool;
  sessionId: string;
  team: string;
  lastMessageId: string;
  messageCount: number;
  sourceKey: string;
  summary: string;
}) {
  await options.pool.query(
    `INSERT INTO thread_summaries
       (session_id, team, last_message_id, message_count, source_key, summary, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (session_id, team) DO UPDATE SET
       last_message_id = EXCLUDED.last_message_id,
       message_count = EXCLUDED.message_count,
       source_key = EXCLUDED.source_key,
       summary = EXCLUDED.summary,
       updated_at = now()`,
    [
      options.sessionId,
      options.team,
      options.lastMessageId,
      options.messageCount,
      options.sourceKey,
      options.summary,
    ],
  );
}

/**
 * Records a finished playbook run.
 */
export async function insertPlaybookRun(options: {
  pool: Pool;
  source: string;
  model: string | null;
  sessionCount: number;
  messageCount: number;
  vaultPath: string;
  notes: string;
}) {
  await options.pool.query(
    `INSERT INTO playbook_runs
      (finished_at, source, model, session_count, message_count, vault_path, notes)
     VALUES (now(), $1, $2, $3, $4, $5, $6)`,
    [
      options.source,
      options.model,
      options.sessionCount,
      options.messageCount,
      options.vaultPath,
      options.notes,
    ],
  );
}

export type InboxFingerprint = {
  messageCount: number;
  lastSentAt: string | null;
  mediaTextCount: number;
};

/**
 * Fingerprint of the local inbox used to skip a Haiku rewrite when nothing changed.
 */
export async function readInboxFingerprint(pool: Pool): Promise<InboxFingerprint> {
  const result = await pool.query<{ n: string; last: Date | null; media: string }>(
    `SELECT COUNT(*)::text AS n,
            MAX(sent_at) AS last,
            COUNT(media_text) FILTER (WHERE media_text IS NOT NULL AND media_text <> '')::text AS media
     FROM messages`,
  );
  const row = result.rows[0];
  return {
    messageCount: Number(row?.n ?? 0),
    lastSentAt: row?.last ? row.last.toISOString() : null,
    mediaTextCount: Number(row?.media ?? 0),
  };
}

/**
 * Latest playbook generation, if any.
 */
export async function readLastPlaybookRun(pool: Pool) {
  const result = await pool.query<{
    finished_at: Date | null;
    message_count: number;
  }>(
    `SELECT finished_at, message_count
     FROM playbook_runs
     ORDER BY id DESC
     LIMIT 1`,
  );
  return result.rows[0] ?? null;
}

export type AfterHoursSessionRow = SessionRow & {
  raw: Record<string, unknown>;
};

/**
 * Loads recent threads with raw session flags for the after-hours worker.
 */
export async function listThreadsForAfterHours(options: {
  pool: Pool;
  maxSessions: number;
  allowedPhones?: string[];
}) {
  const allowedPhones = options.allowedPhones ?? [];
  const sessionResult = await options.pool.query<AfterHoursSessionRow>(
    `SELECT s.id, s.phone_key, s.contact_name, s.is_open, s.opened_at, s.closed_at, s.raw
     FROM sessions s
     LEFT JOIN messages m ON m.session_id = s.id
     GROUP BY s.id
     HAVING MAX(COALESCE(m.sent_at, s.opened_at, s.synced_at)) IS NOT NULL
     ORDER BY
       MAX(COALESCE(m.sent_at, s.opened_at, s.synced_at)) DESC NULLS LAST,
       CASE
         WHEN s.phone_key = ANY($2::text[]) THEN 0
         ELSE 1
       END
     LIMIT $1`,
    [options.maxSessions, allowedPhones],
  );

  const extra = allowedPhones.length === 0
    ? { rows: [] as AfterHoursSessionRow[] }
    : await options.pool.query<AfterHoursSessionRow>(
      `SELECT DISTINCT s.id, s.phone_key, s.contact_name, s.is_open, s.opened_at, s.closed_at, s.raw
       FROM sessions s
       LEFT JOIN messages m ON m.session_id = s.id
       WHERE s.phone_key = ANY($1::text[])
          OR right(regexp_replace(coalesce(s.phone_key, ''), '\\D', '', 'g'), 11) = ANY($2::text[])
          OR right(regexp_replace(coalesce(s.phone_key, ''), '\\D', '', 'g'), 10) = ANY($3::text[])
          OR right(regexp_replace(coalesce(m.raw->>'number', m.raw->>'phone', m.raw->>'wa_id', ''), '\\D', '', 'g'), 11) = ANY($2::text[])
          OR right(regexp_replace(coalesce(m.raw->>'number', m.raw->>'phone', m.raw->>'wa_id', ''), '\\D', '', 'g'), 10) = ANY($3::text[])
          OR m.id LIKE ANY($4::text[])`,
      [
        allowedPhones,
        allowedPhones.map((phone) => phone.slice(-11)),
        allowedPhones.map((phone) => phone.slice(-10)),
        allowedPhones.map(
          (phone) => `%${Buffer.from(phone).toString('base64').replace(/=+$/u, '')}%`,
        ),
      ],
    );

  const byId = new Map<string, AfterHoursSessionRow>();
  for (const session of [...extra.rows, ...sessionResult.rows]) {
    byId.set(session.id, session);
  }

  const threads = [];
  for (const session of byId.values()) {
    const messageResult = await options.pool.query<MessageRow>(
      `SELECT id, session_id, from_me, body, media_type, sent_at, bot_origin, raw
       FROM messages
       WHERE session_id = $1
       ORDER BY sent_at DESC NULLS LAST
       LIMIT 40`,
      [session.id],
    );
    threads.push({ session, messages: messageResult.rows.toReversed() });
  }

  return threads;
}

/**
 * Session ids already linked to the live allowlist, for a fast after-hours refresh.
 * Also recovers chats whose session.phone_key is empty but messages carry the number.
 */
export async function listKnownAfterHoursSessionIds(options: {
  pool: Pool;
  allowedPhones: string[];
}) {
  if (options.allowedPhones.length === 0) {
    return [];
  }
  const tails11 = options.allowedPhones.map((phone) => phone.slice(-11));
  const tails10 = options.allowedPhones.map((phone) => phone.slice(-10));
  const wamidNeedles = options.allowedPhones.map(
    (phone) => `%${Buffer.from(phone).toString('base64').replace(/=+$/u, '')}%`,
  );
  const result = await options.pool.query<{ id: string }>(
    `SELECT DISTINCT s.id
     FROM sessions s
     LEFT JOIN messages m ON m.session_id = s.id
     WHERE s.phone_key = ANY($1::text[])
        OR right(regexp_replace(coalesce(s.phone_key, ''), '\\D', '', 'g'), 11) = ANY($2::text[])
        OR right(regexp_replace(coalesce(s.phone_key, ''), '\\D', '', 'g'), 10) = ANY($3::text[])
        OR right(regexp_replace(coalesce(m.raw->>'number', m.raw->>'phone', m.raw->>'wa_id', ''), '\\D', '', 'g'), 11) = ANY($2::text[])
        OR right(regexp_replace(coalesce(m.raw->>'number', m.raw->>'phone', m.raw->>'wa_id', ''), '\\D', '', 'g'), 10) = ANY($3::text[])
        OR m.id LIKE ANY($4::text[])`,
    [
      options.allowedPhones,
      tails11,
      tails10,
      wamidNeedles,
    ],
  );
  return result.rows.map((row) => row.id);
}

export type AfterHoursNoticeRow = {
  session_id: string;
  window_id: string;
  status: string;
  dry_run: boolean;
  department_id: string | null;
  unassign_attempts: number;
  next_unassign_at: Date | null;
  queue_verified_at: Date | null;
  alerted_at: Date | null;
  error: string | null;
  original_assing_to: string | null;
  original_date_assign: string | null;
  chatpro_message_id: string | null;
  delivery_status: string | null;
  delivery_confirmed_at: Date | null;
  delivery_alerted_at: Date | null;
};

/**
 * Loads a stored after-hours notice for this session and closed window.
 */
export async function findAfterHoursNotice(options: {
  pool: Pool;
  sessionId: string;
  windowId: string;
}) {
  const result = await options.pool.query<AfterHoursNoticeRow>(
    `SELECT session_id, window_id, status, dry_run, department_id,
            unassign_attempts, next_unassign_at, queue_verified_at, alerted_at, error,
            original_assing_to, original_date_assign, chatpro_message_id,
            delivery_status, delivery_confirmed_at, delivery_alerted_at
     FROM after_hours_notices
     WHERE session_id = $1 AND window_id = $2`,
    [options.sessionId, options.windowId],
  );
  return result.rows[0] ?? null;
}

/** Loads every due post-send handoff independently of business hours and inbox limits. */
export async function listPendingAfterHoursHandoffs(options: { pool: Pool; now: Date }) {
  const result = await options.pool.query<AfterHoursNoticeRow>(
    `SELECT session_id, window_id, status, dry_run, department_id,
            unassign_attempts, next_unassign_at, queue_verified_at, alerted_at, error,
            original_assing_to, original_date_assign, chatpro_message_id,
            delivery_status, delivery_confirmed_at, delivery_alerted_at
     FROM after_hours_notices
     WHERE status = 'sent_awaiting_unassign'
       AND (next_unassign_at IS NULL OR next_unassign_at <= $1)
     ORDER BY COALESCE(next_unassign_at, sent_at), sent_at`,
    [options.now],
  );
  return result.rows;
}

/** Prevents a second notice while an earlier window is still unresolved. */
export async function findUnresolvedAfterHoursNotice(options: { pool: Pool; sessionId: string }) {
  const result = await options.pool.query<AfterHoursNoticeRow>(
    `SELECT session_id, window_id, status, dry_run, department_id,
            unassign_attempts, next_unassign_at, queue_verified_at, alerted_at, error,
            original_assing_to, original_date_assign, chatpro_message_id,
            delivery_status, delivery_confirmed_at, delivery_alerted_at
     FROM after_hours_notices
     WHERE session_id = $1 AND status = 'sent_awaiting_unassign'
     ORDER BY sent_at DESC
     LIMIT 1`,
    [options.sessionId],
  );
  return result.rows[0] ?? null;
}

/** Loads API-accepted sends that still need provider delivery reconciliation. */
export async function listUnconfirmedAfterHoursDeliveries(options: { pool: Pool }) {
  const result = await options.pool.query<AfterHoursNoticeRow>(
    `SELECT session_id, window_id, status, dry_run, department_id,
            unassign_attempts, next_unassign_at, queue_verified_at, alerted_at, error,
            original_assing_to, original_date_assign, chatpro_message_id,
            delivery_status, delivery_confirmed_at, delivery_alerted_at
     FROM after_hours_notices
     WHERE chatpro_message_id IS NOT NULL
       AND delivery_confirmed_at IS NULL
       AND delivery_status <> 'provider_failed'
       AND sent_at >= now() - interval '30 days'
     ORDER BY sent_at`,
  );
  return result.rows;
}

/** Persists the status returned by ChatPro for a sent message. */
export async function updateAfterHoursDelivery(options: {
  pool: Pool;
  sessionId: string;
  windowId: string;
  deliveryStatus: string;
  confirmed: boolean;
  failed: boolean;
  error: string | null;
}) {
  await options.pool.query(
    `UPDATE after_hours_notices
     SET delivery_status = $3,
         delivery_confirmed_at = CASE WHEN $4 THEN now() ELSE delivery_confirmed_at END,
         delivery_alerted_at = CASE WHEN $5 THEN COALESCE(delivery_alerted_at, now()) ELSE delivery_alerted_at END,
         error = CASE WHEN $5 THEN $6 ELSE error END
     WHERE session_id = $1 AND window_id = $2`,
    [
      options.sessionId,
      options.windowId,
      options.deliveryStatus,
      options.confirmed,
      options.failed,
      options.error,
    ],
  );
}

/**
 * Records an after-hours send or dry-run so the same window is not notified twice.
 */
export async function upsertAfterHoursNotice(options: {
  pool: Pool;
  sessionId: string;
  windowId: string;
  inboundMessageId: string;
  dryRun: boolean;
  status: 'sent_awaiting_unassign' | 'queued_verified' | 'dry_run' | 'failed' | 'human_claimed' | 'transferred';
  error: string | null;
  departmentId?: string | null;
  unassignAttempts?: number;
  nextUnassignAt?: Date | null;
  originalAssigneeId?: string | null;
  originalAssignedAt?: string | null;
  chatproMessageId?: string | null;
  deliveryStatus?: string | null;
}) {
  await options.pool.query(
    `INSERT INTO after_hours_notices
      (session_id, window_id, inbound_message_id, sent_at, dry_run, status, error,
       department_id, unassign_attempts, next_unassign_at, original_assing_to,
       original_date_assign, chatpro_message_id, delivery_status)
     VALUES ($1, $2, $3, now(), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (session_id, window_id) DO UPDATE SET
       inbound_message_id = EXCLUDED.inbound_message_id,
       sent_at = now(),
       dry_run = EXCLUDED.dry_run,
       status = EXCLUDED.status,
       error = EXCLUDED.error,
       department_id = COALESCE(EXCLUDED.department_id, after_hours_notices.department_id),
       unassign_attempts = EXCLUDED.unassign_attempts,
       next_unassign_at = EXCLUDED.next_unassign_at,
       original_assing_to = COALESCE(after_hours_notices.original_assing_to, EXCLUDED.original_assing_to),
       original_date_assign = COALESCE(after_hours_notices.original_date_assign, EXCLUDED.original_date_assign),
       chatpro_message_id = COALESCE(after_hours_notices.chatpro_message_id, EXCLUDED.chatpro_message_id),
       delivery_status = COALESCE(EXCLUDED.delivery_status, after_hours_notices.delivery_status)`,
    [
      options.sessionId,
      options.windowId,
      options.inboundMessageId,
      options.dryRun,
      options.status,
      options.error,
      options.departmentId ?? null,
      options.unassignAttempts ?? 0,
      options.nextUnassignAt ?? null,
      options.originalAssigneeId ?? null,
      options.originalAssignedAt ?? null,
      options.chatproMessageId ?? null,
      options.deliveryStatus ?? null,
    ],
  );
}

/** Persists an unassign attempt; completion is reserved for a verified ChatPro state. */
export async function updateAfterHoursQueueHandoff(options: {
  pool: Pool;
  sessionId: string;
  windowId: string;
  status: 'sent_awaiting_unassign' | 'queued_verified' | 'human_claimed' | 'transferred';
  departmentId: string | null;
  attempts: number;
  error: string | null;
  nextUnassignAt: Date | null;
  shouldAlert: boolean;
}) {
  await options.pool.query(
    `UPDATE after_hours_notices
     SET status = $3,
         department_id = COALESCE($4, department_id),
         unassign_attempts = $5,
         error = $6,
         next_unassign_at = $7,
         queue_verified_at = CASE WHEN $3 = 'queued_verified' THEN now() ELSE queue_verified_at END,
         alerted_at = CASE
           WHEN $8 AND alerted_at IS NULL THEN now()
           ELSE alerted_at
         END
     WHERE session_id = $1 AND window_id = $2`,
    [
      options.sessionId,
      options.windowId,
      options.status,
      options.departmentId,
      options.attempts,
      options.error,
      options.nextUnassignAt,
      options.shouldAlert,
    ],
  );
}

/** Marks a pre-send routing failure as alerted without pretending the notice was sent. */
export async function markAfterHoursNoticeAlerted(options: {
  pool: Pool;
  sessionId: string;
  windowId: string;
}) {
  await options.pool.query(
    `UPDATE after_hours_notices
     SET alerted_at = COALESCE(alerted_at, now())
     WHERE session_id = $1 AND window_id = $2`,
    [options.sessionId, options.windowId],
  );
}

/**
 * Loads one message for a queued media job.
 */
export async function findMessageById(pool: Pool, messageId: string) {
  const result = await pool.query<MessageRow>(
    `SELECT id, session_id, from_me, body, media_type, sent_at, media_text, raw, bot_origin
     FROM messages WHERE id = $1`,
    [messageId],
  );
  return result.rows[0] ?? null;
}

/**
 * Stores a transcription or caption so the next playbook run does not re-download the file.
 */
export async function updateMessageMediaText(options: {
  pool: Pool;
  messageId: string;
  mediaText: string;
}) {
  await options.pool.query(
    `UPDATE messages SET media_text = $2 WHERE id = $1`,
    [options.messageId, options.mediaText],
  );
}
