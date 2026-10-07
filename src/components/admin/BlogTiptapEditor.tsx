'use client';

import type { JSONContent } from '@tiptap/core';
import TiptapPlaceholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { BlogCtaDialog, BlogVideoDialog } from '@/components/admin/BlogContentDialogs';
import { BlogLinkDialog } from '@/components/admin/BlogLinkDialog';
import { uploadAdminBlogMedia } from '@/lib/admin-image-upload-client';
import { createBlogTiptapExtensions } from '@/lib/blog-tiptap-extensions';
import { parseVideoEmbedUrl } from '@/lib/blog-tiptap-video';

type BlogTiptapEditorProps = {
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
      className={`rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        props.active
          ? 'bg-neutral-900 text-white'
          : 'bg-white text-neutral-700 hover:bg-neutral-100'
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

/**
 * Rich text editor for blog articles (TipTap).
 */
export function BlogTiptapEditor(props: BlogTiptapEditorProps) {
  const t = useTranslations('BlogArticleForm');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [showCtaDialog, setShowCtaDialog] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      ...createBlogTiptapExtensions(),
      TiptapPlaceholder.configure({
        placeholder: t('editor_placeholder'),
      }),
    ],
    content: props.content,
    onUpdate: ({ editor: current }) => {
      props.onChange(current.getJSON());
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-neutral max-w-none min-h-[280px] px-4 py-3 focus:outline-none prose-headings:font-heading',
      },
    },
  });

  const insertImage = async (file: File) => {
    if (!editor) {
      return;
    }

    setUploadingMedia(true);
    setUploadError(null);

    try {
      const { url } = await uploadAdminBlogMedia({
        file,
        endpoint: '/api/admin/blog/upload',
        slug: props.uploadSlug || 'rascunho',
      });
      editor.chain().focus().setImage({ src: url }).run();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t('upload_error_generic'));
    } finally {
      setUploadingMedia(false);
    }
  };

  const insertUploadedVideo = async (file: File) => {
    if (!editor) {
      return;
    }

    setUploadingMedia(true);
    setUploadError(null);

    try {
      const { url } = await uploadAdminBlogMedia({
        file,
        endpoint: '/api/admin/blog/upload',
        slug: props.uploadSlug || 'rascunho',
      });
      const parsed = parseVideoEmbedUrl(url);
      if (!parsed) {
        throw new Error(t('video_dialog_invalid'));
      }
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'videoEmbed',
          attrs: {
            embedSrc: parsed.embedSrc,
            provider: parsed.provider,
          },
        })
        .run();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t('upload_error_generic'));
      throw error;
    } finally {
      setUploadingMedia(false);
    }
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="space-y-3">
      <details className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-neutral-700">
        <summary className="cursor-pointer font-medium text-neutral-900">{t('editor_help_title')}</summary>
        <div className="mt-3 space-y-3 text-neutral-700">
          <p>{t('editor_help_intro')}</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>{t('editor_help_text')}</li>
            <li>{t('editor_help_image')}</li>
            <li>{t('editor_help_video')}</li>
            <li>{t('editor_help_link_redirect')}</li>
            <li>{t('editor_help_link_download')}</li>
            <li>{t('editor_help_cta')}</li>
            <li>{t('editor_help_position')}</li>
          </ul>
        </div>
      </details>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="flex flex-wrap gap-1 border-b border-neutral-200 bg-neutral-50 p-2">
          <ToolbarButton
            active={editor.isActive('heading', { level: 2 })}
            label="H2"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          />
          <ToolbarButton
            active={editor.isActive('heading', { level: 3 })}
            label="H3"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          />
          <ToolbarButton
            active={editor.isActive('bold')}
            label={t('toolbar_bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            active={editor.isActive('italic')}
            label={t('toolbar_italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            active={editor.isActive('bulletList')}
            label={t('toolbar_bullet_list')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            active={editor.isActive('orderedList')}
            label={t('toolbar_ordered_list')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <ToolbarButton
            active={editor.isActive('blockquote')}
            label={t('toolbar_quote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          />
          <ToolbarButton
            label={t('toolbar_link')}
            onClick={() => {
              if (!editor.state.selection.empty) {
                setShowLinkDialog(true);
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
          <ToolbarButton
            disabled={uploadingMedia}
            label={t('toolbar_video')}
            onClick={() => setShowVideoDialog(true)}
          />
          <ToolbarButton label={t('toolbar_cta')} onClick={() => setShowCtaDialog(true)} />
          <ToolbarButton
            label={t('toolbar_undo')}
            onClick={() => editor.chain().focus().undo().run()}
          />
          <ToolbarButton
            label={t('toolbar_redo')}
            onClick={() => editor.chain().focus().redo().run()}
          />
        </div>
        {uploadError ? (
          <p className="border-t border-neutral-200 px-4 py-2 text-sm text-red-600">{uploadError}</p>
        ) : null}
        <EditorContent editor={editor} />
        <input
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void insertImage(file);
            }
            event.target.value = '';
          }}
          ref={fileInputRef}
          type="file"
        />
      </div>

      {showLinkDialog ? <BlogLinkDialog editor={editor} onClose={() => setShowLinkDialog(false)} /> : null}
      {showVideoDialog ? (
        <BlogVideoDialog
          editor={editor}
          onClose={() => setShowVideoDialog(false)}
          onUploadFile={insertUploadedVideo}
          uploading={uploadingMedia}
        />
      ) : null}
      {showCtaDialog ? <BlogCtaDialog editor={editor} onClose={() => setShowCtaDialog(false)} /> : null}
    </div>
  );
}
