import { describe, expect, it } from 'vitest';
import { extractClaimedOutboxRows } from '@/lib/chatpro-outbox';

describe('extractClaimedOutboxRows', () => {
  it('reads claimed records from the node-postgres result.rows collection', () => {
    const events = extractClaimedOutboxRows({
      rows: [
        {
          outboxId: 17,
          messageId: 31,
          externalId: 'message-31',
          leadId: 9,
          phoneKey: '31999999999',
          payload: { event: 'received_message' },
          createdAt: '2026-08-18T10:00:00.000Z',
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      outboxId: 17,
      messageId: 31,
      externalId: 'message-31',
      leadId: 9,
    });
    expect(events[0]?.createdAt).toBe('2026-08-18T10:00:00.000Z');
  });
});
