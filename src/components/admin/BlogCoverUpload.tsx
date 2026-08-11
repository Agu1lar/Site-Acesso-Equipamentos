'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { pickImageFiles, uploadAdminImage } from '@/lib/admin-image-upload-client';

type BlogCoverUploadProps = {
  coverImageUrl: string;
  onChange: (url: string) => void;
  slug: string;
};

/**
 * Drag-and-drop cover image upload for blog articles.
 */
export function BlogCoverUpload(props: BlogCoverUploadProps) {
  const t = useTranslations('BlogArticleForm');
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError(null);

    try {
      const { url } = await uploadAdminImage({
        file,
        endpoint: '/api/admin/blog/upload',
        slug: props.slug || 'rascunho',
      });
      props.onChange(url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t('upload_error_generic'));
    } finally {
      setUploading(false);
    }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const list = pickImageFiles(files);
    if (list.length === 0) {
      setError(t('upload_error_format'));
      return;
    }

    await uploadFile(list[0]!);
  };

  return (
    <div className="space-y-4">
      {props.coverImageUrl ? (
        <div className="relative h-48 w-full max-w-md overflow-hidden rounded-lg bg-neutral-100">
          <Image
            alt=""
            className="object-contain object-center"
            fill
            sizes="400px"
            src={props.coverImageUrl}
            unoptimized
          />
        </div>
      ) : null}

      <div
        className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          dragOver
            ? 'border-primary bg-primary-light/40'
            : 'border-neutral-300 bg-neutral-50/80 hover:border-neutral-400'
        }`}
        onDragLeave={() => setDragOver(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (event.dataTransfer.files.length > 0) {
            void uploadFiles(event.dataTransfer.files);
          }
        }}
      >
        <input
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) {
              void uploadFiles(event.target.files);
              event.target.value = '';
            }
          }}
          ref={inputRef}
          type="file"
        />
        <p className="font-medium text-neutral-900">{t('upload_drop_title')}</p>
        <p className="mt-1 text-sm text-neutral-600">{t('upload_drop_hint')}</p>
        <Button
          className="mt-4"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          size="sm"
          type="button"
          variant="outline"
        >
          {uploading ? t('cover_uploading') : t('cover_upload')}
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {props.coverImageUrl ? (
        <Button onClick={() => props.onChange('')} type="button" variant="secondary">
          {t('cover_remove')}
        </Button>
      ) : null}
    </div>
  );
}
