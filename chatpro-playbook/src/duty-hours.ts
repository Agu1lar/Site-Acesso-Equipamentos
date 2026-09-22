export const ACESSO_TIME_ZONE = 'America/Sao_Paulo';
export const ACESSO_OPEN_MINUTES = 7 * 60 + 30;
export const ACESSO_CLOSE_MINUTES = 17 * 60 + 15;

export type ZonedClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** ISO weekday: 1 = Monday … 7 = Sunday. */
  isoWeekday: number;
  minutesOfDay: number;
};

const WEEKDAY_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/**
 * Reads calendar parts of `date` in America/Sao_Paulo.
 */
export function readSaoPauloClock(date: Date): ZonedClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ACESSO_TIME_ZONE,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekday = byType.weekday ?? '';
  const isoWeekday = WEEKDAY_TO_ISO[weekday] ?? 0;
  const hour = Number(byType.hour);
  const minute = Number(byType.minute);

  return {
    year: Number(byType.year),
    month: Number(byType.month),
    day: Number(byType.day),
    hour,
    minute,
    isoWeekday,
    minutesOfDay: hour * 60 + minute,
  };
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function calendarKey(clock: Pick<ZonedClock, 'year' | 'month' | 'day'>) {
  return `${clock.year}-${pad2(clock.month)}-${pad2(clock.day)}`;
}

/**
 * Builds a Date for a São Paulo wall-clock instant (UTC−3, no DST).
 */
export function dateFromSaoPauloWallClock(isoLocal: string) {
  return new Date(`${isoLocal}-03:00`);
}

/**
 * Moves `now` to 20h10 in São Paulo when the floor is still open, so sandbox tests the night bot.
 */
export function sandboxNightInstant(now: Date) {
  if (!isBusinessOpen(now)) {
    return now;
  }
  const clock = readSaoPauloClock(now);
  return dateFromSaoPauloWallClock(`${calendarKey(clock)}T20:10:00`);
}

function shiftCalendarDay(
  clock: Pick<ZonedClock, 'year' | 'month' | 'day'>,
  dayDelta: number,
) {
  const shifted = new Date(Date.UTC(clock.year, clock.month - 1, clock.day + dayDelta));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function isWeekday(isoWeekday: number) {
  return isoWeekday >= 1 && isoWeekday <= 5;
}

/**
 * True when commercial attendance is on the floor (Mon–Fri 7h30–17h15 SP).
 */
export function isBusinessOpen(date: Date) {
  const clock = readSaoPauloClock(date);
  if (!isWeekday(clock.isoWeekday)) {
    return false;
  }
  return clock.minutesOfDay >= ACESSO_OPEN_MINUTES
    && clock.minutesOfDay < ACESSO_CLOSE_MINUTES;
}

export type OffHoursWindow = {
  id: string;
  startedAt: Date;
};

function lastFridayOnOrBefore(clock: ZonedClock) {
  const delta = clock.isoWeekday >= 6
    ? clock.isoWeekday - 5
    : clock.isoWeekday === 1
      ? 3
      : 0;
  if (delta === 0 && isWeekday(clock.isoWeekday)) {
    return { year: clock.year, month: clock.month, day: clock.day, isoWeekday: clock.isoWeekday };
  }
  const day = shiftCalendarDay(clock, -delta);
  return { ...day, isoWeekday: 5 };
}

/**
 * Closed period that started at the last weekday 17h15, or null during expediente.
 */
export function offHoursWindow(
  date: Date,
  options?: { ignoreOpenFloor?: boolean },
): OffHoursWindow | null {
  if (options?.ignoreOpenFloor && isBusinessOpen(date)) {
    const clock = readSaoPauloClock(date);
    return {
      id: `${calendarKey(clock)}-force`,
      startedAt: dateFromSaoPauloWallClock(`${calendarKey(clock)}T00:00:00`),
    };
  }
  if (isBusinessOpen(date)) {
    return null;
  }

  const clock = readSaoPauloClock(date);
  let closeDay: { year: number; month: number; day: number };

  if (isWeekday(clock.isoWeekday) && clock.minutesOfDay >= ACESSO_CLOSE_MINUTES) {
    closeDay = { year: clock.year, month: clock.month, day: clock.day };
  } else if (clock.isoWeekday === 1 || clock.isoWeekday >= 6) {
    closeDay = lastFridayOnOrBefore(clock);
  } else {
    closeDay = shiftCalendarDay(clock, -1);
  }

  const startedAt = dateFromSaoPauloWallClock(
    `${calendarKey(closeDay)}T17:15:00`,
  );

  return {
    id: `${calendarKey(closeDay)}-after`,
    startedAt,
  };
}
