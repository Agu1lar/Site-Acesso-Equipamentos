import { formatBrasiliaDateOnly, isValidBrasiliaDateOnly } from '@/lib/app-datetime';

const MAX_RANGE_DAYS = 366;

export type RoasDay = {
  date: string;
  proposals: number;
  closedBrl: number;
  spendBrl: number | null;
};

/**
 * Divides closed value by media spend.
 * @param closedBrl Approved proposal total in BRL.
 * @param spendBrl Media spend in BRL.
 * @returns ROAS rounded to two decimals, or null when spend is missing.
 */
export function roasRatio(closedBrl: number, spendBrl: number | null) {
  if (spendBrl === null || !(spendBrl > 0) || !Number.isFinite(closedBrl)) {
    return null;
  }
  return Number((closedBrl / spendBrl).toFixed(2));
}

/**
 * Lists inclusive Brasília dates from the start through the end.
 * @param dateFrom YYYY-MM-DD start.
 * @param dateTo YYYY-MM-DD end.
 * @returns The dates in order, capped at one year.
 */
export function listBrasiliaDates(dateFrom: string, dateTo: string) {
  const dates: string[] = [];
  const cursor = new Date(`${dateFrom}T00:00:00Z`);
  const end = new Date(`${dateTo}T00:00:00Z`);
  while (cursor.getTime() <= end.getTime() && dates.length < MAX_RANGE_DAYS) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function shiftDate(date: string, days: number) {
  const cursor = new Date(`${date}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return cursor.toISOString().slice(0, 10);
}

/**
 * Resolves the panel date filter, defaulting to the current Brasília month.
 * @param input Raw query dates.
 * @param today YYYY-MM-DD in America/Sao_Paulo.
 * @returns An inclusive range of at most one year.
 */
export function resolveRoasRange(
  input: { dateFrom?: string | null; dateTo?: string | null },
  today = formatBrasiliaDateOnly(),
) {
  const fallbackFrom = `${today.slice(0, 8)}01`;
  let dateFrom = input.dateFrom && isValidBrasiliaDateOnly(input.dateFrom) ? input.dateFrom : fallbackFrom;
  let dateTo = input.dateTo && isValidBrasiliaDateOnly(input.dateTo) ? input.dateTo : today;
  if (dateFrom > dateTo) {
    const swap = dateFrom;
    dateFrom = dateTo;
    dateTo = swap;
  }
  const earliest = shiftDate(dateTo, -(MAX_RANGE_DAYS - 1));
  if (dateFrom < earliest) {
    dateFrom = earliest;
  }
  return { dateFrom, dateTo };
}
