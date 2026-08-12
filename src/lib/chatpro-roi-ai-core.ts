import {
  buildChatProRoiOutputSchema,
  ChatProRoiEvaluationSchema,
  type ChatProRoiEvaluation,
} from '../validations/chatpro-roi';
import { isAllowedPdfFetchUrl } from './chatpro-pdf-url';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_PDF_BYTES = 15 * 1024 * 1024;

export type ChatProRoiAiConfig = {
  apiKey: string;
  model: string;
  /** Extra PDF host suffixes (from CHATPRO_PDF_URL_ALLOWLIST). */
  pdfAllowedHostSuffixes?: string[];
};

export type ChatProPriorEvaluation = {
  lastMessageId: number | null;
  messageCount: number;
  evaluatedAt: Date | string | null;
  result: ChatProRoiEvaluation;
};

export type ChatProConversationMessage = {
  id: number;
  fromMe: boolean;
  messageText: string | null;
  mediaType: string | null;
  mediaFilename: string | null;
  mediaMimetype: string | null;
  mediaUrl: string | null;
  eventAt: Date | null;
};

export type ChatProLeadContext = {
  id: number;
  name: string;
  status: string;
  equipmentName: string | null;
  city: string | null;
  message: string | null;
  utmCampaign: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  gclid: string | null;
};

type ClaudeResponse = {
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: string;
  error?: { message?: string };
};

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'document';
      source: { type: 'base64'; media_type: 'application/pdf'; data: string };
    };

function formatConversation(messages: ChatProConversationMessage[]) {
  return messages
    .map((message) => {
      const who = message.fromMe ? 'Empresa' : 'Cliente';
      const stamp = message.eventAt?.toISOString().slice(0, 16) ?? 'sem data';
      const text = message.messageText?.trim() || '(sem texto)';
      const attachment = message.mediaFilename || message.mediaType || message.mediaMimetype
        ? ` [anexo: ${[message.mediaFilename, message.mediaType, message.mediaMimetype].filter(Boolean).join(' / ')}]`
        : '';
      return `[${stamp}] ${who}: ${text}${attachment}`;
    })
    .join('\n');
}

function isPdfAttachment(message: ChatProConversationMessage) {
  const mimetype = message.mediaMimetype?.toLowerCase() ?? '';
  const filename = message.mediaFilename?.toLowerCase() ?? '';
  const mediaType = message.mediaType?.toLowerCase() ?? '';
  return (
    mimetype.includes('pdf')
    || filename.endsWith('.pdf')
    || mediaType === 'document'
  );
}

/**
 * Picks messages Claude should read: full thread on first run, only new ones after that.
 * @param messages Chronological ChatPro messages for the lead.
 * @param priorLastMessageId Last message id already covered by a previous evaluation.
 */
export function selectMessagesForClaudeAnalysis(
  messages: ChatProConversationMessage[],
  priorLastMessageId: number | null | undefined,
) {
  if (!priorLastMessageId) {
    return { mode: 'full' as const, messages };
  }

  const incremental = messages.filter((message) => message.id > priorLastMessageId);
  if (incremental.length === 0) {
    return { mode: 'full' as const, messages };
  }

  return { mode: 'incremental' as const, messages: incremental };
}

function formatPriorEvaluationBlock(prior: ChatProPriorEvaluation) {
  const stamp =
    prior.evaluatedAt instanceof Date
      ? prior.evaluatedAt.toISOString()
      : prior.evaluatedAt ?? 'sem data';
  const result = prior.result;

  return [
    'Contexto já analisado desta mesma conversa (não releia o histórico antigo):',
    `- Avaliado em: ${stamp}`,
    `- Até messageId: ${prior.lastMessageId ?? '—'} (${prior.messageCount} msgs)`,
    `- Stage anterior: ${result.stage}`,
    `- Intent/deal anteriores: ${result.intentScore}/${result.dealLikelihood}`,
    `- Contrato detectado antes: ${result.contractDetected ? 'sim' : 'não'}`,
    `- Valor mensal anterior: ${result.estimatedMonthlyValueBrl ?? 'null'}`,
    `- Resumo anterior: ${result.summary}`,
    `- Notas ROI anteriores: ${result.roiNotes}`,
    '',
    'Atualize a avaliação só com as mensagens NOVAS abaixo, preservando o que ainda for válido do contexto anterior.',
  ].join('\n');
}

/**
 * Downloads a PDF attachment for Claude document analysis.
 * @param url Remote file URL from ChatPro.
 * @param allowedHostSuffixes Optional extra host suffixes from env.
 */
export async function fetchPdfForAnalysis(url: string, allowedHostSuffixes: string[] = []) {
  if (!isAllowedPdfFetchUrl(url, allowedHostSuffixes)) {
    throw new Error('pdf_url_not_allowed');
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error('pdf_fetch_failed');
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_PDF_BYTES) {
    throw new Error('pdf_too_large');
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType && !contentType.includes('pdf') && !contentType.includes('octet-stream')) {
    throw new Error('pdf_invalid_mimetype');
  }

  return buffer.toString('base64');
}

/**
 * Evaluates a ChatPro conversation (+ optional contract PDFs) with Claude.
 * Reuses prior evaluation context so Claude only reads new messages when possible.
 * @param lead Lead attribution and form context.
 * @param messages Chronological ChatPro messages (full thread).
 * @param config Anthropic credentials and model.
 * @param priorEvaluation Last saved evaluation for this lead, if any.
 */
export async function evaluateChatProLeadWithClaude(
  lead: ChatProLeadContext,
  messages: ChatProConversationMessage[],
  config: ChatProRoiAiConfig,
  priorEvaluation?: ChatProPriorEvaluation | null,
): Promise<ChatProRoiEvaluation> {
  if (!config.apiKey) {
    throw new Error('anthropic_not_configured');
  }
  if (messages.length === 0) {
    throw new Error('chatpro_no_messages');
  }

  const selected = selectMessagesForClaudeAnalysis(
    messages,
    priorEvaluation?.lastMessageId,
  );
  const conversation = formatConversation(selected.messages);
  const pdfMessages = selected.messages.filter(
    (message) => message.mediaUrl && isPdfAttachment(message),
  );
  const isIncremental = selected.mode === 'incremental' && priorEvaluation;

  const contentBlocks: AnthropicContentBlock[] = [
    {
      type: 'text',
      text: [
        isIncremental
          ? 'Atualize a análise desta conversa WhatsApp (ChatPro) com mensagens novas de um lead de campanha paga.'
          : 'Analise esta conversa de WhatsApp (ChatPro) de um lead que veio de campanha paga.',
        'Contexto do formulário do site:',
        `- Nome: ${lead.name}`,
        `- Status CRM: ${lead.status}`,
        `- Equipamento solicitado: ${lead.equipmentName ?? 'não informado'}`,
        `- Cidade: ${lead.city ?? 'não informada'}`,
        `- Mensagem inicial: ${lead.message ?? 'não informada'}`,
        `- Campanha UTM: ${lead.utmCampaign ?? '—'} | Source: ${lead.utmSource ?? '—'} | Medium: ${lead.utmMedium ?? '—'}`,
        `- gclid: ${lead.gclid ? 'sim' : 'não'}`,
        '',
        isIncremental && priorEvaluation ? formatPriorEvaluationBlock(priorEvaluation) : '',
        isIncremental ? 'Mensagens NOVAS desde a última análise:' : 'Conversa WhatsApp (ordem cronológica):',
        conversation,
        '',
        pdfMessages.length > 0
          ? 'Há PDF(s) anexados abaixo — verifique se parecem contrato de locação e se batem com a conversa.'
          : isIncremental
            ? 'Nenhum PDF novo nestas mensagens.'
            : 'Nenhum PDF anexado nesta conversa.',
        '',
        'Responda em português do Brasil. Não invente valores — use null se não houver base na conversa ou no PDF.',
        'Fechamento real em locação costuma envolver contrato PDF; priorize evidências explícitas.',
      ].filter(Boolean).join('\n'),
    },
  ];

  for (const pdfMessage of pdfMessages.slice(0, 2)) {
    if (!pdfMessage.mediaUrl) {
      continue;
    }
    try {
      const base64 = await fetchPdfForAnalysis(
        pdfMessage.mediaUrl,
        config.pdfAllowedHostSuffixes ?? [],
      );
      contentBlocks.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64,
        },
      });
      contentBlocks.push({
        type: 'text',
        text: `PDF acima enviado em ${pdfMessage.eventAt?.toISOString() ?? 'data desconhecida'} (${pdfMessage.mediaFilename ?? 'contrato'}).`,
      });
    } catch {
      contentBlocks.push({
        type: 'text',
        text: `Não foi possível baixar o PDF ${pdfMessage.mediaFilename ?? pdfMessage.mediaUrl} — analise só pelo histórico textual.`,
      });
    }
  }

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
      'x-api-key': config.apiKey,
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2000,
      system: [
        'Você é analista comercial da Acesso Equipamentos (locação de equipamentos para construção civil, MG).',
        'Avalie intenção, estágio do funil, probabilidade de fechamento e consistência de contratos PDF com a conversa.',
        'Quando houver contexto anterior da mesma conversa, atualize a partir dele e das mensagens novas — não ignore evidências já registradas sem motivo.',
        'Seja conservador: só marque closed_won ou contractDetected quando houver evidência clara.',
        'estimatedMonthlyValueBrl só quando valores aparecerem na conversa ou contrato.',
      ].join(' '),
      messages: [{ role: 'user', content: contentBlocks }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: buildChatProRoiOutputSchema(),
        },
      },
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const payload = (await response.json()) as ClaudeResponse;
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('anthropic_auth_invalid');
    }
    throw new Error(payload.error?.message || 'anthropic_request_failed');
  }
  if (payload.stop_reason === 'max_tokens') {
    throw new Error('anthropic_incomplete_response');
  }

  const text = payload.content?.find((block) => block.type === 'text')?.text;
  if (!text) {
    throw new Error('anthropic_empty_response');
  }

  return ChatProRoiEvaluationSchema.parse(JSON.parse(text));
}
