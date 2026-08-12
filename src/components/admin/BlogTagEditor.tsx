'use client';

import type { JSONContent } from '@tiptap/core';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BlogImagePanel } from '@/components/admin/BlogImagePanel';
import { uploadAdminBlogMedia } from '@/lib/admin-image-upload-client';
import { renderBlogContentHtml } from '@/lib/blog-tiptap';
import {
  blogTagStateToTiptapDoc,
  createBlogEditorImage,
  initBlogTagStateFromTiptap,
  insertTagPairAtSelection,
  insertTextAtSelection,
  parseBlogTagMarkup,
  removeImageFromMarkup,
  type BlogTagEditorState,
} from '@/lib/blog-tag-markup';

type BlogTagEditorProps = {
  content: JSONContent;
  onChange: (content: JSONContent) => void;
  uploadSlug: string;
};

function ToolbarButton(props: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={props.label}
      aria-pressed={props.active}
      className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        props.active
          ? 'bg-neutral-900 text-white border-neutral-900'
          : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100'
      }`}
      disabled={props.disabled}
      onClick={props.onClick}
      title={props.label}
      type="button"
    >
      {props.label}
    </button>
  );
}

function BlogTagPreview(props: { doc: JSONContent }) {
  const html = useMemo(() => renderBlogContentHtml(props.doc), [props.doc]);

  return (
    <div
      className="prose prose-neutral max-w-none min-h-[200px] rounded-lg border border-neutral-200 bg-white p-4 prose-headings:font-heading prose-headings:text-neutral-900 prose-p:text-neutral-700 prose-a:text-primary prose-img:rounded-lg [&_a[data-cta-button]]:no-underline [&_div[data-video-embed]]:my-6"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Tag-based blog editor with image registry, ordering and live site preview.
 */
export function BlogTagEditor(props: BlogTagEditorProps) {
  const t = useTranslations('BlogArticleForm');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectionSnapshotRef = useRef({ start: 0, end: 0 });
  const [tagState, setTagState] = useState<BlogTagEditorState>(() => initBlogTagStateFromTiptap(props.content));
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [showCtaDialog, setShowCtaDialog] = useState(false);

  const previewDoc = useMemo(
    () => parseBlogTagMarkup(tagState.markup, tagState.images),
    [tagState.markup, tagState.images],
  );

  useEffect(() => {
    props.onChange(blogTagStateToTiptapDoc(tagState));
  }, [tagState]);

  const updateMarkup = (updater: (current: BlogTagEditorState) => BlogTagEditorState) => {
    setTagState((current) => updater(current));
  };

  const focusTextarea = () => {
    textareaRef.current?.focus();
  };

  const syncTextareaSelection = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    selectionSnapshotRef.current = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };
  };

  const getTextareaSelection = () => {
    const textarea = textareaRef.current;
    if (textarea && document.activeElement === textarea) {
      return { start: textarea.selectionStart, end: textarea.selectionEnd };
    }
    return selectionSnapshotRef.current;
  };

  const applyTextareaChange = (
    nextValue: string,
    selectionStart: number,
    selectionEnd: number,
    images = tagState.images,
  ) => {
    setTagState({ markup: nextValue, images });
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) {
        return;
      }
      textarea.selectionStart = selectionStart;
      textarea.selectionEnd = selectionEnd;
    });
  };

  const insertTagPair = (openTag: string, closeTag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    const { value, selectionStart, selectionEnd } = insertTagPairAtSelection(
      tagState.markup,
      textarea.selectionStart,
      textarea.selectionEnd,
      openTag,
      closeTag,
    );
    applyTextareaChange(value, selectionStart, selectionEnd);
  };

  const insertBlockTag = (openTag: string, closeTag: string, placeholder = '') => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    const prefix = tagState.markup.trim() ? '\n\n' : '';
    const block = `${prefix}${openTag}${placeholder}${closeTag}`;
    const { value, selectionStart } = insertTextAtSelection(
      tagState.markup,
      textarea.selectionStart,
      textarea.selectionEnd,
      block,
    );
    const cursor = selectionStart + prefix.length + openTag.length;
    applyTextareaChange(value, cursor, cursor + placeholder.length);
  };

  const insertListBlock = (tag: 'lista' | 'lista-numerada') => {
    const sample = tag === 'lista' ? '- Primeiro item\n- Segundo item' : '1. Primeiro item\n2. Segundo item';
    insertBlockTag(`[${tag}]\n`, `\n[/${tag}]`, sample);
  };

  const insertImageTagAtCursor = (imageNumber: number) => {
    const tag = `[img${imageNumber}]`;
    const { start, end } = getTextareaSelection();
    const before = tagState.markup.slice(0, start);
    const prefix =
      start > 0 && !before.endsWith('\n\n') && !before.endsWith('\n') ? '\n\n' : before.endsWith('\n') && !before.endsWith('\n\n') ? '\n' : '';
    const { value, selectionEnd: nextEnd } = insertTextAtSelection(tagState.markup, start, end, `${prefix}${tag}`);
    applyTextareaChange(value, nextEnd, nextEnd);
    focusTextarea();
  };

  const insertImageTag = async (file: File) => {
    setUploadingMedia(true);
    setUploadError(null);

    try {
      const { url } = await uploadAdminBlogMedia({
        file,
        endpoint: '/api/admin/blog/upload',
        slug: props.uploadSlug || 'rascunho',
      });
      const nextImage = createBlogEditorImage(url);
      const nextImages = [...tagState.images, nextImage];
      const imageNumber = nextImages.length;
      const tag = `[img${imageNumber}]`;
      const textarea = textareaRef.current;
      const start = textarea?.selectionStart ?? tagState.markup.length;
      const end = textarea?.selectionEnd ?? start;
      const before = tagState.markup.slice(0, start);
      const prefix =
        start > 0 && !before.endsWith('\n\n') && !before.endsWith('\n') ? '\n\n' : before.endsWith('\n') && !before.endsWith('\n\n') ? '\n' : '';
      const { value, selectionEnd: nextEnd } = insertTextAtSelection(
        tagState.markup,
        start,
        end,
        `${prefix}${tag}`,
      );
      applyTextareaChange(value, nextEnd, nextEnd, nextImages);
      focusTextarea();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t('upload_error_generic'));
    } finally {
      setUploadingMedia(false);
    }
  };

  const moveImage = (imageId: string, direction: 'up' | 'down') => {
    updateMarkup((current) => {
      const index = current.images.findIndex((image) => image.id === imageId);
      if (index === -1) {
        return current;
      }
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= current.images.length) {
        return current;
      }
      const nextImages = [...current.images];
      const [item] = nextImages.splice(index, 1);
      nextImages.splice(target, 0, item!);
      return {
        images: nextImages,
        markup: current.markup,
      };
    });
  };

  const removeImage = (imageId: string) => {
    updateMarkup((current) => {
      const index = current.images.findIndex((image) => image.id === imageId);
      if (index === -1) {
        return current;
      }
      const imageNumber = index + 1;
      let markup = removeImageFromMarkup(current.markup, imageNumber);
      const nextImages = current.images.filter((image) => image.id !== imageId);

      for (let number = imageNumber + 1; number <= current.images.length; number += 1) {
        markup = markup.replace(new RegExp(`\\[img${number}\\]`, 'gi'), `[img#${number - 1}#]`);
      }
      markup = markup.replace(/\[img#(\d+)#\]/gi, '[img$1]');

      return {
        images: nextImages,
        markup,
      };
    });
  };

  const insertVideoBlock = (url: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    const block = `\n\n[video url="${url}"]`;
    const { value, selectionEnd } = insertTextAtSelection(
      tagState.markup,
      textarea.selectionStart,
      textarea.selectionEnd,
      block,
    );
    applyTextareaChange(value, selectionEnd, selectionEnd);
  };

  const insertCtaBlock = (label: string, href: string, extras: string[]) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    const attrs = extras.length ? ` url="${href}" ${extras.join(' ')}` : ` url="${href}"`;
    const block = `\n\n[botao${attrs}]${label}[/botao]`;
    const { value, selectionEnd } = insertTextAtSelection(
      tagState.markup,
      textarea.selectionStart,
      textarea.selectionEnd,
      block,
    );
    applyTextareaChange(value, selectionEnd, selectionEnd);
    setShowCtaDialog(false);
  };

  const applyLinkToSelection = (href: string, kind: 'redirect' | 'download' | 'new_tab') => {
    const textarea = textareaRef.current;
    if (!textarea || textarea.selectionStart === textarea.selectionEnd) {
      setUploadError(t('link_select_text_first'));
      return;
    }
    const extras = kind === 'download' ? ' download' : kind === 'new_tab' ? ' nova-aba' : '';
    insertTagPair(`[link url="${href}"${extras}]`, '[/link]');
    setShowLinkDialog(false);
  };

  return (
    <div className="space-y-4">
      <details className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-neutral-700">
        <summary className="cursor-pointer font-medium text-neutral-900">{t('editor_help_title')}</summary>
        <div className="mt-3 space-y-3 text-neutral-700">
          <p>{t('tag_editor_help_intro')}</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>{t('tag_editor_help_tags')}</li>
            <li>{t('tag_editor_help_images')}</li>
            <li>{t('tag_editor_help_preview')}</li>
          </ul>
        </div>
      </details>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="flex flex-wrap gap-1 border-b border-neutral-200 bg-neutral-50 p-2">
          <ToolbarButton label="H2" onClick={() => insertBlockTag('[h2]', '[/h2]', 'Título da seção')} />
          <ToolbarButton label="H3" onClick={() => insertBlockTag('[h3]', '[/h3]', 'Subtítulo')} />
          <ToolbarButton label={t('toolbar_bold')} onClick={() => insertTagPair('[negrito]', '[/negrito]')} />
          <ToolbarButton label={t('toolbar_italic')} onClick={() => insertTagPair('[italico]', '[/italico]')} />
          <ToolbarButton label={t('toolbar_bullet_list')} onClick={() => insertListBlock('lista')} />
          <ToolbarButton label={t('toolbar_ordered_list')} onClick={() => insertListBlock('lista-numerada')} />
          <ToolbarButton label={t('toolbar_quote')} onClick={() => insertTagPair('[citacao]', '[/citacao]')} />
          <ToolbarButton
            label={t('toolbar_link')}
            onClick={() => {
              const textarea = textareaRef.current;
              if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
                setShowLinkDialog(true);
                setUploadError(null);
              } else {
                setUploadError(t('link_select_text_first'));
              }
            }}
          />
          <ToolbarButton
            disabled={uploadingMedia}
            label={uploadingMedia ? t('cover_uploading') : t('toolbar_image')}
            onClick={() => {
              if (!uploadingMedia) {
                fileInputRef.current?.click();
              }
            }}
          />
          <ToolbarButton label={t('toolbar_video')} onClick={() => setShowVideoDialog(true)} />
          <ToolbarButton label={t('toolbar_cta')} onClick={() => setShowCtaDialog(true)} />
        </div>

        {uploadError ? (
          <p className="border-t border-neutral-200 px-4 py-2 text-sm text-red-600">{uploadError}</p>
        ) : null}

        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-800" htmlFor="blog-tag-markup">
              {t('tag_editor_markup_label')}
            </label>
            <textarea
              className="min-h-[320px] w-full resize-y rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3 font-mono text-sm leading-relaxed text-neutral-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              id="blog-tag-markup"
              onBlur={syncTextareaSelection}
              onChange={(event) => {
                setTagState((current) => ({ ...current, markup: event.target.value }));
              }}
              onClick={syncTextareaSelection}
              onKeyUp={syncTextareaSelection}
              onSelect={syncTextareaSelection}
              placeholder={t('tag_editor_placeholder')}
              ref={textareaRef}
              spellCheck
              value={tagState.markup}
            />
            <p className="text-xs text-neutral-500">{t('tag_editor_markup_hint')}</p>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-neutral-900">{t('tag_images_title')}</h3>
              <p className="mb-3 text-xs text-neutral-600">{t('tag_images_hint')}</p>
              <BlogImagePanel
                images={tagState.images}
                onAddFiles={(files) => {
                  const file = [...files][0];
                  if (file) {
                    void insertImageTag(file);
                  }
                }}
                onAltChange={(imageId, alt) => {
                  updateMarkup((current) => ({
                    ...current,
                    images: current.images.map((image) =>
                      image.id === imageId ? { ...image, alt } : image,
                    ),
                  }));
                }}
                onInsertTag={(_imageId, imageNumber) => insertImageTagAtCursor(imageNumber)}
                onMove={moveImage}
                onRemove={removeImage}
                uploading={uploadingMedia}
              />
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-neutral-900">{t('tag_preview_title')}</h3>
              <p className="mb-3 text-xs text-neutral-600">{t('tag_preview_hint')}</p>
              <BlogTagPreview doc={previewDoc} />
            </div>
          </div>
        </div>

        <input
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void insertImageTag(file);
            }
            event.target.value = '';
          }}
          ref={fileInputRef}
          type="file"
        />
      </div>

      {showLinkDialog ? (
        <BlogLinkTagDialog
          onApply={applyLinkToSelection}
          onClose={() => setShowLinkDialog(false)}
        />
      ) : null}

      {showVideoDialog ? (
        <BlogVideoTagDialog
          onClose={() => setShowVideoDialog(false)}
          onInsert={insertVideoBlock}
          onUploadFile={async (file) => {
            setUploadingMedia(true);
            try {
              const { url } = await uploadAdminBlogMedia({
                file,
                endpoint: '/api/admin/blog/upload',
                slug: props.uploadSlug || 'rascunho',
              });
              insertVideoBlock(url);
              setShowVideoDialog(false);
            } catch (error) {
              setUploadError(error instanceof Error ? error.message : t('upload_error_generic'));
            } finally {
              setUploadingMedia(false);
            }
          }}
          uploading={uploadingMedia}
        />
      ) : null}

      {showCtaDialog ? (
        <BlogCtaTagDialog
          onClose={() => setShowCtaDialog(false)}
          onInsert={insertCtaBlock}
        />
      ) : null}
    </div>
  );
}

function BlogLinkTagDialog(props: {
  onClose: () => void;
  onApply: (href: string, kind: 'redirect' | 'download' | 'new_tab') => void;
}) {
  const t = useTranslations('BlogArticleForm');
  const [href, setHref] = useState('/orcamento');
  const [kind, setKind] = useState<'redirect' | 'download' | 'new_tab'>('redirect');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-lg">
        <h3 className="font-heading text-base font-semibold text-neutral-900">{t('link_dialog_title')}</h3>
        <p className="mt-1 text-sm text-neutral-600">{t('link_dialog_hint')}</p>
        <input
          className="mt-4 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          onChange={(event) => setHref(event.target.value)}
          value={href}
        />
        <div className="mt-3 space-y-2 text-sm text-neutral-700">
          <label className="flex items-center gap-2">
            <input checked={kind === 'redirect'} name="link-kind" onChange={() => setKind('redirect')} type="radio" />
            {t('link_kind_redirect')}
          </label>
          <label className="flex items-center gap-2">
            <input checked={kind === 'new_tab'} name="link-kind" onChange={() => setKind('new_tab')} type="radio" />
            {t('link_kind_new_tab')}
          </label>
          <label className="flex items-center gap-2">
            <input checked={kind === 'download'} name="link-kind" onChange={() => setKind('download')} type="radio" />
            {t('link_kind_download')}
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-lg border border-neutral-200 px-3 py-2 text-sm" onClick={props.onClose} type="button">
            {t('link_dialog_cancel')}
          </button>
          <button
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
            onClick={() => props.onApply(href, kind)}
            type="button"
          >
            {t('link_dialog_apply')}
          </button>
        </div>
      </div>
    </div>
  );
}

function BlogVideoTagDialog(props: {
  onClose: () => void;
  onInsert: (url: string) => void;
  onUploadFile: (file: File) => Promise<void>;
  uploading: boolean;
}) {
  const t = useTranslations('BlogArticleForm');
  const [url, setUrl] = useState('https://www.youtube.com/watch?v=');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-lg">
        <h3 className="font-heading text-base font-semibold text-neutral-900">{t('video_dialog_title')}</h3>
        <p className="mt-1 text-sm text-neutral-600">{t('video_dialog_hint')}</p>
        <input
          className="mt-4 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          onChange={(event) => setUrl(event.target.value)}
          value={url}
        />
        <p className="mt-4 text-sm font-medium text-neutral-700">{t('video_dialog_or_upload')}</p>
        <input
          accept="video/mp4,video/webm,.mp4,.webm"
          className="mt-2 block w-full text-sm"
          disabled={props.uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void props.onUploadFile(file);
            }
            event.target.value = '';
          }}
          type="file"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-lg border border-neutral-200 px-3 py-2 text-sm" onClick={props.onClose} type="button">
            {t('link_dialog_cancel')}
          </button>
          <button
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
            disabled={props.uploading}
            onClick={() => {
              props.onInsert(url);
              props.onClose();
            }}
            type="button"
          >
            {t('video_dialog_insert')}
          </button>
        </div>
      </div>
    </div>
  );
}

function BlogCtaTagDialog(props: {
  onClose: () => void;
  onInsert: (label: string, href: string, extras: string[]) => void;
}) {
  const t = useTranslations('BlogArticleForm');
  const [label, setLabel] = useState(t('cta_default_label'));
  const [href, setHref] = useState('/orcamento');
  const [openNewTab, setOpenNewTab] = useState(false);
  const [asDownload, setAsDownload] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
      <div className="w-full max-w-md rounded-xl border border-neutral-200 bg-white p-5 shadow-lg">
        <h3 className="font-heading text-base font-semibold text-neutral-900">{t('cta_dialog_title')}</h3>
        <input className="mt-4 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" onChange={(e) => setLabel(e.target.value)} value={label} />
        <input className="mt-3 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" onChange={(e) => setHref(e.target.value)} value={href} />
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input checked={openNewTab} onChange={(e) => setOpenNewTab(e.target.checked)} type="checkbox" />
          {t('cta_dialog_new_tab')}
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input checked={asDownload} onChange={(e) => setAsDownload(e.target.checked)} type="checkbox" />
          {t('cta_dialog_download')}
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-lg border border-neutral-200 px-3 py-2 text-sm" onClick={props.onClose} type="button">
            {t('link_dialog_cancel')}
          </button>
          <button
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
            onClick={() => {
              const extras: string[] = [];
              if (asDownload) {
                extras.push('download');
              }
              if (openNewTab) {
                extras.push('nova-aba');
              }
              props.onInsert(label.trim(), href.trim(), extras);
            }}
            type="button"
          >
            {t('cta_dialog_insert')}
          </button>
        </div>
      </div>
    </div>
  );
}
