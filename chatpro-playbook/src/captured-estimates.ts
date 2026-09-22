export type CapturedEstimate = {
  equipment: string;
  rentalDays: string;
  amount: string;
  family: string;
  dayCounts: number[];
};

function moneyPattern() {
  return /r\$\s*[\d.][\d.,]*|[\d.][\d.,]*\s*reais/giu;
}

const PRICE_ASK =
  /pre[cç]o|valor|quanto (?:custa|fica|sai)|estimado|or[cç]ament|di[áa]ria/iu;

function fold(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/**
 * Digits-only money tokens so R$ 4.800 and 4800 reais compare equal.
 */
export function moneyTokens(text: string) {
  return [...text.matchAll(moneyPattern())].map((match) => match[0].replace(/\D/gu, '')).filter(Boolean);
}

/**
 * Equipment family used to match a captured proposal to the current ask.
 */
export function estimateFamily(text: string) {
  const t = fold(text);
  if (/martelete|martele|\bmartelo\b/.test(t)) {
    return 'martelete';
  }
  if (/betoneira/.test(t)) {
    return 'betoneira';
  }
  if (/esmerilh/.test(t)) {
    return 'esmerilhadeira';
  }
  if (/andaime/.test(t)) {
    return 'andaime';
  }
  if (/tesoura/.test(t)) {
    return 'tesoura';
  }
  if (/articulada|cherry/.test(t)) {
    return 'articulada';
  }
  if (/franna|guindaste/.test(t)) {
    return 'guindaste';
  }
  if (/gerador/.test(t)) {
    return 'gerador';
  }
  if (/manitou|manipulador/.test(t)) {
    return 'manitou';
  }
  if (/paleteira/.test(t)) {
    return 'paleteira';
  }
  if (/compactador|placa vibrat/.test(t)) {
    return 'compactador';
  }
  if (/compressor/.test(t)) {
    return 'compressor';
  }
  if (/guincho|grua/.test(t)) {
    return 'guincho';
  }
  if (/lan[cç]a/.test(t)) {
    return 'lanca';
  }
  if (/mastro/.test(t)) {
    return 'mastro';
  }
  if (/plataforma/.test(t)) {
    return 'plataforma';
  }
  return null;
}

/**
 * Rental lengths mentioned in a query or in a captured "período citado".
 */
export function parseRentalDayCounts(text: string, options?: { citedPeriod?: boolean }) {
  const t = fold(text);
  const days = new Set<number>();
  for (const match of t.matchAll(/(\d+)\s*dias/gu)) {
    days.add(Number(match[1]));
  }
  for (const match of t.matchAll(/(\d+)\s*meses/gu)) {
    days.add(Number(match[1]) * 30);
  }
  if (/\b(?:uma semana|1 semana|semanal)\b/u.test(t)) {
    days.add(7);
  }
  if (/\bquinzena\b/u.test(t)) {
    days.add(15);
  }
  if (/\b(?:mensal|um mes|1 mes)\b/u.test(t)) {
    days.add(30);
  }
  if (/\b(?:1 dia|um dia|por di[aá]ria)\b/u.test(t) || options?.citedPeriod && /\bdiaria\b/u.test(t)) {
    days.add(1);
  }
  return [...days];
}

/**
 * True when the customer already said when the rental should start.
 */
export function mentionsRentalStart(text: string) {
  const t = fold(text);
  if (/para quando|quando (?:precisa|seria|comeca|inicia|quer)|data de inicio|data de comeco/.test(t)) {
    return true;
  }
  if (/\b(amanha|depois de amanha|hoje|esta semana|proxima semana|fim de semana|urgente)\b/.test(t)) {
    return true;
  }
  if (/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/.test(t)) {
    return true;
  }
  if (/\bdia\s+\d{1,2}\b/.test(t)) {
    return true;
  }
  return /\b(segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:-feira)?\b/.test(t);
}

/**
 * True when the bot already asked when the rental should start.
 */
export function replyAsksRentalStart(text: string) {
  return /para quando|data de in[ií]cio|quando (?:você |voce )?precisa|quando (?:seria|come[cç]a)|come[cç]ar(?:ia)? quando|come[cç]a quando|data.{0,48}precisa come[cç]ar|in[ií]cio da loca/iu.test(text);
}

function firstMoney(text: string) {
  const match = moneyPattern().exec(text);
  return match?.[0]?.replace(/\s+/gu, ' ').trim() ?? null;
}

/**
 * Reads unofficial rental amounts from Valores captados markdown. Ignores freight lines.
 */
export function parseCapturedValueNotes(markdown: string) {
  const rows: CapturedEstimate[] = [];
  for (const section of markdown.split(/^## /mu).slice(1)) {
    const equipment = section.split(/\r?\n/u)[0]?.trim() ?? '';
    const rentalDays = /Período citado:\s*(.+)/iu.exec(section)?.[1]?.trim() ?? '';
    const mentioned = /Captado em conversa[^\n]*:\s*(.+)/iu.exec(section)?.[1]?.trim() ?? '';
    const amount = firstMoney(mentioned);
    const family = estimateFamily(`${equipment} ${mentioned}`);
    if (!equipment || !amount || !family) {
      continue;
    }
    const dayCounts = parseRentalDayCounts(rentalDays, { citedPeriod: true });
    if (dayCounts.length === 0) {
      continue;
    }
    rows.push({
      equipment,
      rentalDays,
      amount,
      family,
      dayCounts,
    });
  }
  return rows;
}

/**
 * True when the thread is asking for a price and already named type plus period.
 */
export function shouldRetrieveCapturedEstimate(userTurns: string[]) {
  const blob = userTurns.join('\n');
  return PRICE_ASK.test(blob)
    && Boolean(estimateFamily(blob))
    && parseRentalDayCounts(blob).length > 0;
}

/**
 * Picks at most one unofficial estimate for the same family and day count.
 */
export function matchCapturedEstimates(options: {
  rows: CapturedEstimate[];
  userTurns: string[];
}) {
  const blob = options.userTurns.join('\n');
  const family = estimateFamily(blob);
  const days = parseRentalDayCounts(blob);
  if (!family || days.length === 0) {
    return [];
  }
  return options.rows
    .filter((row) => row.family === family && row.dayCounts.some((day) => days.includes(day)))
    .slice(0, 1);
}

/**
 * Prompt block: unofficial rental faixa only. Never includes freight.
 */
export function formatCapturedEstimateBlock(rows: CapturedEstimate[]) {
  const row = rows[0];
  if (!row) {
    return '';
  }
  return [
    '## Estimativa não oficial',
    `Tipo: ${row.equipment}`,
    `Período: ${row.rentalDays}`,
    `Faixa captada em proposta equivalente: ${row.amount}`,
    'Não é tabela oficial. Só cite se o pedido for o mesmo tipo e o mesmo período. Diga que o comercial confirma.',
    'Não cite frete nem disponibilidade.',
  ].join('\n');
}

/**
 * True when every money token in the reply also appears in the retrieved estimate block.
 */
export function isGroundedUnofficialEstimate(text: string, retrieved: string) {
  if (!/estimativa não oficial/iu.test(retrieved)) {
    return false;
  }
  if (!/n[aã]o.{0,24}(oficial|tabela)|faixa|estimad[oa]/iu.test(text)) {
    return false;
  }
  if (!/comercial/iu.test(text)) {
    return false;
  }
  const quoted = moneyTokens(text);
  if (quoted.length === 0) {
    return false;
  }
  const allowed = new Set(moneyTokens(retrieved));
  return quoted.every((token) => allowed.has(token));
}
