import Database from 'better-sqlite3';
import type { RemoteOutboxEvent } from './api-client.js';

export type QueuedJob = {
  id: number;
  jobId: string;
  outboxId: number;
  leadId: number | null;
  phoneKey: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'done' | 'failed';
  attempts: number;
  scheduledAt: string;
};

export class LocalQueue {
  private readonly db: Database.Database;

  constructor(sqlitePath: string) {
    this.db = new Database(sqlitePath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS poll_cursor (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        since INTEGER NOT NULL DEFAULT 0
      );
      INSERT OR IGNORE INTO poll_cursor (id, since) VALUES (1, 0);

      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL UNIQUE,
        outbox_id INTEGER NOT NULL UNIQUE,
        lead_id INTEGER,
        phone_key TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        scheduled_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS lead_debounce (
        group_key TEXT PRIMARY KEY,
        lead_id INTEGER,
        phone_key TEXT NOT NULL,
        analyze_after TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS jobs_status_scheduled_idx ON jobs(status, scheduled_at);
    `);
  }

  getPollSince() {
    const row = this.db.prepare('SELECT since FROM poll_cursor WHERE id = 1').get() as
      | { since: number }
      | undefined;
    return row?.since ?? 0;
  }

  setPollSince(since: number) {
    this.db.prepare('UPDATE poll_cursor SET since = ? WHERE id = 1').run(since);
  }

  /**
   * Enqueues a remote outbox event idempotently.
   * @param event Remote event from the internal API.
   * @param debounceMs Delay before analysis runs for this lead/phone.
   */
  enqueueRemoteEvent(event: RemoteOutboxEvent, debounceMs: number) {
    const analyzeAfter = new Date(Date.now() + debounceMs).toISOString();
    const groupKey = event.leadId ? `lead:${event.leadId}` : `phone:${event.phoneKey}`;

    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO jobs (
        job_id, outbox_id, lead_id, phone_key, payload, scheduled_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      event.externalId,
      event.outboxId,
      event.leadId,
      event.phoneKey,
      JSON.stringify(event.payload),
      analyzeAfter,
    );

    this.db.prepare(`
      INSERT INTO lead_debounce (group_key, lead_id, phone_key, analyze_after, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(group_key) DO UPDATE SET
        analyze_after = excluded.analyze_after,
        updated_at = datetime('now')
    `).run(groupKey, event.leadId, event.phoneKey, analyzeAfter);
  }

  /** Returns lead/phone groups ready for analysis after debounce. */
  listReadyLeadGroups() {
    return this.db.prepare(`
      SELECT group_key, lead_id, phone_key, analyze_after
      FROM lead_debounce
      WHERE analyze_after <= datetime('now')
      ORDER BY analyze_after ASC
      LIMIT 10
    `).all() as Array<{
      group_key: string;
      lead_id: number | null;
      phone_key: string;
      analyze_after: string;
    }>;
  }

  /** Pending jobs for a lead or phone group. */
  listPendingJobsForGroup(leadId: number | null, phoneKey: string) {
    if (leadId) {
      return this.db.prepare(`
        SELECT
          id,
          job_id AS jobId,
          outbox_id AS outboxId,
          lead_id AS leadId,
          phone_key AS phoneKey,
          payload,
          status,
          attempts,
          scheduled_at AS scheduledAt
        FROM jobs
        WHERE lead_id = ? AND status = 'pending'
        ORDER BY id ASC
      `).all(leadId) as QueuedJob[];
    }

    return this.db.prepare(`
      SELECT
        id,
        job_id AS jobId,
        outbox_id AS outboxId,
        lead_id AS leadId,
        phone_key AS phoneKey,
        payload,
        status,
        attempts,
        scheduled_at AS scheduledAt
      FROM jobs
      WHERE phone_key = ? AND status = 'pending'
      ORDER BY id ASC
    `).all(phoneKey) as QueuedJob[];
  }

  markJobsDone(jobIds: number[]) {
    if (jobIds.length === 0) {
      return;
    }
    const placeholders = jobIds.map(() => '?').join(',');
    this.db.prepare(`
      UPDATE jobs
      SET status = 'done', updated_at = datetime('now')
      WHERE id IN (${placeholders})
    `).run(...jobIds);
  }

  clearLeadDebounce(groupKey: string) {
    this.db.prepare('DELETE FROM lead_debounce WHERE group_key = ?').run(groupKey);
  }

  /** Pushes back analysis for a failed group without dropping pending jobs. */
  rescheduleLeadDebounce(groupKey: string, delayMs: number) {
    const analyzeAfter = new Date(Date.now() + delayMs).toISOString();
    this.db.prepare(`
      UPDATE lead_debounce
      SET analyze_after = ?, updated_at = datetime('now')
      WHERE group_key = ?
    `).run(analyzeAfter, groupKey);
  }

  markJobFailed(jobId: number) {
    this.db.prepare(`
      UPDATE jobs
      SET status = 'failed', attempts = attempts + 1, updated_at = datetime('now')
      WHERE id = ?
    `).run(jobId);
  }

  incrementJobAttempts(jobId: number) {
    this.db.prepare(`
      UPDATE jobs
      SET attempts = attempts + 1, updated_at = datetime('now')
      WHERE id = ?
    `).run(jobId);
  }
}
