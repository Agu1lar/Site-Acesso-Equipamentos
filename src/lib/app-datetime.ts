/** Default business timezone — Belo Horizonte / Brasília (no DST since 2019). */
export const APP_TIMEZONE = 'America/Sao_Paulo';

const shortDateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: APP_TIMEZONE,
  dateStyle: 'short',
  timeStyle: 'short',
});

const fullDateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: APP_TIMEZONE,
  dateStyle: 'full',
  timeStyle: 'short',
});

const exportDateTimeFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const dateOnlyFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: APP_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const datePtFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: APP_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/**
 * Formats an instant as YYYY-MM-DD in America/Sao_Paulo (filters and presets).
 */
export function formatBrasiliaDateOnly(reference: Date = new Date()) {
  return dateOnlyFormatter.format(reference);
}

/**
 * Formats a YYYY-MM-DD calendar day for admin UI in Portuguese (dd/MM/yyyy).
 */
export function formatBrasiliaDatePt(dateStr: string) {
  const instant = brasiliaDayStartUtc(dateStr);
  if (Number.isNaN(instant.getTime())) {
    return dateStr;
  }
  return datePtFormatter.format(instant);
}

/**
 * Formats an inclusive date range for admin UI in Portuguese.
 */
export function formatBrasiliaDateRangePt(dateFrom: string, dateTo: string) {
  return `${formatBrasiliaDatePt(dateFrom)} a ${formatBrasiliaDatePt(dateTo)}`;
}

/**
 * Returns whether a YYYY-MM-DD value is a real calendar day.
 */
export function isValidBrasiliaDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value.trim());
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const reference = new Date(Date.UTC(year, month - 1, day));

  return reference.getUTCFullYear() === year
    && reference.getUTCMonth() === month - 1
    && reference.getUTCDate() === day;
}

/**
 * Parses a Brazilian calendar date (dd/MM/yyyy) into YYYY-MM-DD.
 */
export function parseBrasiliaDatePt(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/u.exec(value.trim());
  if (!match) {
    return null;
  }

  const isoDate = `${match[3]}-${match[2]}-${match[1]}`;
  return isValidBrasiliaDateOnly(isoDate) ? isoDate : null;
}

/**
 * Applies the dd/MM/yyyy mask while the user types a date.
 */
export function maskBrasiliaDatePt(value: string) {
  const digits = value.replaceAll(/\D/gu, '').slice(0, 8);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * UTC instant for 00:00:00 on a YYYY-MM-DD calendar day in America/Sao_Paulo.
 */
export function brasiliaDayStartUtc(dateStr: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(dateStr.trim());
  if (!match) {
    return new Date(Number.NaN);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
}

/**
 * UTC instant for 23:59:59.999 on a YYYY-MM-DD calendar day in America/Sao_Paulo.
 */
export function brasiliaDayEndUtc(dateStr: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(dateStr.trim());
  if (!match) {
    return new Date(Number.NaN);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day + 1, 2, 59, 59, 999));
}

/**
 * Formats an instant for admin UI in America/Sao_Paulo.
 */
export function formatDateTimeBrasilia(
  date: Date,
  style: 'short' | 'full' = 'short',
) {
  if (style === 'full') {
    return fullDateTimeFormatter.format(date);
  }
  return shortDateTimeFormatter.format(date);
}

/**
 * Formats an instant as YYYY-MM-DD HH:mm:ss in America/Sao_Paulo (CSV/export).
 */
export function formatDateTimeBrasiliaExport(date: Date) {
  return exportDateTimeFormatter.format(date);
}
