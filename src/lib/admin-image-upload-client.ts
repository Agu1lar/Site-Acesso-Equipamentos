const UPLOAD_TIMEOUT_MS = 60_000;
const VIDEO_UPLOAD_TIMEOUT_MS = 180_000;

export type AdminImageUploadEndpoint =
  | '/api/admin/blog/upload'
  | '/api/admin/equipment/upload'
  | '/api/admin/equipment/laudo/upload';

async function postAdminUpload(props: {
  file: File;
  endpoint: AdminImageUploadEndpoint;
  slug?: string;
  timeoutMs: number;
}) {
  const body = new FormData();
  body.append('file', props.file);
  if (props.slug?.trim()) {
    body.append('slug', props.slug.trim());
  }

  let response: Response;
  try {
    response = await fetch(props.endpoint, {
      method: 'POST',
      body,
      credentials: 'same-origin',
      signal: AbortSignal.timeout(props.timeoutMs),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error('Upload demorou demais. Tente novamente.', { cause: error });
    }
    throw new Error('Falha na conexão com o servidor.', { cause: error });
  }

  let payload: { url?: string; error?: string };
  const rawBody = await response.text();
  if (!rawBody.trim()) {
    throw new Error(`Erro do servidor (${response.status}).`);
  }

  try {
    payload = JSON.parse(rawBody) as { url?: string; error?: string };
  } catch {
    throw new Error(
      response.status === 401 || response.status === 403
        ? 'Sessão expirada. Faça login novamente no painel.'
        : `Erro do servidor (${response.status}).`,
    );
  }

  if (!response.ok) {
    throw new Error(payload.error ?? 'Falha no upload.');
  }

  if (!payload.url) {
    throw new Error('URL do arquivo não retornada.');
  }

  return { url: payload.url };
}

/**
 * Uploads one image to an admin API route with timeout and error parsing.
 */
export async function uploadAdminImage(props: {
  file: File;
  endpoint: AdminImageUploadEndpoint;
  slug?: string;
}) {
  return postAdminUpload({ ...props, timeoutMs: UPLOAD_TIMEOUT_MS });
}

/**
 * Uploads blog image or video (longer timeout for video files).
 */
export async function uploadAdminBlogMedia(props: {
  file: File;
  endpoint: '/api/admin/blog/upload';
  slug?: string;
}) {
  const isVideo =
    props.file.type.startsWith('video/') || /\.(mp4|webm)$/iu.test(props.file.name);
  return postAdminUpload({
    ...props,
    timeoutMs: isVideo ? VIDEO_UPLOAD_TIMEOUT_MS : UPLOAD_TIMEOUT_MS,
  });
}

/**
 * Uploads one equipment laudo PDF.
 */
export async function uploadAdminEquipmentLaudo(props: { file: File; slug?: string }) {
  return postAdminUpload({
    file: props.file,
    endpoint: '/api/admin/equipment/laudo/upload',
    slug: props.slug,
    timeoutMs: UPLOAD_TIMEOUT_MS,
  });
}

/**
 * Returns image files from a FileList, including extension fallback when MIME is missing.
 */
export function pickImageFiles(files: FileList | File[]) {
  return [...files].filter((file) => {
    if (file.type.startsWith('image/')) {
      return true;
    }
    return /\.(jpe?g|png|webp)$/iu.test(file.name);
  });
}
