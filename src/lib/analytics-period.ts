import {
  brasiliaDayEndUtc,
  brasiliaDayStartUtc,
  formatBrasiliaDateOnly,
} from '@/lib/app-datetime';

/**
 * Resolves inclusive date range from filter strings or defaults to current month (day 1 → today, Brasília).
 */
export function resolveAnalyticsPeriod(filters: { dateFrom?: string; dateTo?: string }) {
  const defaultRange = currentMonthToDateRange();
  const dateFrom = filters.dateFrom?.trim() || defaultRange.dateFrom;
  const dateTo = filters.dateTo?.trim() || defaultRange.dateTo;

  return {
    dateFrom,
    dateTo,
    from: brasiliaDayStartUtc(dateFrom),
    to: brasiliaDayEndUtc(dateTo),
  };
}

export type ComparisonPeriod = {
  comparisonMode: 'auto' | 'custom';
  dateFrom: string;
  dateTo: string;
  from: Date;
  to: Date;
};

/**
 * Resolves the comparison range: custom dates when both are set, otherwise the auto previous period.
 */
export function resolveComparisonPeriod(
  period: { dateFrom: string; dateTo: string },
  filters: { compareDateFrom?: string; compareDateTo?: string },
): ComparisonPeriod {
  const compareFrom = filters.compareDateFrom?.trim();
  const compareTo = filters.compareDateTo?.trim();

  if (compareFrom && compareTo) {
    return {
      comparisonMode: 'custom',
      dateFrom: compareFrom,
      dateTo: compareTo,
      from: brasiliaDayStartUtc(compareFrom),
      to: brasiliaDayEndUtc(compareTo),
    };
  }

  const auto = previousPeriodRange(period.dateFrom, period.dateTo);
  return {
    comparisonMode: 'auto',
    dateFrom: auto.dateFrom,
    dateTo: auto.dateTo,
    from: auto.from,
    to: auto.to,
  };
}

/**
 * Returns the inclusive date range for a calendar month (month 1 = January, Brasília labels).
 */
export function calendarMonthRange(year: number, month: number) {
  const pad = (value: number) => String(value).padStart(2, '0');
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    dateFrom: `${year}-${pad(month)}-01`,
    dateTo: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}

/**
 * Returns the current calendar month range (America/Sao_Paulo).
 */
export function currentCalendarMonthRange(reference = new Date()) {
  const dateStr = formatBrasiliaDateOnly(reference);
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(5, 7));
  return calendarMonthRange(year, month);
}

/**
 * Returns day 1 of the current calendar month through today (America/Sao_Paulo).
 */
export function currentMonthToDateRange(reference = new Date()) {
  const dateTo = formatBrasiliaDateOnly(reference);
  const dateFrom = `${dateTo.slice(0, 7)}-01`;
  return { dateFrom, dateTo };
}

/**
 * Same day span as {@link currentMonthToDateRange} in the previous calendar month (America/Sao_Paulo).
 */
export function previousMonthToDateRange(reference = new Date()) {
  const { dateFrom: currentFrom, dateTo: currentTo } = currentMonthToDateRange(reference);
  const year = Number(currentFrom.slice(0, 4));
  const month = Number(currentFrom.slice(5, 7));
  const day = Number(currentTo.slice(8, 10));
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth < 1) {
    prevMonth = 12;
    prevYear -= 1;
  }
  const lastDayPrevMonth = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
  const compareDay = Math.min(day, lastDayPrevMonth);
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    dateFrom: `${prevYear}-${pad(prevMonth)}-01`,
    dateTo: `${prevYear}-${pad(prevMonth)}-${pad(compareDay)}`,
  };
}

/**
 * Returns the calendar month immediately before the month of `reference`.
 */
export function previousCalendarMonthRange(reference = new Date()) {
  const dateStr = formatBrasiliaDateOnly(reference);
  let year = Number(dateStr.slice(0, 4));
  let month = Number(dateStr.slice(5, 7)) - 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  return calendarMonthRange(year, month);
}

/**
 * Returns the previous period of equal length immediately before the current range.
 */
export function previousPeriodRange(dateFrom: string, dateTo: string) {
  const from = brasiliaDayStartUtc(dateFrom);
  const to = brasiliaDayEndUtc(dateTo);
  const lengthMs = to.getTime() - from.getTime() + 1;
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - lengthMs + 1);

  return {
    dateFrom: formatBrasiliaDateOnly(prevFrom),
    dateTo: formatBrasiliaDateOnly(prevTo),
    from: prevFrom,
    to: prevTo,
  };
}

/**
 * Builds query string for analytics dashboard date filters.
 */
export function buildAnalyticsFilterQuery(filters: {
  dateFrom?: string;
  dateTo?: string;
  compareDateFrom?: string;
  compareDateTo?: string;
  section?: string;
}) {
  const params = new URLSearchParams();
  if (filters.section?.trim()) {
    params.set('section', filters.section.trim());
  }
  if (filters.dateFrom?.trim()) {
    params.set('dateFrom', filters.dateFrom.trim());
  }
  if (filters.dateTo?.trim()) {
    params.set('dateTo', filters.dateTo.trim());
  }
  if (filters.compareDateFrom?.trim()) {
    params.set('compareDateFrom', filters.compareDateFrom.trim());
  }
  if (filters.compareDateTo?.trim()) {
    params.set('compareDateTo', filters.compareDateTo.trim());
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}
