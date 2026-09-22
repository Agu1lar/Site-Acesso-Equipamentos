import type { Pool } from 'pg';
import type { PlaybookConfig } from './config.js';
import type { MessageRow } from './db.js';
import { updateMessageMediaText } from './db.js';
import {
  extractPlaybookMedia,
  isPlaybookMediaUrlAllowed,
} from './media.js';
import { redactCustomerPii } from './redact.js';
import { transcribePlaybookAudio } from './transcribe.js';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_PDF_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_MEDIA_PER_RUN = 30;

type AnthropicImageType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function imageMediaType(fileType: string | null): AnthropicImageType {
  const hint = (fileType ?? '').toLowerCase();
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

async function downloadAllowedMedia(url: string, maxBytes: number) {
  if (!isPlaybookMediaUrlAllowed(url)) {
    throw new Error('media_url_not_allowed');
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(45_000) });
  if (!response.ok) {
    throw new Error(`media_fetch_failed:${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength === 0 || buffer.byteLength > maxBytes) {
    throw new Error('media_size_invalid');
  }
  return buffer;
}

async function captionWithHaiku(options: {
  apiKey: string;
  model: string;
  kind: 'pdf' | 'image';
  buffer: Buffer;
  mediaType: AnthropicImageType;
}) {
  const mediaBlock = options.kind === 'pdf'
    ? {
        type: 'document' as const,
        source: {
          type: 'base64' as const,
          media_type: 'application/pdf' as const,
          data: options.buffer.toString('base64'),
        },
      }
    : {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: options.mediaType,
          data: options.buffer.toString('base64'),
        },
      };

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
      'x-api-key': options.apiKey,
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: 220,
      system:
        'Descreva o anexo em no máximo duas frases, em português. Não trate número como preço oficial. Não invente frete.',
      messages: [{
        role: 'user',
        content: [
          mediaBlock,
          {
            type: 'text',
            text: 'O que este arquivo mostra no atendimento de locação? Resumo curto.',
          },
        ],
      }],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const payload = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message || 'caption_failed');
  }
  const text = payload.content?.find((block) => block.type === 'text')?.text?.trim();
  if (!text) {
    throw new Error('caption_empty');
  }
  return redactCustomerPii(text);
}

/**
 * Transcribes or captions one message. Skips when media_text is already stored.
 */
export async function enrichOneMessage(options: {
  pool: Pool;
  config: PlaybookConfig;
  message: MessageRow;
}) {
  if (options.message.media_text?.trim()) {
    return 'skip';
  }
  const media = extractPlaybookMedia({
    raw: asRecord(options.message.raw),
    mediaType: options.message.media_type,
  });
  if (media.kind === 'none') {
    return 'skip';
  }
  if (media.kind === 'document') {
    const label = `[documento ${media.fileType ?? 'anexo'} — conteúdo não lido]`;
    await updateMessageMediaText({
      pool: options.pool,
      messageId: options.message.id,
      mediaText: label,
    });
    options.message.media_text = label;
    return 'document';
  }
  if (!media.url) {
    return 'skip';
  }

  let mediaText = '';
  if (media.kind === 'audio') {
    if (!options.config.whisperEnabled) {
      return 'skip';
    }
    mediaText = `[áudio] ${await transcribePlaybookAudio({
      mediaUrl: media.url,
      model: options.config.whisperModel,
    })}`;
  } else if (media.kind === 'pdf') {
    if (!options.config.anthropicApiKey) {
      return 'skip';
    }
    const buffer = await downloadAllowedMedia(media.url, MAX_PDF_BYTES);
    mediaText = `[pdf] ${await captionWithHaiku({
      apiKey: options.config.anthropicApiKey,
      model: options.config.anthropicModel,
      kind: 'pdf',
      buffer,
      mediaType: 'image/jpeg',
    })}`;
  } else {
    if (!options.config.anthropicApiKey) {
      return 'skip';
    }
    const buffer = await downloadAllowedMedia(media.url, MAX_IMAGE_BYTES);
    mediaText = `[foto] ${await captionWithHaiku({
      apiKey: options.config.anthropicApiKey,
      model: options.config.anthropicModel,
      kind: 'image',
      buffer,
      mediaType: imageMediaType(media.fileType),
    })}`;
  }

  const stored = redactCustomerPii(mediaText).slice(0, 800);
  await updateMessageMediaText({
    pool: options.pool,
    messageId: options.message.id,
    mediaText: stored,
  });
  options.message.media_text = stored;
  return media.kind;
}

/**
 * Transcribes audio and captions PDF/image for playbook threads. Never sends WhatsApp.
 */
export async function enrichPlaybookMedia(options: {
  pool: Pool;
  config: PlaybookConfig;
  threads: Array<{ messages: MessageRow[] }>;
}) {
  let processed = 0;
  let audio = 0;
  let pdf = 0;
  let image = 0;
  let failed = 0;

  for (const thread of options.threads) {
    for (const message of thread.messages) {
      if (processed >= MAX_MEDIA_PER_RUN) {
        return { processed, audio, pdf, image, failed, capped: true };
      }
      try {
        const kind = await enrichOneMessage({
          pool: options.pool,
          config: options.config,
          message,
        });
        if (kind === 'audio') {
          audio += 1;
          processed += 1;
        } else if (kind === 'pdf') {
          pdf += 1;
          processed += 1;
        } else if (kind === 'image') {
          image += 1;
          processed += 1;
        } else if (kind === 'document') {
          processed += 1;
        }
      } catch (error) {
        failed += 1;
        const reason = error instanceof Error ? error.message : String(error);
        console.warn('[chatpro-playbook] mídia falhou, segue', {
          messageId: message.id.slice(0, 12),
          reason,
        });
      }
    }
  }

  return { processed, audio, pdf, image, failed, capped: false };
}
