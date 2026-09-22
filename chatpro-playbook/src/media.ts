import { isAllowedPdfFetchUrl } from '../../src/lib/chatpro-pdf-url';

export type PlaybookMediaKind = 'audio' | 'pdf' | 'image' | 'document' | 'none';

export type PlaybookMedia = {
  kind: PlaybookMediaKind;
  url: string | null;
  fileType: string | null;
};

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Reads the ChatPro attachment URL and classifies audio, PDF, image or other file.
 */
export function extractPlaybookMedia(options: {
  raw: Record<string, unknown> | null | undefined;
  mediaType: string | null;
}): PlaybookMedia {
  const raw = options.raw ?? {};
  const url = readString(raw.url);
  const fileType = (readString(raw.file_type) ?? '').toLowerCase();
  const type = (options.mediaType ?? '').toLowerCase();
  const hint = `${fileType} ${type}`;

  if (!url && !hint.trim()) {
    return { kind: 'none', url: null, fileType: fileType || null };
  }

  if (hint.includes('audio') || hint.includes('ptt') || hint.includes('ogg') || hint.includes('opus')) {
    return { kind: 'audio', url, fileType: fileType || null };
  }
  if (hint.includes('pdf')) {
    return { kind: 'pdf', url, fileType: fileType || 'application/pdf' };
  }
  if (hint.includes('image') || /jpeg|jpg|png|gif|webp/u.test(hint)) {
    return { kind: 'image', url, fileType: fileType || null };
  }
  if (hint.includes('document') || hint.includes('officedocument') || hint.includes('msword')) {
    return { kind: 'document', url, fileType: fileType || null };
  }

  return { kind: url ? 'document' : 'none', url, fileType: fileType || null };
}

/**
 * True when the attachment URL is safe to download for playbook analysis.
 */
export function isPlaybookMediaUrlAllowed(url: string, extraHosts: string[] = []) {
  return isAllowedPdfFetchUrl(url, extraHosts);
}

/**
 * Builds the line Claude reads: text, then transcription or caption of the file.
 */
export function formatPlaybookMessageBody(options: {
  body: string | null;
  mediaText: string | null;
  mediaType: string | null;
}) {
  const body = options.body?.trim() ?? '';
  const mediaText = options.mediaText?.trim() ?? '';
  if (body && mediaText && body !== mediaText) {
    return `${body} | ${mediaText}`;
  }
  if (body) {
    return body;
  }
  if (mediaText) {
    return mediaText;
  }
  return `[${options.mediaType ?? 'mídia'}]`;
}
