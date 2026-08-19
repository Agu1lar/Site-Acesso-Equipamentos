'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { BlogAiImageSource, GeneratedBlogDraft } from '@/validations/blog-ai';

type BlogAiGeneratorProps = {
  hasExistingContent: boolean;
  onGenerated: (draft: GeneratedBlogDraft) => void;
};

/**
 * Collects an article topic and fills the editor with a Claude-generated draft.
 * @param props Generator state and completion callback.
 * @returns The article generation panel.
 */
export function BlogAiGenerator(props: BlogAiGeneratorProps) {
  const t = useTranslations('BlogArticleForm');
  const [topic, setTopic] = useState('');
  const [useCatalogImages, setUseCatalogImages] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [replaceArmed, setReplaceArmed] = useState(false);
  let buttonLabel = t('ai_generate');
  if (replaceArmed) {
    buttonLabel = t('ai_replace_generate');
  }
  if (pending) {
    buttonLabel = t('ai_generating');
  }

  const generate = async () => {
    if (topic.trim().length < 10) {
      setErrorMessage(t('ai_error_topic'));
      return;
    }
    if (props.hasExistingContent && !replaceArmed) {
      setReplaceArmed(true);
      setErrorMessage(t('ai_replace_confirm'));
      return;
    }

    setPending(true);
    setErrorMessage(null);
    setSuccess(false);

    const imageSource: BlogAiImageSource = useCatalogImages ? 'catalog' : 'none';

    try {
      const response = await fetch('/api/admin/blog/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ topic: topic.trim(), imageSource }),
      });
      const contentType = response.headers.get('content-type') ?? '';
      const payload = contentType.includes('application/json')
        ? ((await response.json()) as { draft?: GeneratedBlogDraft; error?: string })
        : {};
      if (!response.ok || !payload.draft) {
        if (response.status === 401 || payload.error === 'not_authenticated') {
          throw new Error('not_authenticated');
        }
        if (response.status === 504 || payload.error === 'generation_timeout') {
          throw new Error('generation_timeout');
        }
        throw new Error(payload.error || 'generation_failed');
      }

      props.onGenerated(payload.draft);
      setSuccess(true);
    } catch (error) {
      const code = error instanceof Error ? error.message : 'generation_failed';
      if (code === 'anthropic_not_configured') {
        setErrorMessage(t('ai_error_not_configured'));
      } else if (code === 'not_authenticated' || code === 'forbidden') {
        setErrorMessage(t('ai_error_session'));
      } else if (code === 'generation_timeout' || code === 'TimeoutError') {
        setErrorMessage(t('ai_error_timeout'));
      } else if (code === 'anthropic_incomplete_response') {
        setErrorMessage(t('ai_error_incomplete'));
      } else if (code === 'invalid_draft') {
        setErrorMessage(t('ai_error_invalid'));
      } else {
        setErrorMessage(t('ai_error_generic'));
      }
    } finally {
      setPending(false);
      setReplaceArmed(false);
    }
  };

  return (
    <section className="border-primary-200 bg-primary-50/60 rounded-xl border p-5">
      <div className="max-w-3xl">
        <p className="text-primary-700 text-xs font-semibold tracking-wider uppercase">
          {t('ai_eyebrow')}
        </p>
        <h2 className="mt-1 font-heading text-xl font-semibold text-neutral-900">
          {t('ai_title')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">{t('ai_description')}</p>

        <label className="mt-5 block text-sm font-medium text-neutral-800" htmlFor="blog-ai-topic">
          {t('ai_topic_label')}
        </label>
        <textarea
          className="focus:border-primary-500 focus:ring-primary-200 mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-3 text-sm shadow-sm focus:ring-2 focus:outline-none"
          disabled={pending}
          id="blog-ai-topic"
          maxLength={600}
          onChange={(event) => {
            setTopic(event.target.value);
            setErrorMessage(null);
            setSuccess(false);
            setReplaceArmed(false);
          }}
          placeholder={t('ai_topic_placeholder')}
          rows={4}
          value={topic}
        />

        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-neutral-700">
          <input
            checked={useCatalogImages}
            className="mt-1 size-4 rounded border-neutral-300 text-primary focus:ring-primary"
            disabled={pending}
            id="blog-ai-use-catalog"
            onChange={(event) => {
              setUseCatalogImages(event.target.checked);
              setErrorMessage(null);
              setSuccess(false);
            }}
            type="checkbox"
          />
          <span>
            <span className="font-medium text-neutral-900">{t('ai_use_catalog_images')}</span>
            <span className="mt-0.5 block text-neutral-600">{t('ai_use_catalog_images_hint')}</span>
          </span>
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button disabled={pending} onClick={generate} type="button" variant="primary">
            {buttonLabel}
          </Button>
          <p
            aria-live="polite"
            className={`text-sm ${errorMessage ? 'text-amber-800' : 'text-emerald-700'}`}
          >
            {errorMessage ?? (success ? t('ai_success') : t('ai_draft_hint'))}
          </p>
        </div>
      </div>
    </section>
  );
}
