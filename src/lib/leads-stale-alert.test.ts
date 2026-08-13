import { describe, expect, it } from 'vitest';
import { hoursSinceLeadActivity } from '@/lib/leads-stale-alert';

describe('hoursSinceLeadActivity', () => {
  it('uses lastActivityAt when present', () => {
    const now = Date.parse('2026-06-18T15:00:00.000Z');
    const hours = hoursSinceLeadActivity(
      {
        createdAt: new Date('2026-06-10T12:00:00.000Z'),
        lastActivityAt: new Date('2026-06-18T12:00:00.000Z'),
      },
      now,
    );

    expect(hours).toBe(3);
  });

  it('falls back to createdAt when lastActivityAt is null', () => {
    const now = Date.parse('2026-06-18T15:00:00.000Z');
    const hours = hoursSinceLeadActivity(
      {
        createdAt: new Date('2026-06-17T12:00:00.000Z'),
        lastActivityAt: null,
      },
      now,
    );

    expect(hours).toBe(27);
  });
});
