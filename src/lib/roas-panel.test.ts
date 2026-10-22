import { describe, expect, it } from 'vitest';
import { listBrasiliaDates, resolveRoasRange, roasRatio } from '@/lib/roas-panel';

describe('roas panel', () => {
  it('divides closed value by spend', () => {
    expect(roasRatio(200, 50)).toBe(4);
    expect(roasRatio(0, 50)).toBe(0);
  });

  it('leaves roas empty when spend is missing', () => {
    expect(roasRatio(200, null)).toBeNull();
    expect(roasRatio(200, 0)).toBeNull();
  });

  it('lists each day in the range', () => {
    expect(listBrasiliaDates('2026-10-01', '2026-10-03')).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
  });

  it('defaults the filter to the current month', () => {
    expect(resolveRoasRange({}, '2026-10-22')).toEqual({
      dateFrom: '2026-10-01',
      dateTo: '2026-10-22',
    });
  });

  it('keeps a chosen range inside one year', () => {
    expect(resolveRoasRange({ dateFrom: '2020-01-01', dateTo: '2026-10-22' }, '2026-10-22').dateFrom).toBe(
      '2025-10-22',
    );
  });
});
