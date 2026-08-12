import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, permanentRedirect } from 'next/navigation';
import { BlogArticleBody } from '@/components/marketing/BlogArticleBody';
import { ConversionCtas } from '@/components/marketing/ConversionCtas';
import { JsonLd } from '@/components/seo/JsonLd';
import { getBlogArticleBySlug } from '@/lib/blog-articles';
import { isBlogVectorImage } from '@/lib/blog-ai-svg';
import { getBlogSlugRedirectTarget } from '@/lib/blog-slug-redirects';
import { buildWhatsAppMessage, buildWhatsAppUrl } from '@/lib/brand';
import { buildDicaArticleJsonLd } from '@/lib/json-ld';
import { buildMarketingMetadata } from '@/lib/seo-metadata';
import { Link } from '@/libs/I18nNavigation';
import { resolveAppLocale } from '@/utils/locale';

type DicaArticlePageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

/** Always read publish status from the database (admin unpublish must take effect immediately). */
export const dynamic = 'force-dynamic';

export async function generateMetadata(props: DicaArticlePageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const article = await getBlogArticleBySlug(slug);
  if (!article) {
    const redirectSlug = await getBlogSlugRedirectTarget(slug);
    if (redirectSlug) {
      permanentRedirect(`/dicas/${redirectSlug}`);
    }
    return { title: 'Blog' };
  }
  return buildMarketingMetadata({
    title: article.metaTitle,
    description: article.metaDescription,
    path: `/dicas/${article.slug}`,
    ogPath: article.coverImageUrl?.startsWith('/') ? article.coverImageUrl : undefined,
  });
}

function formatPublishedDate(isoDate: string) {
  if (!isoDate) {
    return null;
  }
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parsed);
}

export default async function DicaArticlePage(props: DicaArticlePageProps) {
  const { locale, slug } = await props.params;
  setRequestLocale(resolveAppLocale(locale));
  const article = await getBlogArticleBySlug(slug);

  if (!article) {
    const redirectSlug = await getBlogSlugRedirectTarget(slug);
    if (redirectSlug) {
      permanentRedirect(`/dicas/${redirectSlug}`);
    }
    notFound();
  }

  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'DicasPage',
  });
  const whatsappHref = buildWhatsAppUrl(
    buildWhatsAppMessage({
      equipmentName: article.title,
      origin: 'site-dica',
    }),
  );
  const publishedLabel = formatPublishedDate(article.publishedAt);

  return (
    <>
      <JsonLd data={buildDicaArticleJsonLd(article)} />
      <article>
        <div className="border-b border-neutral-200 bg-[linear-gradient(180deg,#f8f7f5_0%,#ffffff_100%)]">
          <div className="mx-auto max-w-3xl px-4 pt-8 pb-10 sm:px-6 lg:px-8">
            <nav aria-label="Breadcrumb" className="text-sm text-neutral-600">
              <ol className="flex flex-wrap items-center gap-1">
                <li>
                  <Link className="hover:text-primary" href="/">
                    {t('breadcrumb_home')}
                  </Link>
                </li>
                <li aria-hidden>/</li>
                <li>
                  <Link className="hover:text-primary" href="/dicas">
                    {t('breadcrumb_dicas')}
                  </Link>
                </li>
              </ol>
            </nav>

            <header className="mt-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium tracking-wide text-neutral-500 uppercase">
                <span>{t('reading_time', { minutes: article.readingMinutes })}</span>
                {publishedLabel ? (
                  <>
                    <span aria-hidden className="text-neutral-300">
                      ·
                    </span>
                    <time dateTime={article.publishedAt}>{publishedLabel}</time>
                  </>
                ) : null}
              </div>
              <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl sm:leading-tight">
                {article.title}
              </h1>
              {article.excerpt ? (
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-neutral-600">
                  {article.excerpt}
                </p>
              ) : null}
            </header>
          </div>
        </div>

        {article.coverImageUrl ? (
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <figure className="-mt-2 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 shadow-sm">
              <div className="relative flex min-h-[14rem] w-full items-center justify-center bg-neutral-100 sm:min-h-[18rem]">
                <Image
                  alt={article.title}
                  className="h-auto max-h-[28rem] w-full object-contain"
                  height={900}
                  priority
                  sizes="(max-width: 1024px) 100vw, 1024px"
                  src={article.coverImageUrl}
                  unoptimized={isBlogVectorImage(article.coverImageUrl)}
                  width={1600}
                />
              </div>
            </figure>
          </div>
        ) : null}

        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
          <BlogArticleBody content={article.content} />

          {article.relatedLinks.length > 0 ? (
            <aside className="mt-14 rounded-2xl border border-neutral-200 bg-neutral-50 p-6 sm:p-8">
              <h2 className="font-heading text-lg font-semibold text-neutral-900">
                {t('related_title')}
              </h2>
              <ul className="mt-4 space-y-3 text-sm">
                {article.relatedLinks.map((link) => (
                  <li key={link.href}>
                    <Link className="font-medium text-primary hover:underline" href={link.href}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}

          <div className="mt-12 border-t border-neutral-200 pt-10">
            <ConversionCtas
              equipmentName={article.title}
              quoteLabel={t('cta_quote')}
              size="sm"
              whatsappHref={whatsappHref}
              whatsappLabel={t('cta_whatsapp')}
              whatsappOrigin="site-dica"
            />
          </div>

          <p className="mt-8">
            <Link className="text-sm font-semibold text-primary hover:underline" href="/dicas">
              ← {t('back_to_list')}
            </Link>
          </p>
        </div>
      </article>
    </>
  );
}
