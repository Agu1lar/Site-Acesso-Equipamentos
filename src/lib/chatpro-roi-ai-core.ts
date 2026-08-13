import {
  buildChatProRoiOutputSchema,
  ChatProRoiEvaluationSchema,
  type ChatProRoiEvaluation,
} from '../validations/chatpro-roi';
import { isAllowedPdfFetchUrl } from './chatpro-pdf-url';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_MEDIA_ATTACHMENTS = 3;

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

type AnthropicImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'document';
      source: { type: 'base64'; media_type: 'application/pdf'; data: string };
    }
  | {
      type: 'image';
      source: { type: 'base64'; media_type: AnthropicImageMediaType; data: string };
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

function isImageAttachment(message: ChatProConversationMessage) {
  if (isPdfAttachment(message)) {
    return false;
  }

  const mimetype = message.mediaMimetype?.toLowerCase() ?? '';
  const filename = message.mediaFilename?.toLowerCase() ?? '';
  const mediaType = message.mediaType?.toLowerCase() ?? '';

  return (
    mimetype.startsWith('image/')
    || mediaType === 'image'
    || /\.(jpe?g|png|gif|webp)$/u.test(filename)
  );
}

function resolveImageMediaType(
  mimetype: string | null | undefined,
  filename: string | null | undefined,
): AnthropicImageMediaType {
  const hint = `${mimetype ?? ''} ${filename ?? ''}`.toLowerCase();
  if (hint.includes('png')) {
    return 'image/png';
  }
  if (hint.includes('webp')) {
    return 'image/webp';
  }
  if (hint.includes('gif')) {
    return 'image/gif';
  }
  return 'image/jpeg';
}

function messageHasMediaAttachment(message: ChatProConversationMessage) {
  return Boolean(message.mediaUrl && (isPdfAttachment(message) || isImageAttachment(message)));
}

/**
 * Picks messages Claude should read: full thread on first run, only new ones after that.
 * Re-processes the full thread when new messages include PDF/image attachments.
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

  if (incremental.some(messageHasMediaAttachment)) {
    return { mode: 'full' as const, messages, reason: 'new_media' as const };
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

async function fetchRemoteMediaBase64(
  url: string,
  allowedHostSuffixes: string[],
  maxBytes: number,
  allowedContentHint: RegExp,
) {
  if (!isAllowedPdfFetchUrl(url, allowedHostSuffixes)) {
    throw new Error('media_url_not_allowed');
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    throw new Error('media_fetch_failed');
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > maxBytes) {
    throw new Error('media_too_large');
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (contentType && !allowedContentHint.test(contentType) && !contentType.includes('octet-stream')) {
    throw new Error('media_invalid_mimetype');
  }

  return buffer.toString('base64');
}

/**
 * Downloads a PDF attachment for Claude document analysis.
 */
export async function fetchPdfForAnalysis(url: string, allowedHostSuffixes: string[] = []) {
  return fetchRemoteMediaBase64(
    url,
    allowedHostSuffixes,
    MAX_PDF_BYTES,
    /pdf/u,
  );
}

/**
 * Downloads an image attachment for Claude vision analysis.
 */
export async function fetchImageForAnalysis(
  url: string,
  allowedHostSuffixes: string[] = [],
  mediaTypeHint?: AnthropicImageMediaType,
) {
  const base64 = await fetchRemoteMediaBase64(
    url,
    allowedHostSuffixes,
    MAX_IMAGE_BYTES,
    /image\/(jpeg|jpg|png|gif|webp)|octet-stream/u,
  );

  return {
    base64,
    mediaType: mediaTypeHint ?? 'image/jpeg' as AnthropicImageMediaType,
  };
}

const ROI_ANALYSIS_GUIDANCE = [
  'Sinais de fechamento (locação):',
  '- Contrato PDF coerente com a conversa.',
  '- Comentário explícito sobre emissão/envio de nota fiscal (NF) — ex.: "vou emitir a NF", "segue a NF", "nota fiscal emitida". Isso costuma indicar acordo fechado, mesmo sem anexo.',
  '- Nem todo fechamento inclui NF; não exija NF para marcar closed_won se houver outra evidência clara (contrato assinado, confirmação explícita de locação com valor).',
  '- Pergunta genérica sobre NF ("vocês emitem NF?") NÃO é fechamento — só curiosidade ou negociação.',
  'Valores: estimatedMonthlyValueBrl somente quando aparecerem na conversa, NF, contrato ou anexo legível. Não invente.',
  'suggestedStatus espelha o CRM (new, contacted, quoted, won, lost) — é sugestão, não altera o sistema.',
].join('\n');

/**
 * Evaluates a ChatPro conversation (+ optional contract PDFs and images) with Claude.
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
  const imageMessages = selected.messages.filter(
    (message) => message.mediaUrl && isImageAttachment(message),
  );
  const isIncremental = selected.mode === 'incremental' && priorEvaluation;
  const allowedHosts = config.pdfAllowedHostSuffixes ?? [];

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
        ROI_ANALYSIS_GUIDANCE,
        '',
        isIncremental && priorEvaluation ? formatPriorEvaluationBlock(priorEvaluation) : '',
        isIncremental ? 'Mensagens NOVAS desde a última análise:' : 'Conversa WhatsApp (ordem cronológica):',
        conversation,
        '',
        pdfMessages.length > 0
          ? 'Há PDF(s) anexados abaixo — podem ser contrato de locação ou NF em PDF.'
          : isIncremental
            ? 'Nenhum PDF novo nestas mensagens.'
            : 'Nenhum PDF anexado nesta conversa.',
        imageMessages.length > 0
          ? 'Há imagem(ns) anexada(s) abaixo — podem ser NF, contrato escaneado ou foto do equipamento.'
          : isIncremental
            ? 'Nenhuma imagem nova nestas mensagens.'
            : 'Nenhuma imagem anexada nesta conversa.',
        '',
        'Responda em português do Brasil.',
      ].filter(Boolean).join('\n'),
    },
  ];

  let attachmentsAdded = 0;

  for (const pdfMessage of pdfMessages) {
    if (!pdfMessage.mediaUrl || attachmentsAdded >= MAX_MEDIA_ATTACHMENTS) {
      continue;
    }
    try {
      const base64 = await fetchPdfForAnalysis(pdfMessage.mediaUrl, allowedHosts);
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
        text: `PDF acima (${pdfMessage.fromMe ? 'Empresa' : 'Cliente'}) em ${pdfMessage.eventAt?.toISOString() ?? 'data desconhecida'} — ${pdfMessage.mediaFilename ?? 'anexo'}.`,
      });
      attachmentsAdded += 1;
    } catch {
      contentBlocks.push({
        type: 'text',
        text: `Não foi possível baixar o PDF ${pdfMessage.mediaFilename ?? pdfMessage.mediaUrl} — analise pelo texto da conversa.`,
      });
    }
  }

  for (const imageMessage of imageMessages) {
    if (!imageMessage.mediaUrl || attachmentsAdded >= MAX_MEDIA_ATTACHMENTS) {
      continue;
    }
    const mediaType = resolveImageMediaType(imageMessage.mediaMimetype, imageMessage.mediaFilename);
    try {
      const image = await fetchImageForAnalysis(imageMessage.mediaUrl, allowedHosts, mediaType);
      contentBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: image.mediaType,
          data: image.base64,
        },
      });
      contentBlocks.push({
        type: 'text',
        text: `Imagem acima (${imageMessage.fromMe ? 'Empresa' : 'Cliente'}) em ${imageMessage.eventAt?.toISOString() ?? 'data desconhecida'} — ${imageMessage.mediaFilename ?? 'anexo'}. Pode ser NF ou documento.`,
      });
      attachmentsAdded += 1;
    } catch {
      contentBlocks.push({
        type: 'text',
        text: `Não foi possível baixar a imagem ${imageMessage.mediaFilename ?? imageMessage.mediaUrl} — analise pelo texto da conversa.`,
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
        'Avalie intenção, estágio do funil, probabilidade de fechamento e evidências de fechamento (contrato, NF, confirmação explícita).',
        'Quando houver contexto anterior da mesma conversa, atualize a partir dele e das mensagens novas.',
        'Menção clara de emissão/envio de NF pela empresa costuma indicar acordo fechado — trate como closed_won salvo contexto contrário.',
        'Seja conservador em closed_lost e em valores; não marque closed_won só por perguntas sobre NF.',
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
