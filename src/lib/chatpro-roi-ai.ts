import { Env } from '@/libs/Env';
import {
  evaluateChatProLeadWithClaude as evaluateChatProLeadCore,
  type ChatProConversationMessage,
  type ChatProLeadContext,
  type ChatProPriorEvaluation,
} from '@/lib/chatpro-roi-ai-core';

function parsePdfHostAllowlist(raw: string | undefined) {
  if (!raw?.trim()) {
    return [];
  }
  return raw.split(',').map((entry) => entry.trim()).filter(Boolean);
}

export type {
  ChatProConversationMessage,
  ChatProLeadContext,
  ChatProPriorEvaluation,
  ChatProRoiAiConfig,
} from '@/lib/chatpro-roi-ai-core';
export { fetchPdfForAnalysis, selectMessagesForClaudeAnalysis } from '@/lib/chatpro-roi-ai-core';

/**
 * Evaluates a ChatPro conversation using server Env credentials.
 * @param lead Lead attribution and form context.
 * @param messages Chronological ChatPro messages.
 * @param priorEvaluation Previous evaluation for incremental analysis.
 */
export async function evaluateChatProLeadWithClaude(
  lead: ChatProLeadContext,
  messages: ChatProConversationMessage[],
  priorEvaluation?: ChatProPriorEvaluation | null,
) {
  if (!Env.ANTHROPIC_API_KEY) {
    throw new Error('anthropic_not_configured');
  }

  return evaluateChatProLeadCore(
    lead,
    messages,
    {
      apiKey: Env.ANTHROPIC_API_KEY,
      model: Env.ANTHROPIC_MODEL,
      pdfAllowedHostSuffixes: parsePdfHostAllowlist(Env.CHATPRO_PDF_URL_ALLOWLIST),
    },
    priorEvaluation,
  );
}
