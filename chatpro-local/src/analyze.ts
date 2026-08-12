import {
  evaluateChatProLeadWithClaude,
  selectMessagesForClaudeAnalysis,
  type ChatProConversationMessage,
  type ChatProLeadContext,
  type ChatProPriorEvaluation,
} from '../../src/lib/chatpro-roi-ai-core.ts';
import { ChatProRoiEvaluationSchema } from '../../src/validations/chatpro-roi.ts';
import type { LocalConfig } from './config.js';
import type { RemoteLeadContext } from './api-client.js';

/** Maps remote API JSON to Claude input types. */
export function mapRemoteLeadContext(context: RemoteLeadContext) {
  const lead: ChatProLeadContext = context.lead;
  const messages: ChatProConversationMessage[] = context.messages.map((message) => ({
    id: message.id,
    fromMe: message.fromMe,
    messageText: message.messageText,
    mediaType: message.mediaType,
    mediaFilename: message.mediaFilename,
    mediaMimetype: message.mediaMimetype,
    mediaUrl: message.mediaUrl,
    eventAt: message.eventAt ? new Date(message.eventAt) : null,
  }));

  let priorEvaluation: ChatProPriorEvaluation | null = null;
  if (context.priorEvaluation) {
    const parsed = ChatProRoiEvaluationSchema.safeParse(context.priorEvaluation.result);
    if (parsed.success) {
      priorEvaluation = {
        lastMessageId: context.priorEvaluation.lastMessageId,
        messageCount: context.priorEvaluation.messageCount,
        evaluatedAt: context.priorEvaluation.evaluatedAt,
        result: parsed.data,
      };
    }
  }

  return { lead, messages, priorEvaluation };
}

/**
 * Runs Claude ROI analysis for a lead using local Anthropic credentials.
 * @param context Lead and messages from the internal API.
 * @param config Local Anthropic configuration.
 */
export async function analyzeLeadContext(context: RemoteLeadContext, config: LocalConfig) {
  if (!config.anthropicApiKey) {
    throw new Error('anthropic_not_configured');
  }

  const { lead, messages, priorEvaluation } = mapRemoteLeadContext(context);
  const selected = selectMessagesForClaudeAnalysis(messages, priorEvaluation?.lastMessageId);

  const evaluation = await evaluateChatProLeadWithClaude(
    lead,
    messages,
    {
      apiKey: config.anthropicApiKey,
      model: config.anthropicModel,
      pdfAllowedHostSuffixes: config.pdfAllowedHostSuffixes,
    },
    priorEvaluation,
  );

  return {
    lead,
    messages,
    evaluation,
    analysisMode: selected.mode,
    analyzedMessageCount: selected.messages.length,
  };
}
