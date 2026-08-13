import { describe, expect, it } from 'vitest';
import { currentWeekStartUtc } from '@/lib/leads-auto-archive';

describe('currentWeekStartUtc', () => {
  it('returns monday at utc midnight for the reference week', () => {
    const start = currentWeekStartUtc(new Date('2026-06-18T15:00:00.000Z'));

    expect(start.toISOString()).toBe('2026-06-15T03:00:00.000Z');
  });
});
