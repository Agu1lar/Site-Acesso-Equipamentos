export type BotOutboundKind = 'after-hours-notice' | 'attendance-bot';

function foldBotBody(text: string) {
  return text.replace(/\s+/gu, ' ').trim().toLowerCase();
}

/**
 * True when a synced ChatPro line is the outbound we just posted.
 */
export function bodiesMatchBotOutbound(sent: string, synced: string) {
  const left = foldBotBody(sent);
  const right = foldBotBody(synced);
  if (!left || !right) {
    return false;
  }
  return left === right || right.includes(left) || left.includes(right);
}

export type BotOutboundMatch = {
  id: string;
  body: string;
  chatpro_message_id: string | null;
};

/**
 * Picks the outbound row that matches a synced from-me message.
 */
export function matchBotOutbound(options: {
  messageId: string;
  body: string | null;
  rows: BotOutboundMatch[];
}) {
  const body = options.body ?? '';
  return options.rows.find((row) => {
    if (row.chatpro_message_id && row.chatpro_message_id === options.messageId) {
      return true;
    }
    return bodiesMatchBotOutbound(row.body, body);
  }) ?? null;
}

/**
 * Stable id for one bot send in a session window.
 */
export function botOutboundId(options: {
  sessionId: string;
  kind: BotOutboundKind;
  windowId: string;
}) {
  return `${options.sessionId}:${options.kind}:${options.windowId}`;
}
