import { formatBrasiliaDateOnly, isValidBrasiliaDateOnly } from '@/lib/app-datetime';

const MAX_RANGE_DAYS = 366;

export type RoasDayProposal = {
  numero: string;
  valor: number;
  closed: boolean;
};

export type RoasDay = {
  date: string;
  proposals: number;
  proposalBrl: number;
  closedBrl: number;
  spendBrl: number | null;
  proposalsDetail: RoasDayProposal[];
};

export const ROAS_ORIGINS = ['paid', 'organic', 'direct', 'referral'] as const;

export type RoasOriginChannel = (typeof ROAS_ORIGINS)[number];

export type RoasOrigin = {
  channel: RoasOriginChannel;
  contracts: number;
  contractBrl: number;
  contractClosed: number;
  contractClosedBrl: number;
  ltvCount: number;
  ltvBrl: number;
  ltvClosed: number;
  ltvClosedBrl: number;
};

export const PAID_CLICK_TRACKING_START = '2026-07-06';

/**
 * Fills the four origin rows, keeping a channel that has no proposals at zero.
 * @param rows Stored origin totals.
 * @returns Paid, organic, direct, and referral, in that order.
 */
export function emptyOrigin(channel: RoasOriginChannel): RoasOrigin {
  return {
    channel,
    contracts: 0,
    contractBrl: 0,
    contractClosed: 0,
    contractClosedBrl: 0,
    ltvCount: 0,
    ltvBrl: 0,
    ltvClosed: 0,
    ltvClosedBrl: 0,
  };
}

/**
 * Keeps the panel on paid traffic unless a known origin is selected.
 * @param value Raw origin query value.
 * @returns Paid, organic, direct, or referral.
 */
export function resolveRoasChannel(value: string | null | undefined): RoasOriginChannel {
  if (value === 'organic' || value === 'direct' || value === 'referral') {
    return value;
  }
  return 'paid';
}

export function fillOriginRows(rows: RoasOrigin[]) {
  const byChannel = new Map(rows.map((row) => [row.channel, row]));
  return ROAS_ORIGINS.map((channel) => byChannel.get(channel) ?? emptyOrigin(channel));
}

/**
 * Divides the closed contract value by media spend.
 * @param closedBrl Approved contract total in BRL.
 * @param spendBrl Media spend in BRL.
 * @returns ROAS rounded to two decimals, or null when spend is missing.
 */
export function roasRatio(closedBrl: number, spendBrl: number | null) {
  if (spendBrl === null || !(spendBrl > 0) || !Number.isFinite(closedBrl)) {
    return null;
  }
  return Number((closedBrl / spendBrl).toFixed(2));
}

const RECENT_VISIBLE_DAYS = 7;

function shiftDate(date: string, days: number) {
  const cursor = new Date(`${date}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return cursor.toISOString().slice(0, 10);
}

/**
 * Keeps days with movement, plus the last week of the filter so today does not vanish when spend is still R$ 0.
 * @param days Panel days in the selected range.
 * @param ltvByDay Closed LTV totals keyed by Brasília date.
 * @param dateTo Inclusive end of the filter.
 * @returns Days shown in the daily table.
 */
export function visibleRoasDays(
  days: RoasDay[],
  ltvByDay: Map<string, { proposals: number; closedBrl: number }>,
  dateTo: string,
) {
  const recentFrom = shiftDate(dateTo, -(RECENT_VISIBLE_DAYS - 1));
  return days.filter((day) => {
    const ltv = ltvByDay.get(day.date);
    const hasMovement =
      day.proposals > 0
      || day.proposalsDetail.length > 0
      || (ltv !== undefined && ltv.proposals > 0)
      || (day.spendBrl !== null && day.spendBrl > 0);
    return hasMovement || day.date >= recentFrom;
  });
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

function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}

/**
 * Resolves the panel date filter, defaulting to the current Brasília month through today.
 * @param input Raw query dates.
 * @param today YYYY-MM-DD in America/Sao_Paulo.
 * @returns An inclusive range of at most one year.
 */
export function resolveRoasRange(
  input: { dateFrom?: string | null; dateTo?: string | null },
  today = formatBrasiliaDateOnly(),
) {
  let dateTo = input.dateTo && isValidBrasiliaDateOnly(input.dateTo) ? input.dateTo : today;
  let dateFrom = input.dateFrom && isValidBrasiliaDateOnly(input.dateFrom)
    ? input.dateFrom
    : monthStart(dateTo);
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
