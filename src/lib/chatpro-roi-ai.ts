import { Env } from '@/libs/Env';
import {
  evaluateChatProLeadWithClaude as evaluateChatProLeadCore,
  type ChatProConversationMessage,
  type ChatProLeadContext,
} from '@/lib/chatpro-roi-ai-core';

export type {
  ChatProConversationMessage,
  ChatProLeadContext,
  ChatProRoiAiConfig,
} from '@/lib/chatpro-roi-ai-core';
export { fetchPdfForAnalysis } from '@/lib/chatpro-roi-ai-core';

/**
 * Evaluates a ChatPro conversation using server Env credentials.
 * @param lead Lead attribution and form context.
 * @param messages Chronological ChatPro messages.
 */
export async function evaluateChatProLeadWithClaude(
  lead: ChatProLeadContext,
  messages: ChatProConversationMessage[],
) {
  if (!Env.ANTHROPIC_API_KEY) {
    throw new Error('anthropic_not_configured');
  }

  return evaluateChatProLeadCore(lead, messages, {
    apiKey: Env.ANTHROPIC_API_KEY,
    model: Env.ANTHROPIC_MODEL,
  });
}
