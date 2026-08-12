import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { put } from '@vercel/blob';
import {
  Env,
  getBlobReadWriteToken,
  getBlobStoreId,
  isVercelRuntime,
} from '@/libs/Env';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

function extensionForMime(mime: string) {
  if (mime === 'image/png') {
    return 'png';
  }
  if (mime === 'image/webp') {
    return 'webp';
  }
  return 'jpg';
}

function slugifySafe(value: string) {
  return value.replaceAll(/[^a-z0-9-]/giu, '-').replaceAll(/-+/gu, '-').slice(0, 80);
}

/**
 * Resolves MIME type from file metadata or extension (Windows often omits file.type).
 */
export function resolveAdminImageMime(file: Pick<File, 'name' | 'type'>) {
  if (file.type && ALLOWED_TYPES.has(file.type)) {
    return file.type;
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') {
    return 'image/jpeg';
  }
  if (ext === 'png') {
    return 'image/png';
  }
  if (ext === 'webp') {
    return 'image/webp';
  }

  return null;
}

/**
 * Validates an uploaded admin image file.
 */
export function validateAdminImageFile(file: File) {
  const mime = resolveAdminImageMime(file);
  if (!mime) {
    return { ok: false as const, error: 'Formato inválido. Use JPG, PNG ou WebP.' };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false as const, error: 'Arquivo muito grande. Máximo 5 MB.' };
  }
  return { ok: true as const, mime };
}

type StoreAdminImageOptions = {
  folder: 'equipment' | 'blog';
  slug?: string;
};

function canPersistAdminImagesLocally() {
  return Env.NODE_ENV === 'development' || Env.NODE_ENV === 'test';
}

/**
 * Returns true when Vercel Blob credentials are available at runtime.
 */
export function canUseVercelBlobStorage() {
  if (getBlobReadWriteToken() || getBlobStoreId()) {
    return true;
  }

  return Boolean(process.env.VERCEL_OIDC_TOKEN && isVercelRuntime());
}

function blobAccessMismatchMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (!/private store|public access on a private store/iu.test(message)) {
    return null;
  }

  return (
    'O projeto ainda usa o Blob Private. Na Vercel: desconecte o store Private do projeto, ' +
    'conecte o store Public, confira BLOB_STORE_ID do store Public e faça redeploy.'
  );
}

function shouldUseExplicitBlobToken(storeId: string | undefined) {
  const token = getBlobReadWriteToken();
  if (!token) {
    return false;
  }

  if (isVercelRuntime() && storeId) {
    return false;
  }

  return true;
}

async function uploadToVercelBlob(pathname: string, buffer: Buffer, contentType: string) {
  const access = Env.BLOB_ACCESS;

  if (access === 'private') {
    throw new Error(
      'BLOB_ACCESS=private não serve fotos públicas do site. Crie um Blob Public na Vercel e deixe BLOB_ACCESS=public.',
    );
  }

  const storeId = getBlobStoreId();
  const options: {
    access: 'public' | 'private';
    contentType: string;
    storeId?: string;
    token?: string;
  } = {
    access,
    contentType,
  };

  if (storeId) {
    options.storeId = storeId;
  }

  if (shouldUseExplicitBlobToken(storeId)) {
    options.token = getBlobReadWriteToken();
  }

  try {
    const blob = await put(pathname, buffer, options);
    return blob.url;
  } catch (error) {
    const friendly = blobAccessMismatchMessage(error);
    if (friendly) {
      throw new Error(friendly);
    }
    throw error;
  }
}

/**
 * Uploads a buffer to Vercel Blob (or throws when misconfigured).
 */
export async function uploadAdminBlobBuffer(pathname: string, buffer: Buffer, contentType: string) {
  return uploadToVercelBlob(pathname, buffer, contentType);
}

/**
 * Stores an admin upload and returns its public URL.
 */
export async function storeAdminImage(file: File, options: StoreAdminImageOptions) {
  const validation = validateAdminImageFile(file);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = extensionForMime(validation.mime);
  const prefix = options.slug?.trim() ? slugifySafe(options.slug.trim()) : 'rascunho';
  const filename = `${prefix}-${Date.now()}.${ext}`;
  const pathname = `${options.folder}/${filename}`;

  if (canUseVercelBlobStorage() || isVercelRuntime()) {
    return uploadToVercelBlob(pathname, buffer, validation.mime);
  }

  if (!canPersistAdminImagesLocally()) {
    throw new Error(
      'Armazenamento de imagens não configurado. Conecte o Blob Public ao projeto e confira BLOB_STORE_ID em Production.',
    );
  }

  const localFolder = options.folder === 'blog' ? 'blog' : 'equipamentos';
  const uploadsDir = path.join(process.cwd(), 'public', localFolder, 'uploads');
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(path.join(uploadsDir, filename), buffer);
  return `/${localFolder}/uploads/${filename}`;
}

/**
 * Stores a Claude-generated SVG illustration for a blog article.
 * @param svg Sanitized SVG markup.
 * @param options Article slug used in the filename.
 * @returns Public URL of the stored SVG.
 */
export async function storeAdminSvgMarkup(svg: string, options: { slug: string }) {
  const buffer = Buffer.from(svg, 'utf8');
  if (buffer.byteLength > MAX_BYTES) {
    throw new Error('Arquivo muito grande. Máximo 5 MB.');
  }

  const prefix = options.slug.trim() ? slugifySafe(options.slug.trim()) : 'rascunho';
  const filename = `${prefix}-${Date.now()}.svg`;
  const pathname = `blog/${filename}`;

  if (canUseVercelBlobStorage() || isVercelRuntime()) {
    return uploadToVercelBlob(pathname, buffer, 'image/svg+xml');
  }

  if (!canPersistAdminImagesLocally()) {
    throw new Error(
      'Armazenamento de imagens não configurado. Conecte o Blob Public ao projeto e confira BLOB_STORE_ID em Production.',
    );
  }

  const uploadsDir = path.join(process.cwd(), 'public', 'blog', 'uploads');
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(path.join(uploadsDir, filename), buffer);
  return `/blog/uploads/${filename}`;
}
