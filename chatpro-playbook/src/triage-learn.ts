import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  estimateFamily,
  mentionsRentalStart,
  parseRentalDayCounts,
  replyAsksRentalStart,
} from './captured-estimates.js';
import { redactCustomerPii } from './redact.js';
import { scrubTriageCopy } from './schema.js';

export const TRIAGE_LEARN_FILE = 'Aprendizado da triagem.md';

export type TriageLearnMessage = {
  from_me: boolean;
  bot_origin?: boolean;
  body: string | null;
};

export type TriageLearnThread = {
  messages: TriageLearnMessage[];
};

export type TriageLearnNote = {
  keep: string[];
  fix: string[];
  sandbox: string[];
};

type LessonKind = 'keep' | 'fix';

type LessonAcc = {
  id: string;
  kind: LessonKind;
  text: string;
  count: number;
};

const CITY_LIKE =
  /\b(belo horizonte|\bbh\b|contagem|betim|nova lima|ribeir[aã]o das neves|santa luzia|vespasiano|sabar[aá]|ibirité|ibirite|lagoa santa|sarzedo|brumadinho|rmbh|s[aã]o paulo|curitiba|uberl[aâ]ndia|cidade da obra|munic[ií]pio)\b/iu;
const ASKS_CITY = /cidade da obra|qual (?:a |é a )?cidade|em qual cidade|munic[ií]pio/iu;
const ASKS_DAYS = /quantos dias|por quantos dias|qual o per[ií]odo/iu;
const ASKS_TYPE = /qual equipamento|o que (?:você |voce )?precisa|qual (?:a )?(?:m[aá]quina|equipamento)/iu;
const TEAM_ASKS_START = /para quando|data de in[ií]cio|quando (?:come[cç]a|seria)|come[cç]ar(?:ia)? quando/iu;

const SANDBOX_FIX: Record<string, string> = {
  'pede para quando começa': 'Peça para quando começa a locação se o cliente ainda não disse a data.',
  'pede o equipamento': 'Se o cliente só cumprimentou, pergunte o equipamento.',
  'confirma tesoura': 'Nomeie tesoura quando o pedido for tesoura. Não omita o tipo nem troque por articulada.',
  'confirma betoneira': 'Se o cliente pediu tesoura e betoneira, nomeie os dois tipos.',
  'não repregunta início já dito': 'Se o cliente já disse amanhã, urgente ou uma data, não pergunte de novo para quando.',
  'recusa empilhadeira': 'Fora do catálogo, diga que não locamos o tipo pedido.',
  'recusa caminhão': 'Não locamos caminhão. Diga isso e pergunte se precisa de algo do catálogo.',
};

function foldBody(message: TriageLearnMessage) {
  return (message.body ?? '').trim();
}

function joinBodies(messages: TriageLearnMessage[]) {
  return messages.map(foldBody).filter(Boolean).join('\n');
}

function mentionsCity(text: string) {
  return CITY_LIKE.test(text);
}

function uniqueLines(lines: string[], limit: number) {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (!line || seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(line);
    if (next.length >= limit) {
      break;
    }
  }
  return next;
}

function withCount(text: string, count: number) {
  if (count <= 1) {
    return text;
  }
  return `${text} (${count} conversas)`;
}

function bump(acc: Map<string, LessonAcc>, lesson: Omit<LessonAcc, 'count'>) {
  const prior = acc.get(lesson.id);
  if (prior) {
    prior.count += 1;
    return;
  }
  acc.set(lesson.id, { ...lesson, count: 1 });
}

/**
 * Turns one ChatPro thread with bot lines into keep/fix lessons for the night triage.
 */
export function learnTriageFromThread(thread: TriageLearnThread) {
  const acc = new Map<string, LessonAcc>();
  const bot = thread.messages.filter((message) => message.bot_origin === true);
  if (bot.length === 0) {
    return acc;
  }

  const firstBot = thread.messages.findIndex((message) => message.bot_origin === true);
  const afterBot = firstBot >= 0 ? thread.messages.slice(firstBot) : [];
  const customer = thread.messages.filter((message) => !message.from_me);
  const teamAfter = afterBot.filter((message) => message.from_me && message.bot_origin !== true);
  const customerBlob = joinBodies(customer);
  const botBlob = joinBodies(bot);
  const teamBlob = joinBodies(teamAfter);

  const hasType = Boolean(estimateFamily(customerBlob));
  const hasCity = mentionsCity(customerBlob);
  const hasDays = parseRentalDayCounts(customerBlob).length > 0;
  const hasStart = mentionsRentalStart(customerBlob);
  const botAskedStart = replyAsksRentalStart(botBlob);
  const botAskedCity = ASKS_CITY.test(botBlob);
  const botAskedDays = ASKS_DAYS.test(botBlob);
  const botAskedType = ASKS_TYPE.test(botBlob);
  const complete = hasType && hasCity && hasDays && hasStart;

  if (complete && (botAskedStart || botAskedCity || botAskedDays || botAskedType)) {
    bump(acc, {
      id: 'fix-reask-complete',
      kind: 'fix',
      text: 'Se já tem tipo, cidade, para quando e prazo, zero perguntas novas. Só confirme e diga que o comercial retorna.',
    });
  } else if (complete) {
    bump(acc, {
      id: 'keep-complete-handoff',
      kind: 'keep',
      text: 'Quando tipo, cidade, para quando e prazo já vieram, confirme o tipo e passe ao comercial no horário útil.',
    });
  }

  if (hasType && !hasStart && !botAskedStart && TEAM_ASKS_START.test(teamBlob)) {
    bump(acc, {
      id: 'fix-start-missing',
      kind: 'fix',
      text: 'Peça para quando começa a locação. O comercial teve que completar a data depois da triagem.',
    });
  }

  if (hasType && !hasCity && !botAskedCity && ASKS_CITY.test(teamBlob)) {
    bump(acc, {
      id: 'fix-city-missing',
      kind: 'fix',
      text: 'Peça a cidade da obra se ainda não veio. O comercial teve que perguntar depois.',
    });
  }

  if (hasType && !hasDays && !botAskedDays && ASKS_DAYS.test(teamBlob)) {
    bump(acc, {
      id: 'fix-days-missing',
      kind: 'fix',
      text: 'Peça por quantos dias se o período ainda não veio. O comercial teve que completar depois.',
    });
  }

  if (!hasType && botAskedType) {
    bump(acc, {
      id: 'keep-ask-type',
      kind: 'keep',
      text: 'No primeiro toque sem tipo, pergunte o equipamento. Sem lista da frota.',
    });
  }

  const tesoura = /tesoura/iu.test(customerBlob);
  const betoneira = /betoneira/iu.test(customerBlob);
  if (tesoura && betoneira && /tesoura/iu.test(botBlob) && !/betoneira/iu.test(botBlob)) {
    bump(acc, {
      id: 'fix-two-types',
      kind: 'fix',
      text: 'Se o cliente pediu dois tipos do catálogo, nomeie os dois. Não confirme só o primeiro.',
    });
  }

  return acc;
}

/**
 * Merges keep/fix lessons from several threads that the night bot already touched.
 */
export function learnTriageFromThreads(threads: TriageLearnThread[]) {
  const acc = new Map<string, LessonAcc>();
  for (const thread of threads) {
    for (const lesson of learnTriageFromThread(thread).values()) {
      const prior = acc.get(lesson.id);
      if (prior) {
        prior.count += lesson.count;
        continue;
      }
      acc.set(lesson.id, { ...lesson });
    }
  }
  const keep: string[] = [];
  const fix: string[] = [];
  for (const lesson of acc.values()) {
    const line = withCount(lesson.text, lesson.count);
    if (lesson.kind === 'keep') {
      keep.push(line);
    } else {
      fix.push(line);
    }
  }
  return {
    keep: uniqueLines(keep, 8),
    fix: uniqueLines(fix, 8),
  };
}

function sandboxLine(failure: string) {
  const colon = failure.indexOf(':');
  const judgesPart = colon >= 0 ? failure.slice(colon + 1) : failure;
  const judges = judgesPart.split(',').map((part) => part.trim()).filter(Boolean);
  if (judges.length === 0) {
    return scrubTriageCopy(`Não repita a falha de triagem: ${failure}.`);
  }
  return judges.map((judge) => {
    const mapped = SANDBOX_FIX[judge];
    return scrubTriageCopy(mapped ?? `Não repita a falha de triagem: ${judge}.`);
  }).join(' ');
}

/**
 * Turns sandbox battery/probe/catalog failure ids into bot-facing fix lines.
 */
export function sandboxFailuresToLines(failures: string[]) {
  return uniqueLines(failures.map(sandboxLine), 12);
}

function sectionLines(body: string, heading: string) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = body.match(new RegExp(`## ${escaped}\\n([\\s\\S]*?)(?=\\n## |$)`, 'u'));
  if (!match?.[1]) {
    return [];
  }
  return match[1]
    .split('\n')
    .map((line) => line.replace(/^- /, '').trim())
    .filter((line) => line && line !== 'Nenhum ainda.');
}

/**
 * Reads keep/fix/sandbox blocks from an existing triage-learn note.
 */
export function parseTriageLearnNote(body: string): TriageLearnNote {
  return {
    keep: sectionLines(body, 'O que repetir'),
    fix: sectionLines(body, 'O que não repetir'),
    sandbox: sectionLines(body, 'Falhas da sandbox'),
  };
}

function renderList(lines: string[]) {
  if (lines.length === 0) {
    return ['Nenhum ainda.'];
  }
  return lines.map((line) => `- ${line}`);
}

/**
 * Markdown the attendance bot reads. Not a commercial playbook.
 */
export function formatTriageLearnNote(options: {
  note: TriageLearnNote;
  now?: Date;
}) {
  const now = options.now ?? new Date();
  const keep = uniqueLines(options.note.keep.map((line) => scrubTriageCopy(redactCustomerPii(line))), 8);
  const fix = uniqueLines(options.note.fix.map((line) => scrubTriageCopy(redactCustomerPii(line))), 8);
  const sandbox = uniqueLines(
    options.note.sandbox.map((line) => scrubTriageCopy(redactCustomerPii(line))),
    12,
  );
  return [
    '---',
    'title: Aprendizado da triagem',
    'tipo: playbook-comercial',
    'equipe: comercial',
    `gerado: ${now.toISOString()}`,
    'fonte: chatpro-playbook',
    'regra: nunca-confirmar-preco-nem-frete',
    'publico: bot-triagem',
    '---',
    '',
    '# Aprendizado da triagem',
    '',
    'O bot lê isto. **Não** mistura com o jeito do comercial. Só acerto e erro da triagem noturna (WhatsApp + sandbox).',
    '',
    '## O que repetir',
    '',
    ...renderList(keep),
    '',
    '## O que não repetir',
    '',
    ...renderList(fix),
    '',
    '## Falhas da sandbox',
    '',
    ...renderList(sandbox),
    '',
  ].join('\n');
}

function notePath(vaultPath: string, folder: string) {
  return join(vaultPath, ...folder.split(/[\\/]/u), TRIAGE_LEARN_FILE);
}

function readExistingNote(path: string): TriageLearnNote {
  if (!existsSync(path)) {
    return { keep: [], fix: [], sandbox: [] };
  }
  return parseTriageLearnNote(readFileSync(path, 'utf8'));
}

function writeNote(path: string, note: TriageLearnNote, now: Date) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, formatTriageLearnNote({ note, now }), 'utf8');
  return path;
}

/**
 * Writes keep/fix from live ChatPro threads. Keeps the last sandbox block.
 */
export function writeTriageLearnFromThreads(options: {
  vaultPath: string;
  folder: string;
  threads: TriageLearnThread[];
  now?: Date;
}) {
  const now = options.now ?? new Date();
  const path = notePath(options.vaultPath, options.folder);
  const prior = readExistingNote(path);
  const learned = learnTriageFromThreads(options.threads);
  return writeNote(path, {
    keep: learned.keep,
    fix: learned.fix,
    sandbox: prior.sandbox,
  }, now);
}

/**
 * Writes the latest sandbox run into the triage-learn note. Keeps WhatsApp keep/fix.
 */
export function recordSandboxTriageRun(options: {
  vaultPath: string;
  folder: string;
  suite: string;
  failures: string[];
  now?: Date;
}) {
  const now = options.now ?? new Date();
  const path = notePath(options.vaultPath, options.folder);
  const prior = readExistingNote(path);
  const stamp = now.toISOString().slice(0, 16);
  const sandbox = options.failures.length === 0
    ? [`${options.suite} ${stamp}: todos os casos passaram.`]
    : [
      `${options.suite} ${stamp}: ${options.failures.length} falha(s).`,
      ...sandboxFailuresToLines(options.failures),
    ];
  return writeNote(path, {
    keep: prior.keep,
    fix: prior.fix,
    sandbox,
  }, now);
}
