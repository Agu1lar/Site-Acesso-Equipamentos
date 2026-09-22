import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { classifyAttendanceDesk } from './attendance-team.js';
import type { AttendanceTeam } from './attendance-team.js';
import type { MessageRow, SessionRow } from './db.js';
import { formatPlaybookMessageBody } from './media.js';
import { redactCustomerPii } from './redact.js';

export type InboxThread = {
  session: SessionRow;
  messages: MessageRow[];
};

/**
 * Renders the last ChatPro threads for Obsidian, with phones masked.
 */
export function renderInboxSnapshot(options: {
  threads: InboxThread[];
  now: Date;
  messageCount: number;
  team?: AttendanceTeam;
  summaries?: Record<string, string>;
}) {
  const team = options.team ?? 'comercial';
  const summaries = options.summaries ?? {};
  const blocks = options.threads.map((thread) => {
    const desk = classifyAttendanceDesk(thread);
    const name = thread.session.contact_name
      ? redactCustomerPii(thread.session.contact_name)
      : `sessão ${thread.session.id.slice(0, 8)}`;
    const title = desk === team ? name : `[${desk}] ${name}`;
    const summary = summaries[thread.session.id]?.trim();
    const safeSummary = summary ? redactCustomerPii(summary) : '';
    const lines = thread.messages.slice(-4).map((message) => {
      const who = message.bot_origin ? 'Bot' : message.from_me ? 'Equipe' : 'Cliente';
      const body = redactCustomerPii(formatPlaybookMessageBody({
        body: message.body,
        mediaText: message.media_text ?? null,
        mediaType: message.media_type,
      })).slice(0, 220);
      return `- ${who}: ${body}`;
    });
    return [
      `## ${title}`,
      '',
      summary ? ['**Resumo do atendimento**', '', safeSummary, '', 'Últimas falas:', '', ...lines, ''] : [...lines, ''],
    ].flat().join('\n');
  });

  return [
    '---',
    'title: Inbox recente',
    `tipo: playbook-${team}`,
    `equipe: ${team}`,
    `gerado: ${options.now.toISOString()}`,
    'fonte: chatpro-playbook',
    'regra: nunca-confirmar-preco-nem-frete',
    '---',
    '',
    team === 'logistica'
      ? '# Inbox logística'
      : team === 'mecanica'
        ? '# Inbox mecânica'
        : '# Inbox recente',
    '',
    options.threads.length === 0
      ? 'Nenhuma conversa desta equipe nas últimas sessões lidas da ChatPro.'
      : `Últimas ${options.threads.length} conversas desta equipe. Cada bloco tem o **resumo do atendimento** (problema, o que fizeram, resultado) e só um recorte das últimas falas. [[Notas humanas]] não é mexido.`,
    '',
    ...blocks,
  ].join('\n');
}

/**
 * Writes Inbox recente.md into one team vault folder.
 */
export function writeInboxSnapshot(options: {
  vaultPath: string;
  folder: string;
  threads: InboxThread[];
  now?: Date;
  messageCount: number;
  team?: AttendanceTeam;
  summaries?: Record<string, string>;
}) {
  const folder = join(options.vaultPath, ...options.folder.split(/[\\/]/u));
  mkdirSync(folder, { recursive: true });
  const body = renderInboxSnapshot({
    threads: options.threads,
    now: options.now ?? new Date(),
    messageCount: options.messageCount,
    team: options.team,
    summaries: options.summaries,
  });
  const path = join(folder, 'Inbox recente.md');
  writeFileSync(path, body, 'utf8');
  return path;
}
