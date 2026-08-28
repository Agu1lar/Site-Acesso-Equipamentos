import { phoneMatchKey } from '@/lib/lead-contact';

export type ChatProMediaInfo = {
  mediaType: string | null;
  mediaUrl: string | null;
  mediaFilename: string | null;
  mediaMimetype: string | null;
};

export type ChatProInboundEvent = {
  event: string;
  phoneKey: string | null;
  fromMe: boolean;
  messagePreview: string | null;
  eventAt: Date | null;
  externalId: string | null;
  media: ChatProMediaInfo;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseEventDate(value: unknown) {
  const raw = readString(value);
  if (!raw) {
    return null;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readMediaFromRecord(record: Record<string, unknown> | null): ChatProMediaInfo {
  if (!record) {
    return {
      mediaType: null,
      mediaUrl: null,
      mediaFilename: null,
      mediaMimetype: null,
    };
  }

  const nestedMedia = asRecord(record.media) ?? asRecord(record.attachment) ?? asRecord(record.document);
  const payload = asRecord(record.payload);

  return {
    mediaType:
      readString(record.type)
      ?? readString(record.message_type)
      ?? readString(record.messageType)
      ?? readString(record.file_type)
      ?? readString(record.fileType)
      ?? readString(nestedMedia?.type)
      ?? readString(payload?.type),
    mediaUrl:
      readString(record.media_url)
      ?? readString(record.mediaUrl)
      ?? readString(record.file_url)
      ?? readString(record.fileUrl)
      ?? readString(record.url)
      ?? readString(nestedMedia?.url)
      ?? readString(nestedMedia?.media_url)
      ?? readString(payload?.url),
    mediaFilename:
      readString(record.filename)
      ?? readString(record.file_name)
      ?? readString(record.fileName)
      ?? readString(record.title)
      ?? readString(nestedMedia?.filename)
      ?? readString(nestedMedia?.file_name)
      ?? readString(payload?.filename),
    mediaMimetype:
      readString(record.mimetype)
      ?? readString(record.mime_type)
      ?? readString(record.mimeType)
      ?? readString(nestedMedia?.mimetype)
      ?? readString(nestedMedia?.mime_type)
      ?? readString(payload?.mimetype),
  };
}

function readMessagePreview(record: Record<string, unknown> | null) {
  if (!record) {
    return null;
  }

  const message = readString(record.message);
  if (message) {
    return message.slice(0, 2000);
  }

  const altMessage = readString(record.alt_message) ?? readString(record.altMessage);
  if (altMessage) {
    return altMessage.slice(0, 2000);
  }

  const payload = asRecord(record.payload);
  const payloadText =
    readString(payload?.transcription)
    ?? readString(payload?.transcript)
    ?? readString(payload?.text)
    ?? readString(payload?.caption);

  return payloadText?.slice(0, 2000) ?? null;
}

function readExternalId(record: Record<string, unknown> | null, root: Record<string, unknown>) {
  return (
    readString(record?.id)
    ?? readString(record?.message_id)
    ?? readString(record?.messageId)
    ?? readString(root.id)
    ?? readString(root.message_id)
    ?? readString(root.messageId)
  );
}

/** Extracts digits from ChatPro JID (`5511999...@s.whatsapp.net`) or raw phone. */
export function extractChatProPhone(raw: string | null | undefined) {
  if (!raw?.trim()) {
    return null;
  }
  const beforeAt = raw.trim().split('@')[0] ?? raw;
  return phoneMatchKey(beforeAt);
}

/**
 * Parses ChatPro webhook JSON. Only inbound client messages mark a lead as replied.
 * Unknown shapes return null (endpoint responds 200 ignore).
 */
export function parseChatProWebhookPayload(payload: unknown): ChatProInboundEvent | null {
  const root = asRecord(payload);
  if (!root) {
    return null;
  }

  const event = readString(root.event) ?? readString(root.type) ?? 'unknown';
  const messageData = asRecord(root.message_data) ?? asRecord(root.messageData);
  const sessionData = asRecord(root.session_data) ?? asRecord(root.sessionData);

  if (event === 'received_message' || messageData) {
    const fromMe = messageData?.from_me === true || messageData?.fromMe === true;
    const number =
      readString(messageData?.number)
      ?? readString(messageData?.participant)
      ?? readString(root.number);

    return {
      event: event === 'unknown' ? 'received_message' : event,
      phoneKey: extractChatProPhone(number),
      fromMe,
      messagePreview: readMessagePreview(messageData),
      eventAt:
        parseEventDate(messageData?.ts_receive)
        ?? parseEventDate(root.event_ts)
        ?? parseEventDate(root.eventTs),
      externalId: readExternalId(messageData, root),
      media: readMediaFromRecord(messageData),
    };
  }

  if (event === 'opened_session' || sessionData) {
    return {
      event: event === 'unknown' ? 'opened_session' : event,
      phoneKey: extractChatProPhone(
        readString(sessionData?.number)
          ?? readString(root.number)
          ?? readString(sessionData?.lead_id),
      ),
      fromMe: true,
      messagePreview: readString(sessionData?.last_message),
      eventAt: parseEventDate(root.event_ts) ?? parseEventDate(sessionData?.open_ts),
      externalId: readExternalId(sessionData, root),
      media: readMediaFromRecord(sessionData),
    };
  }

  return {
    event,
    phoneKey: extractChatProPhone(readString(root.number)),
    fromMe: true,
    messagePreview: null,
    eventAt: parseEventDate(root.event_ts),
    externalId: readExternalId(null, root),
    media: readMediaFromRecord(root),
  };
}

/** True when this event should mark a site lead as “WhatsApp replied”. */
export function isChatProClientReply(event: ChatProInboundEvent) {
  if (event.fromMe || !event.phoneKey) {
    return false;
  }
  return event.event === 'received_message' || event.event.toLowerCase().includes('received');
}

/** Builds a stable dedup key when ChatPro does not send an external id. */
export function buildChatProMessageDedupKey(event: ChatProInboundEvent) {
  const stamp = event.eventAt?.toISOString() ?? 'unknown';
  const text = event.messagePreview?.slice(0, 80) ?? '';
  const media = event.media.mediaUrl ?? '';
  return `${event.phoneKey}:${stamp}:${event.fromMe}:${text}:${media}`;
}
