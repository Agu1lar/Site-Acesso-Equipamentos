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
 * @param lead Lead attribution and form context.
 * @param messages Chronological ChatPro messages.
 * @param config Anthropic credentials and model.
 */
export async function evaluateChatProLeadWithClaude(
  lead: ChatProLeadContext,
  messages: ChatProConversationMessage[],
  config: ChatProRoiAiConfig,
): Promise<ChatProRoiEvaluation> {
  if (!config.apiKey) {
    throw new Error('anthropic_not_configured');
  }
  if (messages.length === 0) {
    throw new Error('chatpro_no_messages');
  }

  const conversation = formatConversation(messages);
  const pdfMessages = messages.filter((message) => message.mediaUrl && isPdfAttachment(message));

  const contentBlocks: AnthropicContentBlock[] = [
    {
      type: 'text',
      text: [
        'Analise esta conversa de WhatsApp (ChatPro) de um lead que veio de campanha paga.',
        'Contexto do formulário do site:',
        `- Nome: ${lead.name}`,
        `- Status CRM: ${lead.status}`,
        `- Equipamento solicitado: ${lead.equipmentName ?? 'não informado'}`,
        `- Cidade: ${lead.city ?? 'não informada'}`,
        `- Mensagem inicial: ${lead.message ?? 'não informada'}`,
        `- Campanha UTM: ${lead.utmCampaign ?? '—'} | Source: ${lead.utmSource ?? '—'} | Medium: ${lead.utmMedium ?? '—'}`,
        `- gclid: ${lead.gclid ? 'sim' : 'não'}`,
        '',
        'Conversa WhatsApp (ordem cronológica):',
        conversation,
        '',
        pdfMessages.length > 0
          ? 'Há PDF(s) anexados abaixo — verifique se parecem contrato de locação e se batem com a conversa.'
          : 'Nenhum PDF anexado nesta conversa.',
        '',
        'Responda em português do Brasil. Não invente valores — use null se não houver base na conversa ou no PDF.',
        'Fechamento real em locação costuma envolver contrato PDF; priorize evidências explícitas.',
      ].join('\n'),
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
