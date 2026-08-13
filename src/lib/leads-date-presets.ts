import {
  APP_TIMEZONE,
  brasiliaDayStartUtc,
  formatBrasiliaDateOnly,
} from '@/lib/app-datetime';

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Formats a date as YYYY-MM-DD for HTML date inputs and filter query params.
 */
export function toIsoDateInput(date: Date) {
  return formatBrasiliaDateOnly(date);
}

function brasiliaWeekday(dateStr: string) {
  const instant = brasiliaDayStartUtc(dateStr);
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    weekday: 'short',
  }).format(instant);
  return WEEKDAY_MAP[short] ?? 0;
}

function shiftBrasiliaDate(dateStr: string, days: number) {
  const instant = brasiliaDayStartUtc(dateStr);
  return formatBrasiliaDateOnly(new Date(instant.getTime() + days * 86_400_000));
}

/**
 * Returns dateFrom/dateTo for the last N calendar days in America/Sao_Paulo (inclusive).
 */
export function lastDaysRange(days: number) {
  const dateTo = formatBrasiliaDateOnly(new Date());
  const dateFrom = shiftBrasiliaDate(dateTo, -(days - 1));
  return { dateFrom, dateTo };
}

/** Monday–Sunday range for the week containing `reference` (America/Sao_Paulo). */
export function currentWeekRange(reference = new Date()) {
  const today = formatBrasiliaDateOnly(reference);
  const weekday = brasiliaWeekday(today);
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  const dateFrom = shiftBrasiliaDate(today, -daysFromMonday);
  const dateTo = shiftBrasiliaDate(dateFrom, 6);

  return { dateFrom, dateTo };
}

/** Monday–Sunday range for the week before the week containing `reference`. */
export function previousWeekRange(reference = new Date()) {
  const current = currentWeekRange(reference);
  const anchor = shiftBrasiliaDate(current.dateFrom, -7);
  return currentWeekRange(new Date(brasiliaDayStartUtc(anchor).getTime() + 12 * 60 * 60 * 1000));
}

/** Human-readable week label for admin headers (pt-BR). */
export function formatWeekRangeLabel(range: { dateFrom: string; dateTo: string }) {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: APP_TIMEZONE,
    dateStyle: 'short',
  });
  const from = brasiliaDayStartUtc(range.dateFrom);
  const to = brasiliaDayStartUtc(range.dateTo);
  return `${formatter.format(from)} – ${formatter.format(to)}`;
}
