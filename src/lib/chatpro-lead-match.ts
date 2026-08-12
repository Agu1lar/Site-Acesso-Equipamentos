import 'server-only';

import { eq } from 'drizzle-orm';
import { isChatProClientReply, type ChatProInboundEvent } from '@/lib/chatpro-webhook';
import { findLeadIdForChatProPhone } from '@/lib/chatpro-lead-find';
import { db } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { leadsSchema } from '@/models/Schema';

export type ChatProLeadMatchResult =
  | { ok: true; ignored: true; reason: string }
  | { ok: true; ignored: false; leadId: number; updatedStatus: string }
  | { ok: true; ignored: true; reason: 'no_match'; phoneKey: string };

/**
 * Finds the newest eligible lead for a ChatPro inbound reply and marks it replied.
 */
export async function applyChatProReplyToLead(event: ChatProInboundEvent): Promise<ChatProLeadMatchResult> {
  if (!isChatProClientReply(event) || !event.phoneKey) {
    return { ok: true, ignored: true, reason: 'not_client_reply' };
  }

  const leadId = await findLeadIdForChatProPhone(event.phoneKey);
  if (!leadId) {
    logger.info('ChatPro webhook: sem lead para o telefone', { phoneKey: event.phoneKey });
    return { ok: true, ignored: true, reason: 'no_match', phoneKey: event.phoneKey };
  }

  const matches = await db
    .select({
      id: leadsSchema.id,
      status: leadsSchema.status,
      whatsappRepliedAt: leadsSchema.whatsappRepliedAt,
      internalNotes: leadsSchema.internalNotes,
    })
    .from(leadsSchema)
    .where(eq(leadsSchema.id, leadId))
    .limit(1);

  const lead = matches[0];
  if (!lead) {
    return { ok: true, ignored: true, reason: 'no_match', phoneKey: event.phoneKey };
  }

  const now = event.eventAt && !Number.isNaN(event.eventAt.getTime()) ? event.eventAt : new Date();
  const nextStatus = lead.status === 'new' ? 'contacted' : lead.status;
  const firstReply = !lead.whatsappRepliedAt;
  const stamp = now.toISOString().slice(0, 16).replace('T', ' ');
  const noteLine = `[ChatPro] Cliente respondeu no WhatsApp (${stamp} UTC)`;
  const nextNotes = firstReply
    ? [lead.internalNotes?.trim(), noteLine].filter(Boolean).join('\n')
    : lead.internalNotes;

  await db
    .update(leadsSchema)
    .set({
      whatsappRepliedAt: lead.whatsappRepliedAt ?? now,
      lastActivityAt: now,
      status: nextStatus,
      ...(firstReply ? { internalNotes: nextNotes } : {}),
    })
    .where(eq(leadsSchema.id, lead.id));

  logger.info('ChatPro webhook: lead marcado como respondeu', {
    leadId: lead.id,
    phoneKey: event.phoneKey,
    status: nextStatus,
  });

  return {
    ok: true,
    ignored: false,
    leadId: lead.id,
    updatedStatus: nextStatus,
  };
}
