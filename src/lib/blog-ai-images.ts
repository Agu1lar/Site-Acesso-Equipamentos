import 'server-only';
import { storeAdminImage } from '@/lib/admin-image-upload';
import { Env } from '@/libs/Env';

const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations';

const STYLE_SUFFIX =
  ' Photorealistic editorial photo for a Brazilian construction-equipment rental blog. ' +
  'Natural daylight, realistic job-site or workshop atmosphere, no text, no watermarks, ' +
  'no logos, no readable signs, no identifiable faces, no brand names.';

type OpenAiImagesResponse = {
  data?: { b64_json?: string; url?: string }[];
  error?: { message?: string; code?: string; type?: string };
};

/**
 * Maps OpenAI HTTP failures to stable blog AI error codes.
 * @param response Fetch response from OpenAI Images.
 * @param payload Parsed JSON body.
 */
export function mapOpenAiImageError(response: Response, payload: OpenAiImagesResponse) {
  const message = payload.error?.message || 'openai_image_failed';
  if (response.status === 429 && /no credits remaining/i.test(message)) {
    return 'openai_no_credits';
  }
  return message;
}

/**
 * Returns true when OpenAI image generation is configured.
 */
export function isOpenAiImageConfigured() {
  return Boolean(Env.OPENAI_API_KEY);
}

/**
 * Builds the final prompt sent to OpenAI Images.
 * @param prompt Visual brief from the editorial model.
 */
export function buildBlogImagePrompt(prompt: string) {
  return `${prompt.trim()}.${STYLE_SUFFIX}`;
}

/**
 * Generates an image buffer via OpenAI Images.
 * @param prompt Visual brief (English preferred).
 * @returns PNG/JPEG buffer and MIME type.
 */
export async function generateBlogImageBuffer(prompt: string) {
  if (!Env.OPENAI_API_KEY) {
    throw new Error('openai_not_configured');
  }

  const response = await fetch(OPENAI_IMAGES_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${Env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: Env.OPENAI_IMAGE_MODEL,
      prompt: buildBlogImagePrompt(prompt),
      size: '1536x1024',
      n: 1,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  const payload = (await response.json()) as OpenAiImagesResponse;
  if (!response.ok) {
    throw new Error(mapOpenAiImageError(response, payload));
  }

  const item = payload.data?.[0];
  if (item?.b64_json) {
    return {
      buffer: Buffer.from(item.b64_json, 'base64'),
      mime: 'image/png' as const,
    };
  }

  if (item?.url) {
    const imageResponse = await fetch(item.url, { signal: AbortSignal.timeout(60_000) });
    if (!imageResponse.ok) {
      throw new Error('openai_image_download_failed');
    }
    const contentType = imageResponse.headers.get('content-type') || 'image/png';
    const mime =
      contentType.includes('jpeg') || contentType.includes('jpg')
        ? ('image/jpeg' as const)
        : contentType.includes('webp')
          ? ('image/webp' as const)
          : ('image/png' as const);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    return { buffer, mime };
  }

  throw new Error('openai_image_empty');
}

/**
 * Persists a generated blog image to Blob or local public uploads.
 * @param options Image bytes, MIME type, and article slug prefix.
 * @returns Public URL for the stored image.
 */
export async function persistGeneratedBlogImage(options: {
  buffer: Buffer;
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  slug: string;
}) {
  const extension =
    options.mime === 'image/jpeg' ? 'jpg' : options.mime === 'image/webp' ? 'webp' : 'png';
  const bytes = new Uint8Array(options.buffer);
  const file = new File([bytes], `ai-${Date.now()}.${extension}`, {
    type: options.mime,
  });
  return storeAdminImage(file, { folder: 'blog', slug: options.slug });
}

/**
 * Generates and stores one editorial blog image.
 * @param options Prompt and article slug.
 * @returns Public URL of the stored image.
 */
export async function createAndStoreBlogAiImage(options: {
  prompt: string;
  slug: string;
}) {
  const generated = await generateBlogImageBuffer(options.prompt);
  return persistGeneratedBlogImage({
    buffer: generated.buffer,
    mime: generated.mime,
    slug: options.slug,
  });
}
