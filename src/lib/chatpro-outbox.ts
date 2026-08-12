import 'server-only';

import { and, asc, eq, gt, inArray, isNull } from 'drizzle-orm';
import type { ChatProInboundEvent } from '@/lib/chatpro-webhook';
import { db } from '@/libs/DB';
import { chatproMessagesSchema, chatproOutboxSchema } from '@/models/Schema';

export type ChatProOutboxPayload = {
  messageId: number;
  externalId: string;
  leadId: number | null;
  phoneKey: string;
  event: string;
  fromMe: boolean;
  messageText: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  mediaFilename: string | null;
  mediaMimetype: string | null;
  eventAt: string | null;
};

export type ChatProOutboxEvent = {
  outboxId: number;
  messageId: number;
  externalId: string;
  leadId: number | null;
  phoneKey: string;
  payload: ChatProOutboxPayload;
  createdAt: Date;
};

/** Builds the normalized payload stored in the outbox for the local consumer. */
export function buildChatProOutboxPayload(
  messageId: number,
  externalId: string,
  leadId: number | null,
  event: ChatProInboundEvent,
): ChatProOutboxPayload {
  return {
    messageId,
    externalId,
    leadId,
    phoneKey: event.phoneKey ?? '',
    event: event.event,
    fromMe: event.fromMe,
    messageText: event.messagePreview,
    mediaType: event.media.mediaType,
    mediaUrl: event.media.mediaUrl,
    mediaFilename: event.media.mediaFilename,
    mediaMimetype: event.media.mediaMimetype,
    eventAt: event.eventAt?.toISOString() ?? null,
  };
}

/**
 * Enqueues a persisted ChatPro message for the local ROI consumer.
 * @param messageId Inserted message row id.
 * @param externalId Idempotency key shared with chatpro_messages.
 * @param leadId Matched site lead, if any.
 * @param event Parsed webhook event.
 */
export async function enqueueChatProOutboxEvent(
  messageId: number,
  externalId: string,
  leadId: number | null,
  event: ChatProInboundEvent,
) {
  const payload = buildChatProOutboxPayload(messageId, externalId, leadId, event);

  await db
    .insert(chatproOutboxSchema)
    .values({
      messageId,
      externalId,
      leadId,
      phoneKey: event.phoneKey ?? '',
      payload,
    })
    .onConflictDoNothing({ target: chatproOutboxSchema.externalId });
}

/**
 * Lists undelivered outbox events for the local consumer (pull model).
 * @param since Return rows with id greater than this cursor (exclusive).
 * @param limit Max rows (1–100).
 */
export async function listPendingChatProOutboxEvents(since = 0, limit = 50) {
  const cappedLimit = Math.min(Math.max(limit, 1), 100);

  const rows = await db
    .select({
      outboxId: chatproOutboxSchema.id,
      messageId: chatproOutboxSchema.messageId,
      externalId: chatproOutboxSchema.externalId,
      leadId: chatproOutboxSchema.leadId,
      phoneKey: chatproOutboxSchema.phoneKey,
      payload: chatproOutboxSchema.payload,
      createdAt: chatproOutboxSchema.createdAt,
    })
    .from(chatproOutboxSchema)
    .where(
      and(
        isNull(chatproOutboxSchema.deliveredAt),
        gt(chatproOutboxSchema.id, since),
      ),
    )
    .orderBy(asc(chatproOutboxSchema.id))
    .limit(cappedLimit);

  return rows.map((row) => ({
    outboxId: row.outboxId,
    messageId: row.messageId,
    externalId: row.externalId,
    leadId: row.leadId,
    phoneKey: row.phoneKey,
    payload: row.payload,
    createdAt: row.createdAt,
  })) satisfies ChatProOutboxEvent[];
}

/**
 * Marks outbox rows as delivered after the local consumer analyzed them (or skipped safely).
 * @param outboxIds Outbox primary keys to acknowledge.
 */
export async function ackChatProOutboxEvents(outboxIds: number[]) {
  if (outboxIds.length === 0) {
    return { acked: 0 };
  }

  const uniqueIds = [...new Set(outboxIds)];
  const updated = await db
    .update(chatproOutboxSchema)
    .set({ deliveredAt: new Date() })
    .where(
      and(
        inArray(chatproOutboxSchema.id, uniqueIds),
        isNull(chatproOutboxSchema.deliveredAt),
      ),
    )
    .returning({ id: chatproOutboxSchema.id });

  return { acked: updated.length };
}

/** Counts rows still waiting for the local consumer. */
export async function countPendingChatProOutboxEvents() {
  const rows = await db
    .select({ id: chatproOutboxSchema.id })
    .from(chatproOutboxSchema)
    .where(isNull(chatproOutboxSchema.deliveredAt))
    .limit(1000);

  return rows.length;
}
