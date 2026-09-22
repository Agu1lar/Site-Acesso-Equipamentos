export type FingerprintLike = {
  messageCount: number;
  lastSentAt: string | null;
  mediaTextCount?: number;
};

export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

/**
 * Stable inbox fingerprint used as cache and job key.
 */
export function fingerprintKey(fingerprint: FingerprintLike) {
  return `${fingerprint.messageCount}:${fingerprint.lastSentAt ?? 'none'}:${fingerprint.mediaTextCount ?? 0}`;
}

/**
 * Idempotency key for a team's Haiku playbook against this inbox snapshot.
 */
export function playbookIdempotencyKey(team: string, fingerprint: FingerprintLike) {
  return `playbook:${team}:${fingerprintKey(fingerprint)}`;
}

/**
 * Idempotency key for one media transcription or caption.
 */
export function mediaIdempotencyKey(messageId: string) {
  return `media:${messageId}`;
}

/**
 * True when the Obsidian vault already reflects this inbox snapshot.
 */
export function shouldSkipVaultWrite(options: {
  cachedKey: string | null;
  currentKey: string;
  force: boolean;
}) {
  return !options.force && options.cachedKey === options.currentKey;
}

/**
 * Next status when enqueue hits an existing job of the same key.
 */
export function resolveEnqueueStatus(options: {
  existing: JobStatus | null;
  force: boolean;
}): 'queued' | 'keep' {
  if (!options.existing) {
    return 'queued';
  }
  if (options.existing === 'failed') {
    return 'queued';
  }
  if (options.existing === 'done' && options.force) {
    return 'queued';
  }
  return 'keep';
}

/**
 * True when a running lease should be stolen.
 */
export function isStaleJobLock(lockedAt: Date | null, now = new Date(), staleMs = 20 * 60_000) {
  if (!lockedAt) {
    return true;
  }
  return now.getTime() - lockedAt.getTime() >= staleMs;
}
