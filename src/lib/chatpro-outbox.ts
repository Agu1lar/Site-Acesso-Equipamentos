import 'server-only';

import { and, asc, count, gt, inArray, isNull, sql } from 'drizzle-orm';
import type { ChatProInboundEvent } from '@/lib/chatpro-webhook';
import { db } from '@/libs/DB';
import { chatproOutboxSchema } from '@/models/Schema';

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

type ClaimedOutboxRow = {
  outboxId: number;
  messageId: number;
  externalId: string;
  leadId: number | null;
  phoneKey: string;
  payload: unknown;
  createdAt: Date | string;
};

const DEFAULT_OUTBOX_LEASE_MS = 15 * 60 * 1000;
let outboxSchemaReady: Promise<void> | null = null;

async function repairChatProOutboxSchema() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "chatpro_outbox" (
      "id" serial PRIMARY KEY NOT NULL,
      "message_id" integer NOT NULL,
      "external_id" varchar(120) NOT NULL,
      "lead_id" integer,
      "phone_key" varchar(20) NOT NULL,
      "payload" jsonb NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "delivered_at" timestamp,
      "locked_at" timestamp,
      "locked_by" varchar(120)
    );
    ALTER TABLE "chatpro_outbox" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp;
    ALTER TABLE "chatpro_outbox" ADD COLUMN IF NOT EXISTS "locked_at" timestamp;
    ALTER TABLE "chatpro_outbox" ADD COLUMN IF NOT EXISTS "locked_by" varchar(120);
    CREATE UNIQUE INDEX IF NOT EXISTS "chatpro_outbox_external_id_uidx"
      ON "chatpro_outbox" ("external_id");
    CREATE INDEX IF NOT EXISTS "chatpro_outbox_pending_idx"
      ON "chatpro_outbox" ("delivered_at", "id");
    CREATE INDEX IF NOT EXISTS "chatpro_outbox_pending_lock_idx"
      ON "chatpro_outbox" ("delivered_at", "locked_at", "id");
  `);
}

function ensureChatProOutboxSchema() {
  outboxSchemaReady ??= repairChatProOutboxSchema();

  return outboxSchemaReady;
}

/** Extracts rows from the node-postgres result shape returned by Drizzle execute. */
export function extractClaimedOutboxRows(result: { rows: unknown }): ClaimedOutboxRow[] {
  if (!Array.isArray(result.rows)) {
    throw new TypeError('invalid_claim_result_rows');
  }
  return result.rows as ClaimedOutboxRow[];
}

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
  await ensureChatProOutboxSchema();
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

function mapOutboxRow(row: {
  outboxId: number;
  messageId: number;
  externalId: string;
  leadId: number | null;
  phoneKey: string;
  payload: unknown;
  createdAt: Date;
}): ChatProOutboxEvent {
  return {
    outboxId: row.outboxId,
    messageId: row.messageId,
    externalId: row.externalId,
    leadId: row.leadId,
    phoneKey: row.phoneKey,
    payload: row.payload as ChatProOutboxPayload,
    createdAt: row.createdAt,
  };
}

/**
 * Lists undelivered outbox events (read-only — prefer claim for consumers).
 * @param since Return rows with id greater than this cursor (exclusive).
 * @param limit Max rows (1–100).
 */
export async function listPendingChatProOutboxEvents(since = 0, limit = 50) {
  await ensureChatProOutboxSchema();
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

  return rows.map(mapOutboxRow);
}

/**
 * Atomically claims undelivered outbox rows for one consumer (lease + SKIP LOCKED).
 * @param options Consumer id, cursor, limit and lease duration.
 */
export async function claimChatProOutboxEvents(options: {
  consumerId: string;
  since?: number;
  limit?: number;
  leaseMs?: number;
}) {
  await ensureChatProOutboxSchema();
  const since = options.since ?? 0;
  const cappedLimit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const leaseMs = options.leaseMs ?? DEFAULT_OUTBOX_LEASE_MS;
  const consumerId = options.consumerId.trim().slice(0, 120);
  if (!consumerId) {
    throw new Error('consumer_id_required');
  }

  const leaseCutoff = new Date(Date.now() - leaseMs);

  return db.transaction(async (tx) => {
    const result = await tx.execute(sql`
      WITH candidates AS (
        SELECT id
        FROM chatpro_outbox
        WHERE delivered_at IS NULL
          AND id > ${since}
          AND (
            locked_at IS NULL
            OR locked_at < ${leaseCutoff}
          )
        ORDER BY id
        LIMIT ${cappedLimit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE chatpro_outbox AS o
      SET
        locked_at = NOW(),
        locked_by = ${consumerId}
      FROM candidates
      WHERE o.id = candidates.id
      RETURNING
        o.id AS "outboxId",
        o.message_id AS "messageId",
        o.external_id AS "externalId",
        o.lead_id AS "leadId",
        o.phone_key AS "phoneKey",
        o.payload,
        o.created_at AS "createdAt"
    `);

    const rows = extractClaimedOutboxRows(result);

    return rows.map((row) =>
      mapOutboxRow({
        ...row,
        createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
      }),
    );
  });
}

/**
 * Marks outbox rows as delivered after the local consumer analyzed them (or skipped safely).
 * @param outboxIds Outbox primary keys to acknowledge.
 */
export async function ackChatProOutboxEvents(outboxIds: number[]) {
  await ensureChatProOutboxSchema();
  if (outboxIds.length === 0) {
    return { acked: 0 };
  }

  const uniqueIds = [...new Set(outboxIds)];
  const updated = await db
    .update(chatproOutboxSchema)
    .set({
      deliveredAt: new Date(),
      lockedAt: null,
      lockedBy: null,
    })
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
  await ensureChatProOutboxSchema();
  const rows = await db
    .select({ value: count() })
    .from(chatproOutboxSchema)
    .where(isNull(chatproOutboxSchema.deliveredAt));

  return Number(rows[0]?.value ?? 0);
}
