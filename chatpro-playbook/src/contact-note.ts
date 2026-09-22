import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isAttendanceTeamReply } from './after-hours-decide.js';
import { allTeamFolders, companyFolderFromPlaybookFolder, type AttendanceTeam } from './attendance-team.js';
import type { InboxThread } from './inbox-snapshot.js';
import { formatPlaybookMessageBody } from './media.js';
import { phoneKeyFromWhatsAppAddress } from './parse-chatpro.js';
import { redactCustomerPii } from './redact.js';

const HUMAN_START = '<!-- notas-equipe -->';
const HUMAN_END = '<!-- /notas-equipe -->';
const HUMAN_STUB = '(escreva aqui; o worker não apaga este bloco)';

export type ContactFollowUp = {
  needed: boolean;
  reason: string | null;
};

export type ContactContext = {
  noteId: string;
  phoneKey: string | null;
  sessionId: string;
  displayName: string;
  followUp: ContactFollowUp;
  lastCustomerLine: string | null;
  lastTeamLine: string | null;
  attendanceSummary: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function lineFromMessage(message: InboxThread['messages'][number]) {
  const who = message.bot_origin ? 'Bot' : message.from_me ? 'Equipe' : 'Cliente';
  const body = redactCustomerPii(formatPlaybookMessageBody({
    body: message.body,
    mediaText: message.media_text ?? null,
    mediaType: message.media_type,
  })).slice(0, 280);
  return `${who}: ${body}`;
}

function phoneFromMessageRaw(raw: Record<string, unknown> | undefined) {
  const record = asRecord(raw);
  return phoneKeyFromWhatsAppAddress(
    typeof record.number === 'string' ? record.number : null,
  );
}

/**
 * Stable id for the contact note. Prefers the WhatsApp number.
 */
export function contactNoteId(options: {
  phoneKey: string | null;
  sessionId: string;
}) {
  if (options.phoneKey && options.phoneKey.length >= 10) {
    return options.phoneKey;
  }
  return `sessao-${options.sessionId.replace(/[^a-zA-Z0-9]/gu, '').slice(0, 12)}`;
}

/**
 * Reads the WhatsApp number from the session or from message payloads.
 */
export function resolveContactPhoneKey(thread: InboxThread) {
  if (thread.session.phone_key && thread.session.phone_key.length >= 10) {
    return thread.session.phone_key;
  }
  for (const message of thread.messages.toReversed()) {
    const phone = phoneFromMessageRaw(message.raw);
    if (phone) {
      return phone;
    }
  }
  return null;
}

/**
 * Follow-up when the last real message is the customer's (team has not answered).
 */
export function contactFollowUp(thread: InboxThread): ContactFollowUp {
  const meaningful = thread.messages.filter((message) => {
    if (!message.from_me) {
      return true;
    }
    return isAttendanceTeamReply({
      id: message.id,
      fromMe: message.from_me,
      body: message.body,
      mediaType: message.media_type,
      sentAt: message.sent_at,
      botOrigin: message.bot_origin === true,
    });
  });
  const last = meaningful.at(-1);
  if (!last || last.from_me) {
    return { needed: false, reason: null };
  }
  return { needed: true, reason: 'cliente-aguardando-resposta' };
}

/**
 * Builds the retrieval payload the bot loads only on return or follow-up.
 */
export function buildContactContext(thread: InboxThread, attendanceSummary?: string | null): ContactContext | null {
  const raw = asRecord(thread.session.raw);
  if (raw.group === true || raw.group === 'true') {
    return null;
  }
  const phoneKey = resolveContactPhoneKey(thread);
  const lastCustomer = thread.messages.toReversed().find((message) => !message.from_me);
  const lastTeam = thread.messages.toReversed().find((message) =>
    isAttendanceTeamReply({
      id: message.id,
      fromMe: message.from_me,
      body: message.body,
      mediaType: message.media_type,
      sentAt: message.sent_at,
      botOrigin: message.bot_origin === true,
    }),
  );
  const name = thread.session.contact_name?.trim()
    ? redactCustomerPii(thread.session.contact_name)
    : 'Contato';

  return {
    noteId: contactNoteId({ phoneKey, sessionId: thread.session.id }),
    phoneKey,
    sessionId: thread.session.id,
    displayName: name,
    followUp: contactFollowUp(thread),
    lastCustomerLine: lastCustomer ? lineFromMessage(lastCustomer) : null,
    lastTeamLine: lastTeam ? lineFromMessage(lastTeam) : null,
    attendanceSummary: attendanceSummary?.trim() || null,
  };
}

function extractHumanNotes(existing: string) {
  const start = existing.indexOf(HUMAN_START);
  const end = existing.indexOf(HUMAN_END);
  if (start < 0 || end < 0 || end <= start) {
    return HUMAN_STUB;
  }
  const inner = existing.slice(start + HUMAN_START.length, end).trim();
  return inner || HUMAN_STUB;
}

function renderContactNote(options: {
  context: ContactContext;
  thread: InboxThread;
  humanNotes: string;
  now: Date;
  team: AttendanceTeam;
}) {
  const recent = options.thread.messages.slice(-4).map((message) => `- ${lineFromMessage(message)}`);
  const follow = options.context.followUp.needed
    ? `sim (${options.context.followUp.reason})`
    : 'não';
  const last4 = options.context.phoneKey ? options.context.phoneKey.slice(-4) : 's/n';
  const team = options.team;

  return [
    '---',
    `title: ${options.context.displayName}`,
    `tipo: contato-${team}`,
    `equipe: ${team}`,
    `id: ${options.context.noteId}`,
    `whatsapp: "${options.context.phoneKey ?? ''}"`,
    `session_id: ${options.context.sessionId}`,
    `follow_up: ${options.context.followUp.needed ? 'true' : 'false'}`,
    `gerado: ${options.now.toISOString()}`,
    'fonte: chatpro-playbook',
    'acesso: so-retorno-ou-follow-up',
    '---',
    '',
    `# ${options.context.displayName}`,
    '',
    `WhatsApp •••${last4}. Equipe **${team}**. O bot **só lê esta nota** se o contato voltar a escrever ou se estiver em [[Follow-up]].`,
    '',
    `Follow-up: ${follow}`,
    '',
    '## Resumo do atendimento',
    '',
    options.context.attendanceSummary
      ?? 'Ainda sem resumo. O worker grava aqui o problema, o que a equipe fez e o resultado.',
    '',
    '## Estado',
    '',
    options.context.lastCustomerLine
      ? `Última do cliente: ${options.context.lastCustomerLine}`
      : 'Última do cliente: —',
    options.context.lastTeamLine
      ? `Última da equipe: ${options.context.lastTeamLine}`
      : 'Última da equipe: —',
    '',
    '## Recorte recente',
    '',
    ...recent,
    '',
    '## Notas da equipe',
    '',
    HUMAN_START,
    options.humanNotes,
    HUMAN_END,
    '',
  ].join('\n');
}

function contactsDir(vaultPath: string, folder: string) {
  return join(vaultPath, ...folder.split(/[\\/]/u), 'Clientes');
}

function otherTeamFolders(folder: string) {
  const company = companyFolderFromPlaybookFolder(folder);
  return allTeamFolders(company).filter((candidate) => candidate !== folder);
}

/**
 * Writes one Obsidian note per contact. Human notes inside the markers are kept.
 */
export function writeContactNotes(options: {
  vaultPath: string;
  folder: string;
  threads: InboxThread[];
  team?: AttendanceTeam;
  now?: Date;
  summaries?: Record<string, string>;
}) {
  const now = options.now ?? new Date();
  const team = options.team ?? 'comercial';
  const dir = contactsDir(options.vaultPath, options.folder);
  mkdirSync(dir, { recursive: true });
  const written: string[] = [];
  const followUps: ContactContext[] = [];
  const siblingFolders = otherTeamFolders(options.folder);

  for (const thread of options.threads) {
    const context = buildContactContext(thread, options.summaries?.[thread.session.id]);
    if (!context) {
      continue;
    }
    const fileName = `c-${context.noteId}.md`;
    const path = join(dir, fileName);
    const siblingPaths = siblingFolders.map((folder) => join(contactsDir(options.vaultPath, folder), fileName));
    const humanNotes = existsSync(path)
      ? extractHumanNotes(readFileSync(path, 'utf8'))
      : siblingPaths.reduce<string | null>((found, siblingPath) => {
        if (found || !existsSync(siblingPath)) {
          return found;
        }
        return extractHumanNotes(readFileSync(siblingPath, 'utf8'));
      }, null) ?? HUMAN_STUB;
    writeFileSync(path, renderContactNote({ context, thread, humanNotes, now, team }), 'utf8');
    for (const siblingPath of siblingPaths) {
      if (existsSync(siblingPath) && siblingPath !== path) {
        unlinkSync(siblingPath);
      }
    }
    written.push(fileName);
    if (context.followUp.needed) {
      followUps.push(context);
    }
  }

  const followPath = join(options.vaultPath, ...options.folder.split(/[\\/]/u), 'Follow-up.md');
  writeFileSync(followPath, renderFollowUpIndex({ followUps, now, team }), 'utf8');

  return { contacts: written.length, followUps: followUps.length, followPath };
}

function renderFollowUpIndex(options: {
  followUps: ContactContext[];
  now: Date;
  team: AttendanceTeam;
}) {
  const lines = options.followUps.length === 0
    ? ['Nenhum contato aguardando resposta nas últimas conversas lidas.']
    : options.followUps.map((contact) => {
      const last4 = contact.phoneKey ? contact.phoneKey.slice(-4) : 's/n';
      return `- [[Clientes/c-${contact.noteId}|${contact.displayName} •••${last4}]] — ${contact.followUp.reason}`;
    });

  return [
    '---',
    'title: Follow-up',
    `tipo: playbook-${options.team}`,
    `equipe: ${options.team}`,
    `gerado: ${options.now.toISOString()}`,
    'fonte: chatpro-playbook',
    '---',
    '',
    options.team === 'logistica'
      ? '# Follow-up logística'
      : options.team === 'mecanica'
        ? '# Follow-up mecânica'
        : '# Follow-up',
    '',
    'O bot **só abre** a nota do contato da lista abaixo, ou se a mesma pessoa voltar a escrever. Não mistura o histórico de todo mundo no playbook.',
    '',
    ...lines,
    '',
  ].join('\n');
}

/**
 * Loads one contact note. Returns null when the file does not exist.
 */
export function readContactNote(options: {
  vaultPath: string;
  folder: string;
  noteId: string;
}) {
  const path = join(contactsDir(options.vaultPath, options.folder), `c-${options.noteId}.md`);
  if (!existsSync(path)) {
    return null;
  }
  return readFileSync(path, 'utf8');
}

/**
 * Finds a contact note by a typed phone (full, with 55, or last digits).
 */
export function findContactNoteByPhone(options: {
  vaultPath: string;
  folder?: string;
  folders?: string[];
  query: string;
}) {
  const digits = options.query.replace(/\D/gu, '');
  if (digits.length < 4) {
    return null;
  }
  const folders = options.folders ?? (options.folder ? [options.folder] : []);
  for (const folder of folders) {
    const dir = contactsDir(options.vaultPath, folder);
    if (!existsSync(dir)) {
      continue;
    }
    const files = readdirSync(dir).filter((name) => name.startsWith('c-') && name.endsWith('.md'));
    const match = files.find((name) => {
      const id = name.slice(2, -3);
      return id === digits || id.endsWith(digits) || digits.endsWith(id);
    });
    if (!match) {
      continue;
    }
    const noteId = match.slice(2, -3);
    return {
      noteId,
      body: readFileSync(join(dir, match), 'utf8'),
    };
  }
  return null;
}
