import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalQueue } from '../../chatpro-local/src/queue';

const sqlitePaths: string[] = [];

function createQueue() {
  const sqlitePath = join(tmpdir(), `chatpro-local-${randomUUID()}.db`);
  sqlitePaths.push(sqlitePath);
  return new LocalQueue(sqlitePath);
}

function event(outboxId: number) {
  return {
    outboxId,
    messageId: outboxId,
    externalId: `message-${outboxId}`,
    leadId: 42,
    phoneKey: '31999999999',
    payload: { event: 'received_message' },
    createdAt: '2026-08-18T10:00:00.000Z',
  };
}

afterEach(() => {
  for (const sqlitePath of sqlitePaths.splice(0)) {
    rmSync(sqlitePath, { force: true });
    rmSync(`${sqlitePath}-shm`, { force: true });
    rmSync(`${sqlitePath}-wal`, { force: true });
  }
});

describe('LocalQueue debounce reconciliation', () => {
  it('keeps a new event ready when it arrives during an older lead analysis', () => {
    const queue = createQueue();
    queue.enqueueRemoteEvent(event(1), 0);
    const oldJobs = queue.listPendingJobsForGroup(42, '31999999999');

    queue.enqueueRemoteEvent(event(2), 0);
    queue.markJobsDone(oldJobs.map(job => job.id));
    queue.reconcileLeadDebounce('lead:42');

    expect(queue.listReadyLeadGroups()).toEqual([
      expect.objectContaining({ group_key: 'lead:42', lead_id: 42 }),
    ]);
    expect(queue.listPendingJobsForGroup(42, '31999999999')).toHaveLength(1);

    queue.close();
  });

  it('removes the debounce only after every pending event is complete', () => {
    const queue = createQueue();
    queue.enqueueRemoteEvent(event(3), 0);
    const jobs = queue.listPendingJobsForGroup(42, '31999999999');

    queue.markJobsDone(jobs.map(job => job.id));
    queue.reconcileLeadDebounce('lead:42');

    expect(queue.listReadyLeadGroups()).toEqual([]);

    queue.close();
  });
});
