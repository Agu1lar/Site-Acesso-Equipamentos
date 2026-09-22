import { join } from 'node:path';
import type { Pool } from 'pg';
import { analyzeThreadsWithClaude } from './analyze.js';
import {
  partitionAttendanceThreads,
  vaultFolderForTeam,
  type AttendanceTeam,
} from './attendance-team.js';
import type { PlaybookConfig } from './config.js';
import {
  findMessageById,
  insertPlaybookRun,
  listThreadsForPlaybook,
  type InboxFingerprint,
  type MessageRow,
} from './db.js';
import { enrichOneMessage } from './enrich.js';
import { extractPlaybookMedia } from './media.js';
import { applyOperationalModules, listOperationalModules } from './operational-modules.js';
import { writePlaybookFingerprint } from './ops-cache.js';
import { fingerprintKey } from './ops-keys.js';
import {
  claimWorkerJob,
  completeWorkerJob,
  failWorkerJob,
  type WorkerJobKind,
  type WorkerJobRow,
} from './ops-queue.js';
import { writeTriageLearnFromThreads } from './triage-learn.js';
import { readPriorPlaybookContext, writePlaybookVault } from './vault.js';

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function readTeam(payload: Record<string, unknown>): AttendanceTeam | null {
  const team = payload.team;
  if (team === 'comercial' || team === 'logistica' || team === 'mecanica') {
    return team;
  }
  return null;
}

/**
 * True when a message still needs transcription or caption work.
 */
export function messageNeedsMediaJob(message: MessageRow) {
  if (message.media_text?.trim()) {
    return false;
  }
  return extractPlaybookMedia({
    raw: asRecord(message.raw),
    mediaType: message.media_type,
  }).kind !== 'none';
}

async function runPlaybookJob(options: {
  pool: Pool;
  config: PlaybookConfig;
  job: WorkerJobRow;
  fingerprint: InboxFingerprint;
}) {
  const team = readTeam(options.job.payload);
  if (!team) {
    throw new Error('playbook_job_missing_team');
  }
  if (!options.config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is required');
  }
  const threads = await listThreadsForPlaybook({
    pool: options.pool,
    lookbackDays: options.config.lookbackDays,
    maxSessions: options.config.maxSessions,
    messageLimit: 80,
  });
  const teamThreads = partitionAttendanceThreads(threads).playbook[team];
  if (teamThreads.length === 0) {
    return { team, skipped: 'sem-conversas' };
  }
  const folder = vaultFolderForTeam(options.config.obsidianCompanyFolder, team);
  const existing = listOperationalModules({
    vaultPath: options.config.obsidianVaultPath,
    folder,
  }).map((module) => ({
    id: module.id,
    title: module.title,
    excerpt: module.body.replace(/^---[\s\S]*?---\s*/u, '').replace(/\s+/gu, ' ').trim().slice(0, 180),
  }));
  const analysis = await analyzeThreadsWithClaude({
    pool: options.pool,
    apiKey: options.config.anthropicApiKey,
    model: options.config.anthropicModel,
    threads: teamThreads,
    team,
    existingModules: existing,
    priorPlaybook: readPriorPlaybookContext({
      vaultPath: options.config.obsidianVaultPath,
      folder,
    }),
  });
  const vault = writePlaybookVault({
    vaultPath: options.config.obsidianVaultPath,
    folder,
    playbook: analysis.playbook,
    team,
  });
  if (team === 'comercial') {
    writeTriageLearnFromThreads({
      vaultPath: options.config.obsidianVaultPath,
      folder,
      threads: teamThreads,
    });
  }
  const modules = applyOperationalModules({
    vaultPath: options.config.obsidianVaultPath,
    folder,
    team,
    plan: analysis.modulePlan,
  });
  await insertPlaybookRun({
    pool: options.pool,
    source: `chatpro-chat:${team}`,
    model: options.config.anthropicModel,
    sessionCount: teamThreads.length,
    messageCount: options.fingerprint.messageCount,
    vaultPath: join(options.config.obsidianVaultPath, ...options.config.obsidianCompanyFolder.split(/[\\/]/u)),
    notes: `${vault.files.join(',')};modules:${JSON.stringify(modules)}`,
  });
  await writePlaybookFingerprint(options.pool, fingerprintKey(options.fingerprint));
  return { team, files: vault.files, modules };
}

async function runMediaJob(options: {
  pool: Pool;
  config: PlaybookConfig;
  job: WorkerJobRow;
}) {
  const messageId = typeof options.job.payload.messageId === 'string'
    ? options.job.payload.messageId
    : null;
  if (!messageId) {
    throw new Error('media_job_missing_message');
  }
  const message = await findMessageById(options.pool, messageId);
  if (!message) {
    return { skipped: 'missing' };
  }
  const kind = await enrichOneMessage({
    pool: options.pool,
    config: options.config,
    message,
  });
  return { messageId, kind };
}

/**
 * Runs one claimed worker job. Completes or fails the row.
 */
export async function executeWorkerJob(options: {
  pool: Pool;
  config: PlaybookConfig;
  job: WorkerJobRow;
  fingerprint: InboxFingerprint;
}) {
  try {
    const result = options.job.kind === 'playbook'
      ? await runPlaybookJob(options)
      : await runMediaJob(options);
    await completeWorkerJob({
      pool: options.pool,
      jobId: options.job.id,
      result,
    });
    return { ok: true as const, kind: options.job.kind, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failWorkerJob({
      pool: options.pool,
      jobId: options.job.id,
      error: message,
    });
    return { ok: false as const, kind: options.job.kind, error: message };
  }
}

export type DrainJobResult = Awaited<ReturnType<typeof executeWorkerJob>>;

/**
 * Claims and runs due jobs until the limit or the queue is empty.
 */
export async function drainWorkerJobs(options: {
  pool: Pool;
  config: PlaybookConfig;
  fingerprint: InboxFingerprint;
  limit: number;
  kind?: WorkerJobKind;
}) {
  const results: DrainJobResult[] = [];
  for (let i = 0; i < options.limit; i += 1) {
    const job = await claimWorkerJob(options.pool, options.kind);
    if (!job) {
      break;
    }
    const executed = await executeWorkerJob({
      pool: options.pool,
      config: options.config,
      job,
      fingerprint: options.fingerprint,
    });
    results.push(executed);
    const label = executed.ok ? 'ok' : executed.error;
    console.log('[worker] job', { kind: executed.kind, ok: executed.ok, detail: label });
  }
  return results;
}
