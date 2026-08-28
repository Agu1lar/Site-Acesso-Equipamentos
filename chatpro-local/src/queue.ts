import Database from 'better-sqlite3';
import { randomBytes } from 'node:crypto';
import { hostname } from 'node:os';
import type { RemoteOutboxEvent } from './api-client.js';
import { WorkerAlreadyRunningError } from './worker-instance-error.js';

export { WorkerAlreadyRunningError } from './worker-instance-error.js';

function isProcessRunning(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (typeof error === 'object' && error !== null && Reflect.get(error, 'code') === 'EPERM') {
      return true;
    }
    return false;
  }
}

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
  private readonly instanceToken = randomBytes(16).toString('hex');
  private ownsInstanceLock = false;

  constructor(sqlitePath: string) {
    this.db = new Database(sqlitePath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
    this.repairPendingDebounces();
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

      CREATE TABLE IF NOT EXISTS consumer_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS worker_instance_lock (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        pid INTEGER NOT NULL,
        owner_token TEXT NOT NULL,
        started_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS jobs_status_scheduled_idx ON jobs(status, scheduled_at);
    `);
  }

  close() {
    if (this.ownsInstanceLock) {
      this.db
        .prepare('DELETE FROM worker_instance_lock WHERE id = 1 AND owner_token = ?')
        .run(this.instanceToken);
      this.ownsInstanceLock = false;
    }
    this.db.close();
  }

  /** Claims the singleton worker slot for this SQLite queue. */
  acquireInstanceLock(pid = process.pid) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const existing = this.db
        .prepare(`
          SELECT pid, owner_token AS ownerToken, started_at AS startedAt
          FROM worker_instance_lock
          WHERE id = 1
        `)
        .get() as { pid: number; ownerToken: string; startedAt: string } | undefined;

      if (
        existing
        && existing.ownerToken !== this.instanceToken
        && isProcessRunning(existing.pid)
      ) {
        throw new WorkerAlreadyRunningError(existing.pid, existing.startedAt);
      }

      this.db.prepare(`
        INSERT INTO worker_instance_lock (id, pid, owner_token, started_at)
        VALUES (1, ?, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          pid = excluded.pid,
          owner_token = excluded.owner_token,
          started_at = excluded.started_at
      `).run(pid, this.instanceToken);
      this.db.exec('COMMIT');
      this.ownsInstanceLock = true;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /** Stable id used to claim outbox leases on the remote API. */
  getOrCreateConsumerId() {
    const existing = this.db
      .prepare(`SELECT value FROM consumer_meta WHERE key = 'consumer_id'`)
      .get() as { value: string } | undefined;
    if (existing?.value) {
      return existing.value;
    }

    const consumerId = `local-${hostname()}-${randomBytes(4).toString('hex')}`.slice(0, 120);
    this.db
      .prepare(`INSERT INTO consumer_meta (key, value) VALUES ('consumer_id', ?)`)
      .run(consumerId);
    return consumerId;
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
    const analyzeAfter = new Date(Date.now() + debounceMs)
      .toISOString()
      .replace('T', ' ')
      .replace(/\.\d{3}Z$/, '');
    const groupKey = event.leadId ? `lead:${event.leadId}` : `phone:${event.phoneKey}`;

    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO jobs (
        job_id, outbox_id, lead_id, phone_key, payload, scheduled_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertResult = insert.run(
      event.externalId,
      event.outboxId,
      event.leadId,
      event.phoneKey,
      JSON.stringify(event.payload),
      analyzeAfter,
    );

    // Only rearm an existing debounce when this is a genuinely new event. A duplicate
    // pending job may still need its missing debounce repaired after an interrupted run.
    if (insertResult.changes > 0) {
      this.db.prepare(`
        INSERT INTO lead_debounce (group_key, lead_id, phone_key, analyze_after, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(group_key) DO UPDATE SET
          analyze_after = excluded.analyze_after,
          lead_id = excluded.lead_id,
          phone_key = excluded.phone_key,
          updated_at = datetime('now')
      `).run(groupKey, event.leadId, event.phoneKey, analyzeAfter);
    } else {
      this.db.prepare(`
        INSERT INTO lead_debounce (group_key, lead_id, phone_key, analyze_after, updated_at)
        SELECT ?, lead_id, phone_key, scheduled_at, datetime('now')
        FROM jobs
        WHERE outbox_id = ? AND status = 'pending'
        ON CONFLICT(group_key) DO NOTHING
      `).run(groupKey, event.outboxId);
    }

    return { inserted: insertResult.changes > 0 };
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

  /**
   * Removes a completed debounce or preserves/recreates it when a new job arrived
   * while the previous lead analysis was running.
   */
  reconcileLeadDebounce(groupKey: string) {
    const isLead = groupKey.startsWith('lead:');
    const groupValue = groupKey.slice(groupKey.indexOf(':') + 1);
    const pending = isLead
      ? this.db.prepare(`
          SELECT lead_id AS leadId, MAX(phone_key) AS phoneKey, MAX(scheduled_at) AS analyzeAfter
          FROM jobs
          WHERE lead_id = ? AND status = 'pending'
          GROUP BY lead_id
        `).get(Number(groupValue)) as
          | { leadId: number; phoneKey: string; analyzeAfter: string }
          | undefined
      : this.db.prepare(`
          SELECT lead_id AS leadId, phone_key AS phoneKey, MAX(scheduled_at) AS analyzeAfter
          FROM jobs
          WHERE phone_key = ? AND status = 'pending'
          GROUP BY phone_key
        `).get(groupValue) as
          | { leadId: number | null; phoneKey: string; analyzeAfter: string }
          | undefined;

    if (!pending) {
      this.db.prepare('DELETE FROM lead_debounce WHERE group_key = ?').run(groupKey);
      return;
    }

    this.db.prepare(`
      INSERT INTO lead_debounce (group_key, lead_id, phone_key, analyze_after, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(group_key) DO UPDATE SET
        lead_id = excluded.lead_id,
        phone_key = excluded.phone_key,
        analyze_after = excluded.analyze_after,
        updated_at = datetime('now')
    `).run(groupKey, pending.leadId, pending.phoneKey, pending.analyzeAfter);
  }

  /** Restores debounce rows for pending jobs left behind by an interrupted/racing run. */
  repairPendingDebounces() {
    return this.db.prepare(`
      INSERT INTO lead_debounce (group_key, lead_id, phone_key, analyze_after, updated_at)
      SELECT
        CASE
          WHEN lead_id IS NOT NULL THEN 'lead:' || lead_id
          ELSE 'phone:' || phone_key
        END,
        lead_id,
        MAX(phone_key),
        MAX(scheduled_at),
        datetime('now')
      FROM jobs
      WHERE status = 'pending'
      GROUP BY
        CASE
          WHEN lead_id IS NOT NULL THEN 'lead:' || lead_id
          ELSE 'phone:' || phone_key
        END,
        lead_id
      ON CONFLICT(group_key) DO NOTHING
    `).run().changes;
  }

  /** Pushes back analysis for a failed group without dropping pending jobs. */
  rescheduleLeadDebounce(groupKey: string, delayMs: number) {
    const analyzeAfter = new Date(Date.now() + delayMs)
      .toISOString()
      .replace('T', ' ')
      .replace(/\.\d{3}Z$/, '');
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
