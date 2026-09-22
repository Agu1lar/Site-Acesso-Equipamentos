import type { Pool } from 'pg';
import {
  ATTENDANCE_TEAMS,
  classifyAttendanceDesk,
  partitionAttendanceThreads,
  vaultFolderForTeam,
  vaultTeamForDesk,
  type AttendanceTeam,
} from './attendance-team.js';
import type { PlaybookConfig } from './config.js';
import {
  listLatestThreadSummaries,
  listThreadsForPlaybook,
  readInboxFingerprint,
  readLastPlaybookRun,
  type InboxFingerprint,
} from './db.js';
import { writeContactNotes } from './contact-note.js';
import type { InboxThread } from './inbox-snapshot.js';
import { writeInboxSnapshot } from './inbox-snapshot.js';
import { ensureMecanicaKnowledge } from './mecanica-knowledge.js';
import {
  readPlaybookFingerprint,
  readVaultWrittenFingerprint,
  writeVaultWrittenFingerprint,
} from './ops-cache.js';
import {
  fingerprintKey,
  mediaIdempotencyKey,
  playbookIdempotencyKey,
  shouldSkipVaultWrite,
} from './ops-keys.js';
import { enqueueWorkerJob } from './ops-queue.js';
import { drainWorkerJobs, messageNeedsMediaJob } from './ops-run.js';
import { leadKeyFromSession } from './playbook-leads.js';
import { syncChatProToLocalPostgres } from './sync.js';
import { writeTriageLearnFromThreads } from './triage-learn.js';
import { writeCompanyIndex, ensureTeamIndex } from './vault.js';

export type InterceptTickResult = {
  syncedSessions: number;
  syncedMessages: number;
  inboxPath: string;
  inboxPaths: string[];
  contacts: number;
  followUps: number;
  fingerprint: InboxFingerprint;
  vaultWrote: boolean;
  vaultSkipped: string | null;
  jobsEnqueued: number;
  jobsDrained: number;
  uniqueLeads: number;
  playbookWrote: boolean;
  playbookSkipped: string | null;
  teams: Record<AttendanceTeam, { threads: number; playbook: number }>;
};

/**
 * True when Haiku should rewrite playbook notes (valores, oportunidades, métodos).
 * New inbox data runs immediately. Identical inbox is skipped.
 */
export function playbookIsDue(options: {
  lastRunAt: Date | null;
  refreshMs: number;
  fingerprintChanged: boolean;
  forcePlaybook: boolean;
}) {
  if (options.forcePlaybook) {
    return true;
  }
  if (!options.fingerprintChanged) {
    return false;
  }
  if (!options.lastRunAt || options.refreshMs <= 0) {
    return true;
  }
  return Date.now() - options.lastRunAt.getTime() >= options.refreshMs;
}

function partitionThreads(threads: InboxThread[]) {
  return partitionAttendanceThreads(threads);
}

/**
 * Writes inbox, contacts and indexes when the fingerprint is new.
 */
async function writeObsidianSurfaces(options: {
  pool: Pool;
  config: PlaybookConfig;
  threads: InboxThread[];
  fingerprint: InboxFingerprint;
  force: boolean;
}) {
  const currentKey = fingerprintKey(options.fingerprint);
  const cachedKey = await readVaultWrittenFingerprint(options.pool);
  if (shouldSkipVaultWrite({
    cachedKey,
    currentKey,
    force: options.force,
  })) {
    return {
      inboxPaths: [] as string[],
      contacts: 0,
      followUps: 0,
      wrote: false,
      skipped: 'inbox-igual' as const,
    };
  }

  const split = partitionThreads(options.threads);
  const summaryRows = await listLatestThreadSummaries({
    pool: options.pool,
    sessionIds: options.threads.map((thread) => thread.session.id),
  });
  const summaries = Object.fromEntries(summaryRows.map((row) => [row.session_id, row.summary]));
  const inboxPaths: string[] = [];
  let contacts = 0;
  let followUps = 0;

  for (const team of ATTENDANCE_TEAMS) {
    const folder = vaultFolderForTeam(options.config.obsidianCompanyFolder, team);
    const inboxPath = writeInboxSnapshot({
      vaultPath: options.config.obsidianVaultPath,
      folder,
      threads: split.vault[team],
      messageCount: options.fingerprint.messageCount,
      team,
      summaries,
    });
    inboxPaths.push(inboxPath);
    console.log('[worker] Obsidian inbox', { team, inboxPath, threads: split.vault[team].length });

    const currentDeskThreads = split.vault[team].filter((thread) => (
      vaultTeamForDesk(classifyAttendanceDesk(thread)) === team
    ));
    const contactWrite = writeContactNotes({
      vaultPath: options.config.obsidianVaultPath,
      folder,
      threads: currentDeskThreads,
      team,
      summaries,
    });
    contacts += contactWrite.contacts;
    followUps += contactWrite.followUps;
    console.log('[worker] notas de contato', { team, ...contactWrite });
    ensureTeamIndex({
      vaultPath: options.config.obsidianVaultPath,
      folder,
      team,
    });
    if (team === 'comercial') {
      writeTriageLearnFromThreads({
        vaultPath: options.config.obsidianVaultPath,
        folder,
        threads: currentDeskThreads,
      });
    }
  }

  writeCompanyIndex({
    vaultPath: options.config.obsidianVaultPath,
    companyFolder: options.config.obsidianCompanyFolder,
  });
  await writeVaultWrittenFingerprint(options.pool, currentKey);
  return {
    inboxPaths,
    contacts,
    followUps,
    wrote: true,
    skipped: null,
  };
}

async function enqueueMediaJobs(options: {
  pool: Pool;
  threads: InboxThread[];
}) {
  let enqueued = 0;
  for (const thread of options.threads) {
    for (const message of thread.messages) {
      if (!messageNeedsMediaJob(message)) {
        continue;
      }
      const result = await enqueueWorkerJob({
        pool: options.pool,
        kind: 'media',
        idempotencyKey: mediaIdempotencyKey(message.id),
        payload: { messageId: message.id },
      });
      if (result.enqueued) {
        enqueued += 1;
      }
    }
  }
  return enqueued;
}

async function enqueuePlaybookJobs(options: {
  pool: Pool;
  fingerprint: InboxFingerprint;
  playbook: Record<AttendanceTeam, InboxThread[]>;
  force: boolean;
}) {
  let enqueued = 0;
  for (const team of ATTENDANCE_TEAMS) {
    if (options.playbook[team].length === 0) {
      continue;
    }
    const result = await enqueueWorkerJob({
      pool: options.pool,
      kind: 'playbook',
      idempotencyKey: playbookIdempotencyKey(team, options.fingerprint),
      payload: { team },
      force: options.force,
    });
    if (result.enqueued) {
      enqueued += 1;
    }
  }
  return enqueued;
}

/**
 * Pulls ChatPro inbox into Postgres and Obsidian. Heavy Haiku and media work go through the job queue.
 */
export async function runInterceptTick(options: {
  pool: Pool;
  config: PlaybookConfig;
  sync?: boolean;
  writePlaybook?: boolean;
  forcePlaybook?: boolean;
  drainMedia?: number;
  drainOther?: number;
}): Promise<InterceptTickResult> {
  const shouldSync = options.sync !== false;
  const forcePlaybook = options.forcePlaybook === true;
  const drainMedia = options.drainMedia ?? 40;
  const drainOther = options.drainOther ?? 20;
  let syncedSessions = 0;
  let syncedMessages = 0;

  if (shouldSync) {
    const synced = await syncChatProToLocalPostgres({
      pool: options.pool,
      config: options.config,
    });
    syncedSessions = synced.sessionCount;
    syncedMessages = synced.messageCount;
    console.log('[worker] sync ChatPro → Postgres', synced);
  }

  let fingerprint = await readInboxFingerprint(options.pool);
  let threads = await listThreadsForPlaybook({
    pool: options.pool,
    lookbackDays: options.config.lookbackDays,
    maxSessions: options.config.maxSessions,
  });
  if (threads.length === 0) {
    throw new Error('Nenhuma sessão no Postgres local. Confira o token da ChatPro Chat.');
  }

  const mechanicSeed = ensureMecanicaKnowledge({
    vaultPath: options.config.obsidianVaultPath,
    companyFolder: options.config.obsidianCompanyFolder,
  });
  if (mechanicSeed.written.length > 0) {
    console.log('[worker] conhecimento mecânica', mechanicSeed);
  }

  let vault = await writeObsidianSurfaces({
    pool: options.pool,
    config: options.config,
    threads,
    fingerprint,
    force: forcePlaybook,
  });

  const mediaQueued = await enqueueMediaJobs({ pool: options.pool, threads });
  const mediaResults = await drainWorkerJobs({
    pool: options.pool,
    config: options.config,
    fingerprint,
    limit: drainMedia,
    kind: 'media',
  });

  if (mediaResults.length > 0) {
    fingerprint = await readInboxFingerprint(options.pool);
    threads = await listThreadsForPlaybook({
      pool: options.pool,
      lookbackDays: options.config.lookbackDays,
      maxSessions: options.config.maxSessions,
    });
    vault = await writeObsidianSurfaces({
      pool: options.pool,
      config: options.config,
      threads,
      fingerprint,
      force: false,
    });
  }

  const split = partitionThreads(threads);
  const lastRun = await readLastPlaybookRun(options.pool);
  const lastPlaybookKey = await readPlaybookFingerprint(options.pool);
  const currentKey = fingerprintKey(fingerprint);
  const fingerprintChanged = lastPlaybookKey !== currentKey;
  const writePlaybook = options.writePlaybook !== false;
  const due = writePlaybook && playbookIsDue({
    lastRunAt: lastRun?.finished_at ?? null,
    refreshMs: options.config.playbookRefreshMs,
    fingerprintChanged,
    forcePlaybook,
  });

  let playbookQueued = 0;
  let playbookSkipped: string | null = null;
  if (!writePlaybook) {
    playbookSkipped = 'desligado';
  } else if (!due) {
    playbookSkipped = fingerprintChanged ? 'aguardando-intervalo' : 'inbox-igual';
  } else {
    playbookQueued = await enqueuePlaybookJobs({
      pool: options.pool,
      fingerprint,
      playbook: split.playbook,
      force: forcePlaybook,
    });
  }

  const otherResults = await drainWorkerJobs({
    pool: options.pool,
    config: options.config,
    fingerprint,
    limit: drainOther,
  });

  const drained = [...mediaResults, ...otherResults];
  const playbookWrote = drained.some((item) => item.kind === 'playbook' && item.ok);
  if (playbookWrote) {
    vault = await writeObsidianSurfaces({
      pool: options.pool,
      config: options.config,
      threads,
      fingerprint,
      force: true,
    });
  }
  const teams: Record<AttendanceTeam, { threads: number; playbook: number }> = {
    comercial: {
      threads: split.vault.comercial.length,
      playbook: split.playbook.comercial.length,
    },
    logistica: {
      threads: split.vault.logistica.length,
      playbook: split.playbook.logistica.length,
    },
    mecanica: {
      threads: split.vault.mecanica.length,
      playbook: split.playbook.mecanica.length,
    },
  };

  return {
    syncedSessions,
    syncedMessages,
    inboxPath: vault.inboxPaths[0] ?? '',
    inboxPaths: vault.inboxPaths,
    contacts: vault.contacts,
    followUps: vault.followUps,
    fingerprint,
    vaultWrote: vault.wrote,
    vaultSkipped: vault.skipped,
    jobsEnqueued: mediaQueued + playbookQueued,
    jobsDrained: drained.length,
    uniqueLeads: new Set(threads.map((thread) => leadKeyFromSession({
      id: thread.session.id,
      phone_key: thread.session.phone_key,
    }))).size,
    playbookWrote,
    playbookSkipped,
    teams,
  };
}
