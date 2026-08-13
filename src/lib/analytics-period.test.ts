import { describe, expect, it } from 'vitest';
import { brasiliaDayStartUtc } from '@/lib/app-datetime';
import {
  calendarMonthRange,
  currentCalendarMonthRange,
  currentMonthToDateRange,
  previousCalendarMonthRange,
  previousMonthToDateRange,
  previousPeriodRange,
  resolveAnalyticsPeriod,
  resolveComparisonPeriod,
} from '@/lib/analytics-period';

describe('resolve analytics period', () => {
  it('defaults to current month through today (Brasília) when filters are empty', () => {
    const period = resolveAnalyticsPeriod({});
    const expected = currentMonthToDateRange();

    expect(period.dateFrom).toBe(expected.dateFrom);
    expect(period.dateTo).toBe(expected.dateTo);
    expect(period.from.getTime()).toBeLessThanOrEqual(period.to.getTime());
  });

  it('uses explicit date filters', () => {
    const period = resolveAnalyticsPeriod({
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    });
    expect(period.dateFrom).toBe('2026-01-01');
    expect(period.dateTo).toBe('2026-01-31');
  });
});

describe('previous period range', () => {
  it('returns a range immediately before the current period', () => {
    const previous = previousPeriodRange('2026-02-01', '2026-02-07');
    expect(previous.to.getTime()).toBeLessThan(
      brasiliaDayStartUtc('2026-02-01').getTime(),
    );
    expect(previous.dateFrom).toBe('2026-01-25');
    expect(previous.dateTo).toBe('2026-01-31');
  });
});

describe('resolve comparison period', () => {
  it('uses custom compare dates when both are set', () => {
    const period = resolveAnalyticsPeriod({
      dateFrom: '2026-06-01',
      dateTo: '2026-06-30',
    });
    const comparison = resolveComparisonPeriod(period, {
      compareDateFrom: '2026-05-01',
      compareDateTo: '2026-05-31',
    });

    expect(comparison.comparisonMode).toBe('custom');
    expect(comparison.dateFrom).toBe('2026-05-01');
    expect(comparison.dateTo).toBe('2026-05-31');
  });

  it('falls back to auto previous period when compare dates are missing', () => {
    const period = resolveAnalyticsPeriod({
      dateFrom: '2026-06-01',
      dateTo: '2026-06-30',
    });
    const comparison = resolveComparisonPeriod(period, {});

    expect(comparison.comparisonMode).toBe('auto');
    expect(comparison.dateTo).toBe('2026-05-31');
  });
});

describe('calendar month range', () => {
  it('returns full june 2026', () => {
    expect(calendarMonthRange(2026, 6)).toEqual({
      dateFrom: '2026-06-01',
      dateTo: '2026-06-30',
    });
  });

  it('links current and previous calendar months', () => {
    const reference = new Date('2026-06-15T12:00:00.000Z');
    expect(currentCalendarMonthRange(reference).dateFrom).toBe('2026-06-01');
    expect(previousCalendarMonthRange(reference).dateTo).toBe('2026-05-31');
  });

  it('returns month-to-date and matching previous month span', () => {
    const reference = new Date('2026-07-02T15:00:00.000Z');
    expect(currentMonthToDateRange(reference)).toEqual({
      dateFrom: '2026-07-01',
      dateTo: '2026-07-02',
    });
    expect(previousMonthToDateRange(reference)).toEqual({
      dateFrom: '2026-06-01',
      dateTo: '2026-06-02',
    });
  });
});
