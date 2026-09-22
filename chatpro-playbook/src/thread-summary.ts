export const PLAYBOOK_SUMMARY_HEAD = 3;
export const PLAYBOOK_SUMMARY_TAIL = 5;
export const PLAYBOOK_SUMMARY_LINE_CHARS = 180;
export const PLAYBOOK_SUMMARY_VERSION = 'v4';
export const PLAYBOOK_SUMMARY_PRICE_HINTS = 4;

const COMMERCIAL_HINT_RE = /r\$|diária|diaria|\bfrete\b|\breais\b|por dia|mensal|quinzena|\b\d+\s*dias?\b/iu;

function hasCommercialHint(message: { body?: string | null; media_text?: string | null }) {
  return COMMERCIAL_HINT_RE.test(`${message.body ?? ''} ${message.media_text ?? ''}`);
}

/**
 * Opening plus outcome so the summary is not only the greeting.
 * Also keeps mid-thread quotes of price, days or freight.
 */
export function pickArcMessages<T extends { id: string; body?: string | null; media_text?: string | null }>(
  messages: T[],
): T[] {
  const cap = PLAYBOOK_SUMMARY_HEAD + PLAYBOOK_SUMMARY_TAIL;
  if (messages.length <= cap) {
    return messages;
  }
  const head = messages.slice(0, PLAYBOOK_SUMMARY_HEAD);
  const seen = new Set(head.map((message) => message.id));
  const priced = messages
    .filter((message) => !seen.has(message.id) && hasCommercialHint(message))
    .slice(0, PLAYBOOK_SUMMARY_PRICE_HINTS);
  for (const message of priced) {
    seen.add(message.id);
  }
  const tail = messages.slice(-PLAYBOOK_SUMMARY_TAIL).filter((message) => !seen.has(message.id));
  return [...head, ...priced, ...tail];
}

export type PlaybookSummaryMessage = {
  id: string;
  from_me: boolean;
  body: string | null;
  media_type: string | null;
  media_text?: string | null;
};

export type PlaybookSummarySelection = {
  mode: 'unchanged' | 'full' | 'incremental';
  messages: PlaybookSummaryMessage[];
  sourceKey: string;
};

/**
 * Fingerprint of a thread used to skip a Haiku rewrite when nothing changed.
 */
export function threadSummarySourceKey(messages: PlaybookSummaryMessage[]) {
  const last = messages.at(-1);
  const media = messages.reduce((count, message) => (
    message.media_text?.trim() ? count + 1 : count
  ), 0);
  return `${PLAYBOOK_SUMMARY_VERSION}:${messages.length}:${last?.id ?? 'none'}:${media}`;
}

/**
 * Like ROI: first run reads abertura + desfecho; later runs send only new messages.
 */
export function selectPlaybookSummaryMessages(options: {
  messages: PlaybookSummaryMessage[];
  lastMessageId: string | null;
  sourceKey: string | null;
}): PlaybookSummarySelection {
  const sourceKey = threadSummarySourceKey(options.messages);
  if (options.sourceKey === sourceKey && options.lastMessageId) {
    return { mode: 'unchanged', messages: [], sourceKey };
  }
  const versionPrefix = `${PLAYBOOK_SUMMARY_VERSION}:`;
  if (!options.lastMessageId || !options.sourceKey?.startsWith(versionPrefix)) {
    return {
      mode: 'full',
      messages: pickArcMessages(options.messages),
      sourceKey,
    };
  }
  const index = options.messages.findIndex((message) => message.id === options.lastMessageId);
  if (index < 0) {
    return {
      mode: 'full',
      messages: pickArcMessages(options.messages),
      sourceKey,
    };
  }
  const incremental = options.messages.slice(index + 1);
  if (incremental.length === 0) {
    return {
      mode: 'full',
      messages: pickArcMessages(options.messages),
      sourceKey,
    };
  }
  return {
    mode: 'incremental',
    messages: incremental.slice(-(PLAYBOOK_SUMMARY_HEAD + PLAYBOOK_SUMMARY_TAIL)),
    sourceKey,
  };
}

/**
 * Compact thread payload for a summary call. Not the full ChatPro transcript.
 */
export function formatPlaybookSummaryThread(options: {
  ref: string;
  priorSummary: string | null;
  selection: PlaybookSummarySelection;
  contactName: string | null;
}) {
  const header = [
    options.ref,
    options.contactName,
    options.selection.mode === 'incremental' ? 'delta' : 'abertura+desfecho',
  ].filter(Boolean).join(' | ');
  const prior = options.priorSummary
    ? `Resumo anterior: ${options.priorSummary}`
    : 'Sem resumo anterior.';
  const lines = options.selection.messages.map((message) => {
    const who = message.from_me ? 'Equipe' : 'Cliente';
    const body = (message.media_text?.trim() || message.body || message.media_type || '').slice(
      0,
      PLAYBOOK_SUMMARY_LINE_CHARS,
    );
    return `${who}: ${body}`;
  });
  return [header, prior, ...lines].join('\n');
}
