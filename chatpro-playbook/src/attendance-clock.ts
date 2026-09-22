import { dateFromSaoPauloWallClock, readSaoPauloClock, type ZonedClock } from './duty-hours.js';

const WEEKDAY_LONG = [
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
  'domingo',
] as const;

const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

const WEEKDAY_ISO: Array<[RegExp, number]> = [
  [/\bsegunda(?:-feira)?\b/u, 1],
  [/\bterca(?:-feira)?\b/u, 2],
  [/\bquarta(?:-feira)?\b/u, 3],
  [/\bquinta(?:-feira)?\b/u, 4],
  [/\bsexta(?:-feira)?\b/u, 5],
  [/\bsabado\b/u, 6],
  [/\bdomingo\b/u, 7],
];

export type StartWhen = 'past' | 'today' | 'future' | 'none';

function fold(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function compareYmd(
  year: number,
  month: number,
  day: number,
  clock: ZonedClock,
): Exclude<StartWhen, 'none'> {
  const wanted = Date.UTC(year, month - 1, day);
  const today = Date.UTC(clock.year, clock.month - 1, clock.day);
  if (wanted < today) {
    return 'past';
  }
  if (wanted > today) {
    return 'future';
  }
  return 'today';
}

/** Long date in São Paulo, e.g. terça-feira, 8 de setembro de 2026. */
export function formatSaoPauloLongDate(date: Date) {
  const clock = readSaoPauloClock(date);
  const weekday = WEEKDAY_LONG[clock.isoWeekday - 1] ?? 'dia';
  const month = MONTH_NAMES[clock.month - 1] ?? '';
  return `${weekday}, ${clock.day} de ${month} de ${clock.year}`;
}

/**
 * Desk clock the attendant must use to interpret “hoje”, weekdays and returning leads.
 */
export function formatAttendanceDeskClock(now: Date) {
  const clock = readSaoPauloClock(now);
  const weekday = WEEKDAY_LONG[clock.isoWeekday - 1] ?? 'dia';
  const month = MONTH_NAMES[clock.month - 1] ?? '';
  return [
    `Relógio da mesa: hoje é ${weekday}, ${clock.day} de ${month} de ${clock.year}, ${pad2(clock.hour)}h${pad2(clock.minute)} (America/Sao_Paulo).`,
    'Expediente: segunda a sexta, 7h30–17h15.',
    'Interprete “hoje”, “amanhã”, “dessa semana”, “semana que vem” e o nome do dia a partir desta data.',
    'Quando o cliente disser um dia relativo, confirme a data do calendário (ex.: terça-feira, 15 de setembro de 2026).',
    'Não existe locação começando ontem nem em dia que já passou: se o cliente disser isso, é erro, digitação ou confusão. Peça hoje, amanhã ou outro dia futuro.',
  ].join(' ');
}

/**
 * Classifies a mentioned rental start against today in São Paulo.
 * Last mention in the text wins. A bare weekday is the next occurrence (this week or next);
 * only “ontem”, “passada” or “dessa semana” already elapsed count as past.
 */
export function classifyMentionedStart(text: string, now: Date): StartWhen {
  const t = fold(text);
  const clock = readSaoPauloClock(now);
  const hits: Array<{ index: number; when: Exclude<StartWhen, 'none'> }> = [];
  const push = (index: number, when: Exclude<StartWhen, 'none'>) => {
    hits.push({ index, when });
  };

  for (const match of t.matchAll(/\b(ontem|anteontem)\b/gu)) {
    push(match.index ?? 0, 'past');
  }
  for (const match of t.matchAll(/\bhoje\b/gu)) {
    push(match.index ?? 0, 'today');
  }
  for (const match of t.matchAll(/\bdepois de amanha\b/gu)) {
    push(match.index ?? 0, 'future');
  }
  for (const match of t.matchAll(/\bamanha\b/gu)) {
    if (match.index !== undefined && t.slice(Math.max(0, match.index - 11), match.index).includes('depois de')) {
      continue;
    }
    push(match.index ?? 0, 'future');
  }

  for (const match of t.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/gu)) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    let year = match[3] ? Number(match[3]) : clock.year;
    if (year < 100) {
      year += 2000;
    }
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      push(match.index ?? 0, compareYmd(year, month, day, clock));
    }
  }

  const thisWeekAround = (index: number) => {
    const window = t.slice(Math.max(0, index - 24), index + 48);
    return /dessa semana|desta semana|esta semana|essa semana/u.test(window);
  };
  const lastWeekAround = (index: number) => {
    const window = t.slice(Math.max(0, index - 24), index + 40);
    return /semana passada|passad[ao]/u.test(window);
  };
  const nextWeekAround = (index: number) => {
    const window = t.slice(Math.max(0, index - 16), index + 40);
    return /proxima semana|semana que vem|que vem/u.test(window);
  };

  for (const [pattern, iso] of WEEKDAY_ISO) {
    const global = new RegExp(pattern.source, 'gu');
    for (const match of t.matchAll(global)) {
      const index = match.index ?? 0;
      if (lastWeekAround(index)) {
        push(index, 'past');
        continue;
      }
      if (nextWeekAround(index)) {
        push(index, 'future');
        continue;
      }
      if (thisWeekAround(index)) {
        if (iso === clock.isoWeekday) {
          push(index, 'today');
        } else if (iso > clock.isoWeekday) {
          push(index, 'future');
        } else {
          push(index, 'past');
        }
        continue;
      }
      if (iso === clock.isoWeekday) {
        push(index, 'today');
      } else {
        push(index, 'future');
      }
    }
  }

  hits.sort((left, right) => left.index - right.index);
  return hits.at(-1)?.when ?? 'none';
}

function ymdDate(year: number, month: number, day: number) {
  return dateFromSaoPauloWallClock(`${year}-${pad2(month)}-${pad2(day)}T12:00:00`);
}

function shiftClockDays(clock: ZonedClock, days: number) {
  const utc = Date.UTC(clock.year, clock.month - 1, clock.day + days);
  const shifted = new Date(utc);
  return ymdDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

function nextWeekdayOccurrence(clock: ZonedClock, iso: number) {
  let delta = iso - clock.isoWeekday;
  if (delta < 0) {
    delta += 7;
  }
  return shiftClockDays(clock, delta);
}

function weekdayOfNextWeek(clock: ZonedClock, iso: number) {
  const daysUntilNextMonday = (8 - clock.isoWeekday) % 7 || 7;
  return shiftClockDays(clock, daysUntilNextMonday + (iso - 1));
}

/**
 * Calendar day in São Paulo for the last start the customer mentioned, or null.
 */
export function resolveMentionedStartDate(text: string, now: Date) {
  const t = fold(text);
  const clock = readSaoPauloClock(now);
  const hits: Array<{ index: number; date: Date }> = [];
  const push = (index: number, date: Date) => {
    hits.push({ index, date });
  };

  for (const match of t.matchAll(/\bontem\b/gu)) {
    push(match.index ?? 0, shiftClockDays(clock, -1));
  }
  for (const match of t.matchAll(/\banteontem\b/gu)) {
    push(match.index ?? 0, shiftClockDays(clock, -2));
  }
  for (const match of t.matchAll(/\bhoje\b/gu)) {
    push(match.index ?? 0, ymdDate(clock.year, clock.month, clock.day));
  }
  for (const match of t.matchAll(/\bdepois de amanha\b/gu)) {
    push(match.index ?? 0, shiftClockDays(clock, 2));
  }
  for (const match of t.matchAll(/\bamanha\b/gu)) {
    if (match.index !== undefined && t.slice(Math.max(0, match.index - 11), match.index).includes('depois de')) {
      continue;
    }
    push(match.index ?? 0, shiftClockDays(clock, 1));
  }

  for (const match of t.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/gu)) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    let year = match[3] ? Number(match[3]) : clock.year;
    if (year < 100) {
      year += 2000;
    }
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      push(match.index ?? 0, ymdDate(year, month, day));
    }
  }

  const thisWeekAround = (index: number) => {
    const window = t.slice(Math.max(0, index - 24), index + 48);
    return /dessa semana|desta semana|esta semana|essa semana/u.test(window);
  };
  const lastWeekAround = (index: number) => {
    const window = t.slice(Math.max(0, index - 24), index + 40);
    return /semana passada|passad[ao]/u.test(window);
  };
  const nextCalendarWeekAround = (index: number) => {
    const window = t.slice(Math.max(0, index - 28), index + 40);
    return /proxima semana|semana que vem/u.test(window);
  };

  for (const [pattern, iso] of WEEKDAY_ISO) {
    const global = new RegExp(pattern.source, 'gu');
    for (const match of t.matchAll(global)) {
      const index = match.index ?? 0;
      if (lastWeekAround(index)) {
        push(index, shiftClockDays(clock, iso - clock.isoWeekday - 7));
        continue;
      }
      if (nextCalendarWeekAround(index)) {
        push(index, weekdayOfNextWeek(clock, iso));
        continue;
      }
      if (thisWeekAround(index)) {
        const delta = iso - clock.isoWeekday;
        push(index, shiftClockDays(clock, delta));
        continue;
      }
      push(index, nextWeekdayOccurrence(clock, iso));
    }
  }

  hits.sort((left, right) => left.index - right.index);
  return hits.at(-1)?.date ?? null;
}

/** Confirmed start as a long São Paulo date, when the mention is not in the past. */
export function formatConfirmedStart(text: string, now: Date) {
  const date = resolveMentionedStartDate(text, now);
  if (!date || classifyMentionedStart(text, now) === 'past') {
    return null;
  }
  return formatSaoPauloLongDate(date);
}

/** True when `date` falls on the same São Paulo calendar day as `now`. */
export function sameSaoPauloDay(date: Date, now: Date) {
  const left = readSaoPauloClock(date);
  const right = readSaoPauloClock(now);
  return left.year === right.year && left.month === right.month && left.day === right.day;
}

/** Greeting that matches the São Paulo clock. */
export function formatAttendanceGreeting(now: Date) {
  const hour = readSaoPauloClock(now).hour;
  if (hour < 12) {
    return 'Bom dia!';
  }
  if (hour < 18) {
    return 'Boa tarde!';
  }
  return 'Boa noite!';
}

/**
 * First bot-turn calendar day in the thread, if it is not today.
 */
export function previousAttendanceLabel(history: Array<{ origin?: string; role: string; at?: Date }>, now: Date) {
  const firstBot = history.find((turn) => {
    const origin = turn.origin ?? (turn.role === 'assistant' ? 'bot' : 'customer');
    return origin === 'bot' && turn.at instanceof Date && !Number.isNaN(turn.at.getTime());
  });
  if (!firstBot?.at) {
    return null;
  }
  const first = readSaoPauloClock(firstBot.at);
  const today = readSaoPauloClock(now);
  if (first.year === today.year && first.month === today.month && first.day === today.day) {
    return null;
  }
  return formatSaoPauloLongDate(firstBot.at);
}

/** São Paulo wall-clock Date used only in tests and clock helpers. */
export function saoPauloAt(isoLocal: string) {
  return dateFromSaoPauloWallClock(isoLocal);
}
