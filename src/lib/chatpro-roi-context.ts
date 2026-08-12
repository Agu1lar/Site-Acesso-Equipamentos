import 'server-only';

import { asc, desc, eq } from 'drizzle-orm';
import { loadCampaignLeadSnapshot } from '@/lib/chatpro-lead-find';
import {
  leadHasCampaignAttribution,
  type CampaignLeadSnapshot,
} from '@/lib/chatpro-roi-eligibility';
import type {
  ChatProConversationMessage,
  ChatProLeadContext,
  ChatProPriorEvaluation,
} from '@/lib/chatpro-roi-ai-core';
import { ChatProRoiEvaluationSchema } from '@/validations/chatpro-roi';
import { db } from '@/libs/DB';
import { chatproLeadEvaluationsSchema, chatproMessagesSchema } from '@/models/Schema';

export type ChatProLeadAnalysisContext = {
  lead: ChatProLeadContext;
  messages: ChatProConversationMessage[];
  priorEvaluation: ChatProPriorEvaluation | null;
};

export type ChatProLeadAnalysisGateResult =
  | { ok: true; context: ChatProLeadAnalysisContext }
  | { ok: false; reason: 'lead_not_found' | 'not_campaign_lead' };

/** True when Claude ROI may read this lead's ChatPro messages. */
export function isLeadEligibleForClaudeAnalysis(snapshot: CampaignLeadSnapshot) {
  return leadHasCampaignAttribution(snapshot);
}

function snapshotToLeadContext(snapshot: NonNullable<Awaited<ReturnType<typeof loadCampaignLeadSnapshot>>>): ChatProLeadContext {
  return {
    id: snapshot.id,
    name: snapshot.name,
    status: snapshot.status,
    equipmentName: snapshot.equipmentName,
    city: snapshot.city,
    message: snapshot.message,
    utmCampaign: snapshot.utmCampaign,
    utmSource: snapshot.utmSource,
    utmMedium: snapshot.utmMedium,
    gclid: snapshot.gclid,
  };
}

async function loadPriorEvaluation(leadId: number): Promise<ChatProPriorEvaluation | null> {
  const rows = await db
    .select({
      lastMessageId: chatproLeadEvaluationsSchema.lastMessageId,
      messageCount: chatproLeadEvaluationsSchema.messageCount,
      evaluatedAt: chatproLeadEvaluationsSchema.evaluatedAt,
      result: chatproLeadEvaluationsSchema.result,
    })
    .from(chatproLeadEvaluationsSchema)
    .where(eq(chatproLeadEvaluationsSchema.leadId, leadId))
    .orderBy(desc(chatproLeadEvaluationsSchema.evaluatedAt))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  const parsed = ChatProRoiEvaluationSchema.safeParse(row.result);
  if (!parsed.success) {
    return null;
  }

  return {
    lastMessageId: row.lastMessageId,
    messageCount: row.messageCount,
    evaluatedAt: row.evaluatedAt,
    result: parsed.data,
  };
}

/**
 * Loads lead + messages for Claude only when the lead has campaign attribution.
 * @param leadId Site lead primary key.
 */
export async function resolveChatProLeadAnalysisContext(
  leadId: number,
): Promise<ChatProLeadAnalysisGateResult> {
  const snapshot = await loadCampaignLeadSnapshot(leadId);
  if (!snapshot) {
    return { ok: false, reason: 'lead_not_found' };
  }
  if (!isLeadEligibleForClaudeAnalysis(snapshot)) {
    return { ok: false, reason: 'not_campaign_lead' };
  }

  const [rows, priorEvaluation] = await Promise.all([
    db
      .select({
        id: chatproMessagesSchema.id,
        fromMe: chatproMessagesSchema.fromMe,
        messageText: chatproMessagesSchema.messageText,
        mediaType: chatproMessagesSchema.mediaType,
        mediaFilename: chatproMessagesSchema.mediaFilename,
        mediaMimetype: chatproMessagesSchema.mediaMimetype,
        mediaUrl: chatproMessagesSchema.mediaUrl,
        eventAt: chatproMessagesSchema.eventAt,
      })
      .from(chatproMessagesSchema)
      .where(eq(chatproMessagesSchema.leadId, leadId))
      .orderBy(asc(chatproMessagesSchema.eventAt), asc(chatproMessagesSchema.id)),
    loadPriorEvaluation(leadId),
  ]);

  return {
    ok: true,
    context: {
      lead: snapshotToLeadContext(snapshot),
      messages: rows,
      priorEvaluation,
    },
  };
}

/** @deprecated Use resolveChatProLeadAnalysisContext — returns null when not campaign-eligible. */
export async function loadChatProLeadAnalysisContext(
  leadId: number,
): Promise<ChatProLeadAnalysisContext | null> {
  const result = await resolveChatProLeadAnalysisContext(leadId);
  return result.ok ? result.context : null;
}
