import { isAllowedPdfFetchUrl } from './chatpro-pdf-url';

const OPENAI_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions';
export const MAX_CHATPRO_AUDIO_BYTES = 25 * 1024 * 1024;

export type ChatProAudioMedia = {
  mediaType: string | null;
  mediaMimetype: string | null;
  mediaFilename: string | null;
  mediaUrl: string | null;
};

/**
 * True when the ChatPro attachment looks like a voice note or audio file.
 */
export function isChatProAudioMedia(media: ChatProAudioMedia) {
  const mediaType = media.mediaType?.toLowerCase() ?? '';
  const mimetype = media.mediaMimetype?.toLowerCase() ?? '';
  const filename = media.mediaFilename?.toLowerCase() ?? '';

  return (
    mediaType.includes('audio')
    || mediaType === 'ptt'
    || mediaType === 'voice'
    || mediaType.includes('ptt')
    || mimetype.startsWith('audio/')
    || mimetype.includes('ogg')
    || /\.(ogg|opus|mp3|m4a|aac|amr|wav|webm)$/u.test(filename)
  );
}

export function resolveChatProAudioFilename(
  mimetype: string | null | undefined,
  filename: string | null | undefined,
) {
  const hint = `${mimetype ?? ''} ${filename ?? ''}`.toLowerCase();
  if (hint.includes('mpeg') || hint.includes('.mp3')) {
    return 'audio.mp3';
  }
  if (hint.includes('m4a') || hint.includes('mp4')) {
    return 'audio.m4a';
  }
  if (hint.includes('wav')) {
    return 'audio.wav';
  }
  if (hint.includes('webm')) {
    return 'audio.webm';
  }
  return 'audio.ogg';
}

export type DownloadedChatProAudio = {
  buffer: Buffer;
  mimetype: string | null;
};

/**
 * Downloads a ChatPro audio attachment after SSRF checks.
 */
export async function downloadChatProAudioBuffer(
  mediaUrl: string,
  allowedHostSuffixes: string[] = [],
): Promise<DownloadedChatProAudio> {
  if (!isAllowedPdfFetchUrl(mediaUrl, allowedHostSuffixes)) {
    throw new Error('chatpro_audio_url_not_allowed');
  }

  const audioResponse = await fetch(mediaUrl, {
    signal: AbortSignal.timeout(45_000),
  });
  if (!audioResponse.ok) {
    throw new Error(`chatpro_audio_download_failed:${audioResponse.status}`);
  }

  const contentLength = Number(audioResponse.headers.get('content-length') ?? 0);
  if (contentLength > MAX_CHATPRO_AUDIO_BYTES) {
    throw new Error('chatpro_audio_too_large');
  }

  const buffer = Buffer.from(await audioResponse.arrayBuffer());
  if (buffer.byteLength > MAX_CHATPRO_AUDIO_BYTES) {
    throw new Error('chatpro_audio_too_large');
  }
  if (buffer.byteLength === 0) {
    throw new Error('chatpro_audio_empty');
  }

  return {
    buffer,
    mimetype: audioResponse.headers.get('content-type'),
  };
}

/**
 * Transcribes a remote ChatPro audio URL with OpenAI Whisper.
 * @param mediaUrl HTTPS URL from ChatPro webhook.
 * @param apiKey OpenAI API key (sk-…).
 * @param allowedHostSuffixes Extra host suffixes from CHATPRO_PDF_URL_ALLOWLIST.
 */
export async function transcribeChatProAudioUrl(
  mediaUrl: string,
  apiKey: string,
  allowedHostSuffixes: string[] = [],
) {
  const { buffer, mimetype } = await downloadChatProAudioBuffer(mediaUrl, allowedHostSuffixes);

  const formData = new FormData();
  formData.append(
    'file',
    new Blob([Uint8Array.from(buffer)], { type: mimetype ?? 'audio/ogg' }),
    resolveChatProAudioFilename(mimetype, null),
  );
  formData.append('model', 'whisper-1');
  formData.append('language', 'pt');
  formData.append('response_format', 'json');

  const transcriptionResponse = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
    signal: AbortSignal.timeout(120_000),
  });

  const payload = (await transcriptionResponse.json()) as { text?: string; error?: { message?: string } };
  if (!transcriptionResponse.ok) {
    throw new Error(payload.error?.message || 'openai_transcription_failed');
  }

  const text = payload.text?.trim();
  if (!text) {
    throw new Error('openai_transcription_empty');
  }

  return text;
}
