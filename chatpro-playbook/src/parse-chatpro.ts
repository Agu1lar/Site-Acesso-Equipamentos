function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Digits-only WhatsApp id. Drops groups.
 */
export function phoneKeyFromWhatsAppAddress(value: string | null) {
  if (!value) {
    return null;
  }
  if (/@g\.us\b/iu.test(value) || /@lid\b/iu.test(value)) {
    return null;
  }
  const digits = value.replace(/\D/gu, '');
  return digits.length >= 10 ? digits : null;
}

/**
 * Recovers the WhatsApp digits embedded in a Cloud API / ChatPro wamid.
 */
export function phoneKeyFromChatProMessageId(messageId: string | null) {
  if (!messageId) {
    return null;
  }
  // Individual chats encode the phone after the HBgM marker.
  const encoded = messageId.match(/HBgM([A-Za-z0-9+/]+?)(?:FQ|ER|Eh|AA)/u)?.[1]
    ?? messageId.match(/HBgM([A-Za-z0-9+/]{10,24})/u)?.[1];
  if (!encoded) {
    return null;
  }
  const padded = encoded + '='.repeat((4 - (encoded.length % 4)) % 4);
  try {
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    return phoneKeyFromWhatsAppAddress(decoded);
  } catch {
    return null;
  }
}

const PHONE_RECORD_KEYS = [
  'number',
  'phone',
  'phoneNumber',
  'phone_number',
  'wa_id',
  'waId',
  'wid',
  'chatId',
  'chat_id',
] as const;

/**
 * Reads a WhatsApp number from a ChatPro session or message payload.
 */
export function phoneKeyFromChatProRecord(record: Record<string, unknown> | null) {
  if (!record) {
    return null;
  }
  for (const key of PHONE_RECORD_KEYS) {
    const value = record[key];
    const parsed = phoneKeyFromWhatsAppAddress(typeof value === 'string' ? value : null);
    if (parsed) {
      return parsed;
    }
  }
  const id = readString(record.id) ?? readString(record.message_id) ?? readString(record.messageId);
  return phoneKeyFromChatProMessageId(id);
}

function readBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }
  return null;
}

function readDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  const raw = readString(value) ?? (typeof value === 'number' ? String(value) : null);
  if (!raw) {
    return null;
  }
  if (/^\d{10}$/u.test(raw)) {
    return new Date(Number(raw) * 1000);
  }
  if (/^\d{13}$/u.test(raw)) {
    return new Date(Number(raw));
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function unwrapCollection(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  const record = asRecord(payload);
  if (!record) {
    return [];
  }
  for (const key of ['data', 'sessions', 'rows', 'items', 'result', 'messages']) {
    const nested = record[key];
    if (Array.isArray(nested)) {
      return nested;
    }
  }
  return [];
}

export type ParsedChatProSession = {
  id: string;
  phoneKey: string | null;
  contactName: string | null;
  isOpen: boolean | null;
  openedAt: Date | null;
  closedAt: Date | null;
  raw: Record<string, unknown>;
};

export type ParsedChatProMessage = {
  id: string;
  fromMe: boolean;
  body: string | null;
  mediaType: string | null;
  sentAt: Date | null;
  raw: Record<string, unknown>;
};

/**
 * Normalizes a ChatPro Chat session payload.
 */
export function parseChatProSession(value: unknown): ParsedChatProSession | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const lead = asRecord(record.lead);
  const id =
    readString(record.id)
    ?? readString(record.sessionId)
    ?? readString(record.session_id)
    ?? readString(record._id);
  if (!id) {
    return null;
  }

  const phone =
    phoneKeyFromChatProRecord(record)
    ?? phoneKeyFromChatProRecord(lead);

  const openFlag = readBoolean(record.open) ?? readBoolean(record.is_open) ?? readBoolean(record.isOpen);

  return {
    id,
    phoneKey: phone,
    contactName:
      readString(record.name)
      ?? readString(record.pushname)
      ?? readString(lead?.name)
      ?? null,
    isOpen: openFlag,
    openedAt:
      readDate(record.start)
      ?? readDate(record.open_ts)
      ?? readDate(record.createdAt)
      ?? readDate(record.created_at),
    closedAt:
      readDate(record.end)
      ?? readDate(record.close_ts)
      ?? readDate(record.closedAt)
      ?? readDate(record.finished_at),
    raw: record,
  };
}

/**
 * Normalizes a ChatPro Chat message payload.
 */
export function parseChatProMessage(value: unknown, sessionId: string): ParsedChatProMessage | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  const id =
    readString(record.id)
    ?? readString(record.messageId)
    ?? readString(record.message_id)
    ?? readString(record._id);
  if (!id) {
    return null;
  }

  const fromMe = readBoolean(record.fromMe) ?? readBoolean(record.from_me) ?? false;
  const body =
    readString(record.message)
    ?? readString(record.text)
    ?? readString(record.body)
    ?? readString(record.alt_message)
    ?? readString(record.altMessage);

  return {
    id: `${sessionId}:${id}`,
    fromMe,
    body,
    mediaType: readString(record.type) ?? readString(record.message_type) ?? readString(record.mediaType),
    sentAt:
      readDate(record.timestamp)
      ?? readDate(record.ts_receive)
      ?? readDate(record.send_ts)
      ?? readDate(record.createdAt)
      ?? readDate(record.created_at)
      ?? readDate(record.sentAt),
    raw: record,
  };
}

/**
 * Reads a ChatPro list payload into session records.
 */
export function parseChatProSessionList(payload: unknown) {
  return unwrapCollection(payload)
    .map(parseChatProSession)
    .filter((session): session is ParsedChatProSession => session !== null);
}

/** Reads the direct or wrapped payload returned by getSessionById. */
export function parseChatProSessionResult(payload: unknown) {
  const direct = parseChatProSession(payload);
  if (direct) {
    return direct;
  }
  const record = asRecord(payload);
  if (!record) {
    return null;
  }
  for (const key of ['data', 'session', 'result']) {
    const parsed = parseChatProSession(record[key]);
    if (parsed) {
      return parsed;
    }
  }
  return null;
}

/**
 * Reads a ChatPro list payload into message records.
 */
export function parseChatProMessageList(payload: unknown, sessionId: string) {
  return unwrapCollection(payload)
    .map((item) => parseChatProMessage(item, sessionId))
    .filter((message): message is ParsedChatProMessage => message !== null);
}

/**
 * ChatPro id returned by sendMessage, if the payload includes one.
 */
export function parseChatProSentMessageId(payload: unknown, sessionId: string) {
  const record = asRecord(payload);
  if (!record) {
    return null;
  }
  const nested = asRecord(record.data) ?? asRecord(record.message) ?? record;
  const id =
    readString(nested.id)
    ?? readString(nested.messageId)
    ?? readString(nested.message_id)
    ?? readString(record.id);
  if (!id) {
    return null;
  }
  return id.includes(':') ? id : `${sessionId}:${id}`;
}
