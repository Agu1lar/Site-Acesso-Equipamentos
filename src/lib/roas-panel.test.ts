import { describe, expect, it } from 'vitest';
import { fillOriginRows, listBrasiliaDates, resolveRoasChannel, resolveRoasRange, roasRatio, visibleRoasDays } from '@/lib/roas-panel';
import type { RoasDay } from '@/lib/roas-panel';

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

  it('keeps organic off the paid view', () => {
    expect(resolveRoasChannel(undefined)).toBe('paid');
    expect(resolveRoasChannel('organic')).toBe('organic');
    expect(resolveRoasChannel('outro')).toBe('paid');
  });

  it('defaults the filter to the current month through today', () => {
    expect(resolveRoasRange({}, '2026-11-16')).toEqual({
      dateFrom: '2026-11-01',
      dateTo: '2026-11-16',
    });
  });

  it('starts a month without a from date on the first day of the to date', () => {
    expect(resolveRoasRange({ dateTo: '2026-10-31' }, '2026-11-16')).toEqual({
      dateFrom: '2026-10-01',
      dateTo: '2026-10-31',
    });
  });

  it('keeps a chosen range inside one year', () => {
    expect(resolveRoasRange({ dateFrom: '2020-01-01', dateTo: '2026-10-22' }, '2026-10-22').dateFrom).toBe(
      '2025-10-22',
    );
  });

  it('keeps an origin with no proposals at zero', () => {
    expect(fillOriginRows([]).map((row) => row.contracts + row.ltvCount)).toEqual([0, 0, 0, 0]);
  });

  it('keeps the last week visible even when spend is still zero', () => {
    const emptyDay = (date: string): RoasDay => ({
      date,
      proposals: 0,
      proposalBrl: 0,
      closedBrl: 0,
      spendBrl: 0,
      proposalsDetail: [],
    });
    const days = [
      { ...emptyDay('2026-11-09'), spendBrl: 231.87, closedBrl: 100 },
      emptyDay('2026-11-14'),
      emptyDay('2026-11-15'),
      emptyDay('2026-11-16'),
    ];
    expect(visibleRoasDays(days, new Map(), '2026-11-16').map((day) => day.date)).toEqual([
      '2026-11-09',
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
    ]);
  });
});
