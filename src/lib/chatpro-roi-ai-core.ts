import {
  buildChatProRoiOutputSchema,
  ChatProRoiEvaluationSchema,
  type ChatProRoiEvaluation,
} from '../validations/chatpro-roi';
import {
  isChatProAudioMedia,
  transcribeChatProAudioUrl,
} from './chatpro-audio-transcription';
import { isAllowedPdfFetchUrl } from './chatpro-pdf-url';
import { sanitizeChatProRoiEvaluationProse } from './chatpro-roi-prose';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_MEDIA_ATTACHMENTS = 3;
const CHATPRO_ROI_TIME_ZONE = 'America/Sao_Paulo';

export type ChatProAudioTranscriptionInput = {
  mediaUrl: string;
  mediaMimetype: string | null;
  mediaFilename: string | null;
};

export type ChatProAudioTranscriber = (
  input: ChatProAudioTranscriptionInput,
) => Promise<string>;

export type ChatProRoiAiConfig = {
  apiKey: string;
  model: string;
  /** Extra PDF host suffixes (from CHATPRO_PDF_URL_ALLOWLIST). */
  pdfAllowedHostSuffixes?: string[];
  /** OpenAI key for Whisper when audio messages lack text. */
  openAiApiKey?: string | null;
  /** Local or custom transcriber — runs before OpenAI when set. */
  transcribeAudio?: ChatProAudioTranscriber | null;
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

function formatChatProTimestamp(value: Date | string | null | undefined) {
  if (!value) {
    return 'sem data';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value instanceof Date ? 'sem data' : value;
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CHATPRO_ROI_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${byType.year}-${byType.month}-${byType.day} ${byType.hour}:${byType.minute} ${CHATPRO_ROI_TIME_ZONE}`;
}

function formatConversation(messages: ChatProConversationMessage[]) {
  return messages
    .map((message) => {
      const who = message.fromMe ? 'Vendedor da Acesso' : 'Cliente';
      const stamp = formatChatProTimestamp(message.eventAt);
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
  return Boolean(
    message.mediaUrl
    && (isPdfAttachment(message) || isImageAttachment(message) || isChatProAudioMedia(message)),
  );
}

/**
 * Fills missing messageText for audio attachments using a custom or OpenAI transcriber.
 */
export async function enrichMessagesWithAudioTranscriptions(
  messages: ChatProConversationMessage[],
  config: ChatProRoiAiConfig,
) {
  const customTranscriber = config.transcribeAudio;
  const openAiKey = config.openAiApiKey?.trim();
  if (!customTranscriber && !openAiKey) {
    return messages;
  }

  const allowedHosts = config.pdfAllowedHostSuffixes ?? [];
  return Promise.all(
    messages.map(async (message) => {
      if (message.messageText?.trim() || !message.mediaUrl || !isChatProAudioMedia(message)) {
        return message;
      }

      try {
        const transcription = customTranscriber
          ? await customTranscriber({
            mediaUrl: message.mediaUrl,
            mediaMimetype: message.mediaMimetype,
            mediaFilename: message.mediaFilename,
          })
          : await transcribeChatProAudioUrl(message.mediaUrl, openAiKey!, allowedHosts);
        return {
          ...message,
          messageText: transcription,
        };
      } catch {
        return message;
      }
    }),
  );
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
  const stamp = formatChatProTimestamp(prior.evaluatedAt);
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
  'Papéis da conversa:',
  '- Linhas marcadas como "Vendedor da Acesso" são mensagens da equipe comercial/atendimento da Acesso Equipamentos.',
  '- Se aparecer qualquer nome em mensagem do vendedor, trate como vendedor/atendente, não como empresa e não como cliente.',
  '- Não escreva "Empresa (Nome)"; prefira "vendedor Nome", "atendente Nome" ou "equipe da Acesso".',
  '- detectedContactName deve ser o nome do cliente/lead, nunca o nome de vendedor da Acesso.',
  '',
  'Sinais de fechamento (locação):',
  '- Contrato PDF coerente com a conversa.',
  '- Comentário explícito sobre emissão/envio de nota fiscal (NF) — ex.: "vou emitir a NF", "segue a NF", "nota fiscal emitida". Isso costuma indicar acordo fechado, mesmo sem anexo.',
  '- Nem todo fechamento inclui NF; não exija NF para marcar closed_won se houver outra evidência clara (contrato assinado, confirmação explícita de locação com valor).',
  '- Pergunta genérica sobre NF ("vocês emitem NF?") NÃO é fechamento — só curiosidade ou negociação.',
  'Sinais explícitos de perda têm prioridade sobre intenção, orçamento e negociação anteriores:',
  '- "resolveu/resolvi de outra forma", "não preciso mais" ou contratação de outro fornecedor significam closed_lost e suggestedStatus lost.',
  '- Agradecimento ou encerramento cordial não transforma uma solução externa em venda. "Muito obrigado" após "resolveu de outra forma" continua sendo perda.',
  '- Não confunda transferência de contato com transferência do negócio. Só marque ganho quando houver evidência de locação com a Acesso Equipamentos.',
  'Valores: estimatedMonthlyValueBrl somente quando aparecerem na conversa, NF, contrato ou anexo legível. Não invente.',
  'suggestedStatus espelha o CRM (new, contacted, quoted, won, lost) — é sugestão, não altera o sistema.',
  'Em summary, roiNotes e contractNotes escreva só em português claro para o comercial.',
  'Nunca use códigos internos no texto livre (proposal_sent, contract_sent, closed_won, closed_lost, inquiry, negotiation, quoted, contacted, gclid, utm_campaign, suggestedStatus, etc.).',
  'No texto livre diga "proposta enviada", "contrato enviado", "ganho", "perdido", "consulta", "negociação", "orçamento enviado", "clique pago do Google".',
  'Contato: detectedContactName só se o cliente se identificar claramente (ex.: "meu nome é João Silva"). Não use o placeholder do CRM como nome real.',
  'detectedEmail só se um e-mail explícito aparecer na conversa. Nunca invente e-mail.',
].join('\n');

const EXPLICIT_CUSTOMER_LOSS_PATTERNS = [
  /\b(?:resolveu|resolvi|resolvemos)\s+(?:a\s+(?:demanda|situacao|necessidade|questao|isso)\s+)?(?:por|de)\s+outr[ao]\s+(?:forma|maneira|jeito)\b/u,
  /\b(?:nao\s+(?:vou|vamos|irei|iremos)\s+(?:mais\s+)?precisar|nao\s+preciso\s+mais)\b/u,
  /\b(?:fechei|fechamos|aluguei|alugamos|loquei|locamos|contratei|contratamos)\s+(?:com|por)\s+outr[oa]\b/u,
  /\b(?:desisti|desistimos|cancelei|cancelamos)(?:\s+(?:da\s+)?(?:demanda|locacao|solicitacao|pedido))?\b/u,
];

const EXPLICIT_CUSTOMER_REOPEN_PATTERNS = [
  /\b(?:agora|novamente|ainda)\s+(?:preciso|queremos|quero|gostaria)\b/u,
  /\b(?:preciso|queremos|quero|gostaria)\s+(?:de|do|da|dos|das|um|uma)\b/u,
  /\b(?:vamos|quero|queremos)\s+fechar\b/u,
  /\b(?:pode|consegue)\s+(?:enviar|mandar)\s+(?:o\s+)?orcamento\b/u,
];

function normalizeCommercialText(value: string) {
  return value
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replaceAll(/\s+/gu, ' ')
    .trim();
}

function stripAcessoSellerNamesFromContact(
  evaluation: ChatProRoiEvaluation,
  messages: ChatProConversationMessage[],
) {
  if (!evaluation.detectedContactName) {
    return evaluation;
  }

  const normalizedContact = normalizeCommercialText(evaluation.detectedContactName);
  const sellerTexts = messages
    .filter((message) => message.fromMe && message.messageText?.trim())
    .map((message) => normalizeCommercialText(message.messageText ?? ''));

  const appearsOnlyInSellerText = sellerTexts.some((text) => {
    if (normalizedContact.length < 3 || !text.includes(normalizedContact)) {
      return false;
    }
    return /\b(?:atenciosamente|sou|aqui\s+e|me\s+chamo|fala\s+com|comercial|vendedor)\b/u.test(text);
  });

  if (!appearsOnlyInSellerText) {
    return evaluation;
  }

  return {
    ...evaluation,
    detectedContactName: null,
  };
}

function normalizeSellerWording(evaluation: ChatProRoiEvaluation) {
  return {
    ...evaluation,
    summary: evaluation.summary
      .replaceAll(/\bEmpresa\s*\(([^)]+)\)/gu, 'vendedor $1')
      .replaceAll(/\bempresa\s*\(([^)]+)\)/gu, 'vendedor $1'),
    roiNotes: evaluation.roiNotes
      .replaceAll(/\bEmpresa\s*\(([^)]+)\)/gu, 'vendedor $1')
      .replaceAll(/\bempresa\s*\(([^)]+)\)/gu, 'vendedor $1'),
  };
}

export function applyRoleGuardrails(
  evaluation: ChatProRoiEvaluation,
  messages: ChatProConversationMessage[],
) {
  return normalizeSellerWording(stripAcessoSellerNamesFromContact(evaluation, messages));
}

/**
 * Applies deterministic loss rules until the customer explicitly reopens demand.
 * @param evaluation Structured Claude evaluation.
 * @param messages Full conversation in chronological order.
 * @returns Original evaluation or a loss-corrected evaluation.
 */
export function applyExplicitCustomerLossGuardrail(
  evaluation: ChatProRoiEvaluation,
  messages: ChatProConversationMessage[],
) {
  let latestLossIndex = -1;
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message && !message.fromMe && message.messageText?.trim()) {
      const customerText = normalizeCommercialText(message.messageText);
      if (EXPLICIT_CUSTOMER_LOSS_PATTERNS.some(pattern => pattern.test(customerText))) {
        latestLossIndex = index;
      }
    }
  }

  if (latestLossIndex < 0) {
    return evaluation;
  }

  const reopened = messages.slice(latestLossIndex + 1).some((message) => {
    if (message.fromMe || !message.messageText?.trim()) {
      return false;
    }
    const customerText = normalizeCommercialText(message.messageText);
    return EXPLICIT_CUSTOMER_REOPEN_PATTERNS.some(pattern => pattern.test(customerText));
  });
  if (reopened) {
    return evaluation;
  }

  return {
    ...evaluation,
    stage: 'closed_lost' as const,
    dealLikelihood: 0,
    summary:
      'Cliente informou explicitamente que resolveu a demanda de outra forma e encerrou o atendimento sem locação com a Acesso Equipamentos.',
    suggestedStatus: 'lost' as const,
    roiNotes:
      'Lead perdido: o cliente resolveu a necessidade por outra alternativa, sem locação com a empresa.',
    followUpPriority: 'low' as const,
  };
}

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

  const enrichedMessages = await enrichMessagesWithAudioTranscriptions(messages, config);
  const selected = selectMessagesForClaudeAnalysis(
    enrichedMessages,
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
        `Fuso da linha do tempo: ${CHATPRO_ROI_TIME_ZONE}. Interprete todos os horários das mensagens como horário local de Belo Horizonte/São Paulo, não UTC.`,
        `Horário atual de referência: ${formatChatProTimestamp(new Date())}. Não descreva uma mensagem como já ocorrida se o horário exibido estiver no futuro em relação a esta referência.`,
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
        text: `PDF acima (${pdfMessage.fromMe ? 'Vendedor da Acesso' : 'Cliente'}) em ${formatChatProTimestamp(pdfMessage.eventAt)} — ${pdfMessage.mediaFilename ?? 'anexo'}.`,
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
        text: `Imagem acima (${imageMessage.fromMe ? 'Vendedor da Acesso' : 'Cliente'}) em ${formatChatProTimestamp(imageMessage.eventAt)} — ${imageMessage.mediaFilename ?? 'anexo'}. Pode ser NF ou documento.`,
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
        'Extraia detectedContactName e detectedEmail apenas com evidência explícita na conversa; caso contrário null.',
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

  const evaluation = ChatProRoiEvaluationSchema.parse(JSON.parse(text));
  return sanitizeChatProRoiEvaluationProse(
    applyExplicitCustomerLossGuardrail(applyRoleGuardrails(evaluation, enrichedMessages), enrichedMessages),
  );
}
