import 'server-only';

import { and, eq } from 'drizzle-orm';
import type { ChatProRoiEvaluation } from '@/validations/chatpro-roi';
import { db } from '@/libs/DB';
import { chatproLeadEvaluationsSchema } from '@/models/Schema';

export type SaveChatProRoiEvaluationInput = {
  leadId: number;
  messageCount: number;
  lastMessageId: number | null;
  model: string;
  trigger: string;
  result: ChatProRoiEvaluation;
};

export type SaveChatProRoiEvaluationResult = {
  evaluationId: number;
  duplicate: boolean;
};

/**
 * Persists a Claude evaluation once per lead + lastMessageId watermark.
 * Concurrent inserts collide on the unique index and reuse the existing row.
 */
export async function saveChatProRoiEvaluation(
  input: SaveChatProRoiEvaluationInput,
): Promise<SaveChatProRoiEvaluationResult> {
  if (input.lastMessageId !== null) {
    const existing = await db
      .select({ id: chatproLeadEvaluationsSchema.id })
      .from(chatproLeadEvaluationsSchema)
      .where(
        and(
          eq(chatproLeadEvaluationsSchema.leadId, input.leadId),
          eq(chatproLeadEvaluationsSchema.lastMessageId, input.lastMessageId),
        ),
      )
      .limit(1);

    if (existing[0]) {
      return { evaluationId: existing[0].id, duplicate: true };
    }
  }

  try {
    const inserted = await db
      .insert(chatproLeadEvaluationsSchema)
      .values({
        leadId: input.leadId,
        messageCount: input.messageCount,
        lastMessageId: input.lastMessageId,
        model: input.model,
        trigger: input.trigger,
        result: input.result,
      })
      .returning({ id: chatproLeadEvaluationsSchema.id });

    const evaluationId = inserted[0]?.id;
    if (!evaluationId) {
      throw new Error('evaluation_insert_failed');
    }

    return { evaluationId, duplicate: false };
  } catch (error) {
    if (input.lastMessageId === null) {
      throw error;
    }

    const existing = await db
      .select({ id: chatproLeadEvaluationsSchema.id })
      .from(chatproLeadEvaluationsSchema)
      .where(
        and(
          eq(chatproLeadEvaluationsSchema.leadId, input.leadId),
          eq(chatproLeadEvaluationsSchema.lastMessageId, input.lastMessageId),
        ),
      )
      .limit(1);

    if (existing[0]) {
      return { evaluationId: existing[0].id, duplicate: true };
    }

    throw error;
  }
}
