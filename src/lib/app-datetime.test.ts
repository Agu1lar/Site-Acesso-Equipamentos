import { describe, expect, it } from 'vitest';
import {
  brasiliaDayStartUtc,
  formatBrasiliaDatePt,
  formatBrasiliaDateRangePt,
  formatDateTimeBrasilia,
  formatDateTimeBrasiliaExport,
  isValidBrasiliaDateOnly,
  maskBrasiliaDatePt,
  parseBrasiliaDatePt,
} from '@/lib/app-datetime';

describe('formatDateTimeBrasilia', () => {
  it('formats UTC instant in America/Sao_Paulo', () => {
    const instant = new Date('2026-06-08T14:30:00.000Z');
    expect(formatDateTimeBrasilia(instant)).toContain('11:30');
    expect(formatDateTimeBrasilia(instant)).toContain('08/06/2026');
  });

  it('rolls calendar day near midnight Brasília', () => {
    const instant = new Date('2026-06-08T02:30:00.000Z');
    expect(formatDateTimeBrasilia(instant)).toContain('07/06/2026');
    expect(formatDateTimeBrasilia(instant)).toContain('23:30');
  });
});

describe('formatDateTimeBrasiliaExport', () => {
  it('returns sortable local timestamp', () => {
    const instant = new Date('2026-06-08T14:30:00.000Z');
    expect(formatDateTimeBrasiliaExport(instant)).toBe('2026-06-08 11:30:00');
  });
});

describe('brasiliaDayStartUtc', () => {
  it('maps local midnight to 03:00 UTC', () => {
    expect(brasiliaDayStartUtc('2026-06-08').toISOString()).toBe('2026-06-08T03:00:00.000Z');
  });
});

describe('formatBrasiliaDatePt', () => {
  it('formats a calendar day as Brazilian short date', () => {
    expect(formatBrasiliaDatePt('2026-08-09')).toBe('09/08/2026');
  });

  it('joins a range with a', () => {
    expect(formatBrasiliaDateRangePt('2026-08-09', '2026-08-24')).toBe('09/08/2026 a 24/08/2026');
  });
});

describe('Brazilian calendar date input', () => {
  it('parses valid Brazilian dates into ISO dates', () => {
    expect(parseBrasiliaDatePt('09/08/2026')).toBe('2026-08-09');
    expect(isValidBrasiliaDateOnly('2026-02-28')).toBe(true);
  });

  it('rejects impossible calendar dates', () => {
    expect(parseBrasiliaDatePt('31/02/2026')).toBeNull();
    expect(isValidBrasiliaDateOnly('2026-02-31')).toBe(false);
  });

  it('masks date digits as dd/MM/yyyy', () => {
    expect(maskBrasiliaDatePt('09082026')).toBe('09/08/2026');
    expect(maskBrasiliaDatePt('09/08/20abc26')).toBe('09/08/2026');
  });
});
