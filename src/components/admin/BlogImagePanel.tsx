'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { BlogEditorImage } from '@/lib/blog-tag-markup';

type BlogImagePanelProps = {
  images: BlogEditorImage[];
  onAddFiles?: (files: FileList | File[]) => void;
  onAltChange: (imageId: string, alt: string) => void;
  onInsertTag: (imageId: string, imageNumber: number) => void;
  onMove: (imageId: string, direction: 'up' | 'down') => void;
  onRemove: (imageId: string) => void;
  uploading?: boolean;
};

export function BlogImagePanel(props: BlogImagePanelProps) {
  const t = useTranslations('BlogArticleForm');

  if (props.images.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (props.onAddFiles && event.dataTransfer.files.length > 0) {
            props.onAddFiles(event.dataTransfer.files);
          }
        }}
      >
        <p className="text-sm text-neutral-600">{t('tag_images_empty')}</p>
        {props.onAddFiles ? (
          <label className="mt-3 inline-flex cursor-pointer rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50">
            {props.uploading ? t('cover_uploading') : t('tag_images_add')}
            <input
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              className="sr-only"
              disabled={props.uploading}
              onChange={(event) => {
                if (event.target.files && event.target.files.length > 0) {
                  props.onAddFiles?.(event.target.files);
                }
                event.target.value = '';
              }}
              type="file"
            />
          </label>
        ) : null}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {props.images.map((image, index) => (
        <li
          className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm"
          key={image.id}
        >
          <div className="flex gap-3">
            <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
              <Image
                alt={image.alt || t('tag_image_number', { number: index + 1 })}
                className="object-contain object-center"
                fill
                sizes="112px"
                src={image.url}
                unoptimized
              />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm font-semibold text-neutral-900">
                {t('tag_image_number', { number: index + 1 })}
                <span className="ml-2 font-mono text-xs font-normal text-primary">[img{index + 1}]</span>
              </p>
              <label className="block text-xs font-medium text-neutral-600" htmlFor={`img-alt-${image.id}`}>
                {t('tag_image_alt')}
              </label>
              <input
                className="w-full rounded-md border border-neutral-200 px-2 py-1.5 text-sm"
                id={`img-alt-${image.id}`}
                onChange={(event) => props.onAltChange(image.id, event.target.value)}
                placeholder={t('tag_image_alt_placeholder')}
                value={image.alt}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                  onClick={() => props.onInsertTag(image.id, index + 1)}
                  onMouseDown={(event) => event.preventDefault()}
                  type="button"
                >
                  {t('tag_image_insert_tag', { number: index + 1 })}
                </button>
                <button
                  className="rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
                  disabled={index === 0}
                  onClick={() => props.onMove(image.id, 'up')}
                  type="button"
                >
                  {t('tag_image_move_up')}
                </button>
                <button
                  className="rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
                  disabled={index === props.images.length - 1}
                  onClick={() => props.onMove(image.id, 'down')}
                  type="button"
                >
                  {t('tag_image_move_down')}
                </button>
                <button
                  className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                  onClick={() => props.onRemove(image.id)}
                  type="button"
                >
                  {t('tag_image_remove')}
                </button>
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
