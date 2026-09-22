import { isBusinessOpen, offHoursWindow } from './duty-hours.js';

export const DEFAULT_AFTER_HOURS_MESSAGE = [
  'Olá! Recebemos sua mensagem.',
  '',
  'O comercial da Acesso Equipamentos atende de segunda a sexta, das 7h30 às 17h15.',
  '',
  'Retornamos no próximo dia útil. Fora desse horário não passamos valor nem frete.',
].join('\n');

export const AFTER_HOURS_NOTICE_MARKER = 'não passamos valor nem frete';

const SYSTEM_FROM_ME_TYPES = new Set([
  'transfer_session',
  'cloud_event',
]);

export type AfterHoursMessage = {
  id: string;
  fromMe: boolean;
  body: string | null;
  mediaType: string | null;
  sentAt: Date | null;
  botOrigin?: boolean;
};

export type AfterHoursSession = {
  id: string;
  isGroup: boolean;
  botActive: boolean;
  provider: string;
};

export type AfterHoursDecision =
  | { action: 'skip'; reason: string }
  | {
      action: 'send';
      windowId: string;
      inboundMessageId: string;
      provider: string;
    };

function isSystemFromMe(message: AfterHoursMessage) {
  const type = message.mediaType?.trim() || '';
  if (SYSTEM_FROM_ME_TYPES.has(type)) {
    return true;
  }
  return Boolean(message.body?.startsWith('Sessão transferida'));
}

const URA_MENU_BODY =
  /^\s*(?:\*+\d+\*+\.?|\d+\s*[-.)])|escolha uma op[cç][aã]o/iu;
const AGENT_SIGNATURE = /^\*[A-Za-zÀ-ÿ][^\n*]{0,40}\*\s*$/mu;

/**
 * True when the ChatPro URA or template bot spoke, not a consultant.
 */
export function isChatProTriageBotReply(message: AfterHoursMessage) {
  if (!message.fromMe || message.botOrigin) {
    return false;
  }
  const type = message.mediaType?.trim() || '';
  if (type === 'send_template') {
    return true;
  }
  const body = message.body?.trim() ?? '';
  if (!body || AGENT_SIGNATURE.test(body)) {
    return false;
  }
  return URA_MENU_BODY.test(body);
}

/**
 * True when the company actually spoke, not a transfer, Cloud event, URA or bot send.
 */
export function isAttendanceTeamReply(message: AfterHoursMessage) {
  if (message.botOrigin || isChatProTriageBotReply(message)) {
    return false;
  }
  return message.fromMe && !isSystemFromMe(message);
}

function alreadySentOurNotice(message: AfterHoursMessage) {
  if (!message.fromMe) {
    return false;
  }
  return (message.body ?? '').toLowerCase().includes(AFTER_HOURS_NOTICE_MARKER);
}

/**
 * Decides whether this thread gets the fixed after-hours notice. Never quotes price.
 */
export function decideAfterHoursNotice(options: {
  now: Date;
  session: AfterHoursSession;
  messages: AfterHoursMessage[];
  alreadySent: boolean;
  forceOffHours?: boolean;
  ignoreHumanReplies?: boolean;
}): AfterHoursDecision {
  if (options.session.isGroup) {
    return { action: 'skip', reason: 'group' };
  }
  if (!options.forceOffHours && isBusinessOpen(options.now)) {
    return { action: 'skip', reason: 'expediente-aberto' };
  }

  const window = offHoursWindow(options.now, { ignoreOpenFloor: options.forceOffHours });
  if (!window) {
    return { action: 'skip', reason: 'expediente-aberto' };
  }
  if (options.alreadySent && !options.ignoreHumanReplies) {
    return { action: 'skip', reason: 'ja-avisado-nesta-janela' };
  }

  const dated = options.messages.filter((message) => message.sentAt);
  const lastInbound = dated.toReversed().find((message) => !message.fromMe);
  const inboundAt = lastInbound?.sentAt;
  if (!lastInbound || !inboundAt) {
    return { action: 'skip', reason: 'sem-mensagem-do-cliente' };
  }
  if (!options.forceOffHours && isBusinessOpen(inboundAt)) {
    return { action: 'skip', reason: 'cliente-escreveu-no-expediente' };
  }
  if (inboundAt < window.startedAt) {
    return { action: 'skip', reason: 'mensagem-antes-desta-janela' };
  }

  const afterInbound = dated.filter((message) =>
    message.sentAt && message.sentAt > inboundAt,
  );
  if (afterInbound.some(alreadySentOurNotice)) {
    return { action: 'skip', reason: 'aviso-ja-esta-no-chat' };
  }
  if (afterInbound.some((message) => message.fromMe && message.botOrigin)) {
    return { action: 'skip', reason: 'bot-ja-respondeu' };
  }
  if (!options.ignoreHumanReplies && afterInbound.some(isAttendanceTeamReply)) {
    return { action: 'skip', reason: 'humano-ja-respondeu' };
  }

  return {
    action: 'send',
    windowId: window.id,
    inboundMessageId: lastInbound.id,
    provider: options.session.provider || 'cloud',
  };
}

/**
 * Reads ChatPro session flags used by the after-hours gate.
 */
export function sessionFlagsFromRaw(raw: Record<string, unknown>): Omit<AfterHoursSession, 'id'> {
  return {
    isGroup: raw.group === true || raw.group === 'true',
    botActive: raw.bot_active === true || raw.bot_active === 'true',
    provider: typeof raw.provider === 'string' && raw.provider.trim()
      ? raw.provider.trim()
      : 'cloud',
  };
}
