import 'server-only';

import { eq } from 'drizzle-orm';
import { enqueueChatProOutboxEvent } from '@/lib/chatpro-outbox';
import {
  buildChatProMessageDedupKey,
  type ChatProInboundEvent,
} from '@/lib/chatpro-webhook';
import { findLeadIdForChatProPhone, loadCampaignLeadSnapshot } from '@/lib/chatpro-lead-find';
import { isLeadEligibleForClaudeAnalysis } from '@/lib/chatpro-roi-context';
import { leadHasCampaignAttribution } from '@/lib/chatpro-roi-eligibility';
import { loadLastRoiEvaluationStage } from '@/lib/chatpro-roi-last-evaluation';
import { db } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { chatproMessagesSchema } from '@/models/Schema';

export type PersistChatProMessageResult =
  | { ok: true; inserted: true; messageId: number; leadId: number }
  | {
    ok: true;
    inserted: false;
    reason: 'duplicate' | 'missing_phone' | 'no_lead_match' | 'not_campaign_lead' | 'roi_journey_frozen';
  };

async function loadLastEvaluationStage(leadId: number) {
  return loadLastRoiEvaluationStage(leadId);
}

/**
 * Persists ChatPro events for Claude ROI — campaign-attributed leads only.
 * Organic/direct leads are ignored (webhook still marks whatsapp_replied_at separately).
 * @param event Parsed webhook event.
 * @param rawPayload Original JSON body for future attachment fields.
 */
export async function persistChatProMessage(
  event: ChatProInboundEvent,
  rawPayload: unknown,
): Promise<PersistChatProMessageResult> {
  if (!event.phoneKey) {
    return { ok: true, inserted: false, reason: 'missing_phone' };
  }

  const externalId = event.externalId ?? buildChatProMessageDedupKey(event);
  const existing = await db
    .select({ id: chatproMessagesSchema.id })
    .from(chatproMessagesSchema)
    .where(eq(chatproMessagesSchema.externalId, externalId))
    .limit(1);

  if (existing[0]) {
    return { ok: true, inserted: false, reason: 'duplicate' };
  }

  const leadId = await findLeadIdForChatProPhone(event.phoneKey);
  if (!leadId) {
    logger.info('ChatPro ROI: skip message — no lead match', { phoneKey: event.phoneKey });
    return { ok: true, inserted: false, reason: 'no_lead_match' };
  }

  const snapshot = await loadCampaignLeadSnapshot(leadId);
  const lastEvaluationStage = await loadLastEvaluationStage(leadId);
  if (!snapshot || !isLeadEligibleForClaudeAnalysis(snapshot, lastEvaluationStage)) {
    const reason = snapshot && leadHasCampaignAttribution(snapshot)
      ? 'roi_journey_frozen'
      : 'not_campaign_lead';
    logger.info('ChatPro ROI: skip message — lead not eligible', { leadId, phoneKey: event.phoneKey, reason });
    return { ok: true, inserted: false, reason };
  }

  const inserted = await db
    .insert(chatproMessagesSchema)
    .values({
      leadId,
      phoneKey: event.phoneKey,
      chatproEvent: event.event,
      fromMe: event.fromMe,
      messageText: event.messagePreview,
      mediaType: event.media.mediaType,
      mediaUrl: event.media.mediaUrl,
      mediaFilename: event.media.mediaFilename,
      mediaMimetype: event.media.mediaMimetype,
      externalId,
      rawPayload: rawPayload as Record<string, unknown>,
      eventAt: event.eventAt ?? new Date(),
    })
    .returning({ id: chatproMessagesSchema.id });

  const messageId = inserted[0]?.id;
  if (!messageId) {
    throw new Error('chatpro_message_insert_failed');
  }

  await enqueueChatProOutboxEvent(messageId, externalId, leadId, event);

  return { ok: true, inserted: true, messageId, leadId };
}
