import type { Pool } from 'pg';
import { resolveEnqueueStatus, type JobStatus } from './ops-keys.js';

export type WorkerJobKind = 'playbook' | 'media';

export type WorkerJobRow = {
  id: number;
  kind: WorkerJobKind;
  idempotency_key: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
};

function asPayload(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/**
 * Enqueues a job. Same key is a no-op unless the previous run failed or force is set.
 */
export async function enqueueWorkerJob(options: {
  pool: Pool;
  kind: WorkerJobKind;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  force?: boolean;
}) {
  const existing = await options.pool.query<{ status: JobStatus }>(
    `SELECT status FROM worker_jobs WHERE kind = $1 AND idempotency_key = $2`,
    [options.kind, options.idempotencyKey],
  );
  const next = resolveEnqueueStatus({
    existing: existing.rows[0]?.status ?? null,
    force: options.force === true,
  });
  if (next === 'keep' && existing.rows[0]) {
    return { enqueued: false, status: existing.rows[0].status };
  }

  const result = await options.pool.query<{ id: number; status: JobStatus }>(
    `INSERT INTO worker_jobs (kind, idempotency_key, payload, status, run_after)
     VALUES ($1, $2, $3::jsonb, 'queued', now())
     ON CONFLICT (kind, idempotency_key) DO UPDATE SET
       payload = EXCLUDED.payload,
       status = 'queued',
       attempts = 0,
       run_after = now(),
       locked_at = NULL,
       last_error = NULL
     RETURNING id, status`,
    [options.kind, options.idempotencyKey, JSON.stringify(options.payload)],
  );
  return { enqueued: true, status: result.rows[0]?.status ?? 'queued' };
}

/**
 * Claims the next due job. Stale running leases are stolen after 20 minutes.
 */
export async function claimWorkerJob(pool: Pool, kind?: WorkerJobKind): Promise<WorkerJobRow | null> {
  const result = await pool.query<{
    id: number;
    kind: WorkerJobKind;
    idempotency_key: string;
    payload: unknown;
    status: JobStatus;
    attempts: number;
  }>(
    `UPDATE worker_jobs SET
       status = 'running',
       locked_at = now(),
       attempts = worker_jobs.attempts + 1
     WHERE id = (
       SELECT id FROM worker_jobs
       WHERE run_after <= now()
         AND ($1::text IS NULL OR kind = $1)
         AND (
           status = 'queued'
           OR (status = 'failed' AND attempts < 3)
           OR (status = 'running' AND locked_at < now() - interval '20 minutes')
         )
       ORDER BY CASE kind WHEN 'media' THEN 0 WHEN 'playbook' THEN 1 ELSE 2 END, id
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, kind, idempotency_key, payload, status, attempts`,
    [kind ?? null],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    ...row,
    payload: asPayload(row.payload),
  };
}

/**
 * Marks a job finished. Repeating complete on the same id stays done.
 */
export async function completeWorkerJob(options: {
  pool: Pool;
  jobId: number;
  result: unknown;
}) {
  await options.pool.query(
    `UPDATE worker_jobs SET
       status = 'done',
       finished_at = now(),
       locked_at = NULL,
       last_error = NULL,
       result = $2::jsonb
     WHERE id = $1`,
    [options.jobId, JSON.stringify(options.result ?? {})],
  );
}

/**
 * Marks a job failed and schedules a retry.
 */
export async function failWorkerJob(options: {
  pool: Pool;
  jobId: number;
  error: string;
}) {
  await options.pool.query(
    `UPDATE worker_jobs SET
       status = 'failed',
       finished_at = now(),
       locked_at = NULL,
       last_error = $2,
       run_after = now() + interval '2 minutes'
     WHERE id = $1`,
    [options.jobId, options.error.slice(0, 500)],
  );
}
