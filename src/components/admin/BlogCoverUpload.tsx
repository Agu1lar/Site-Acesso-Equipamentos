'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { BlogCatalogImagePicker } from '@/components/admin/BlogCatalogImagePicker';
import { Button } from '@/components/ui/Button';
import { pickImageFiles, uploadAdminImage } from '@/lib/admin-image-upload-client';
import { isBlogVectorImage } from '@/lib/blog-ai-svg';

type BlogCoverUploadProps = {
  coverImageUrl: string;
  highlightEmpty?: boolean;
  onChange: (url: string) => void;
  slug: string;
};

/**
 * Drag, paste or pick a cover image for a blog article.
 * @param props Cover URL, slug and change callback.
 */
export function BlogCoverUpload(props: BlogCoverUploadProps) {
  const t = useTranslations('BlogArticleForm');
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const empty = !props.coverImageUrl;

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

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        return;
      }
      const files = [...(event.clipboardData?.files ?? [])];
      if (files.length === 0) {
        return;
      }
      event.preventDefault();
      void uploadFiles(files);
    };

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [props.slug]);

  return (
    <div className="space-y-4" id="blog-cover">
      {props.coverImageUrl ? (
        <div className="relative h-56 w-full max-w-xl overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
          <Image
            alt=""
            className="object-contain object-center"
            fill
            sizes="576px"
            src={props.coverImageUrl}
            unoptimized={isBlogVectorImage(props.coverImageUrl)}
          />
        </div>
      ) : null}

      <div
        className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          dragOver
            ? 'border-primary bg-primary-light/40'
            : empty && props.highlightEmpty
              ? 'border-primary bg-primary-50/70'
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
        onPaste={(event) => {
          const files = [...event.clipboardData.files];
          if (files.length > 0) {
            event.preventDefault();
            void uploadFiles(files);
          }
        }}
        tabIndex={0}
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
        <p className="font-medium text-neutral-900">
          {empty ? t('cover_empty_title') : t('upload_drop_title')}
        </p>
        <p className="mt-1 text-sm text-neutral-600">{t('cover_empty_hint')}</p>
        <Button
          className="mt-4"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          size="sm"
          type="button"
          variant="primary"
        >
          {uploading ? t('cover_uploading') : t('cover_upload')}
        </Button>
      </div>

      <BlogCatalogImagePicker onSelect={props.onChange} />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {props.coverImageUrl ? (
        <Button onClick={() => props.onChange('')} type="button" variant="secondary">
          {t('cover_remove')}
        </Button>
      ) : null}
    </div>
  );
}
