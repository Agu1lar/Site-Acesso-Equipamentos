import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { JsonLd } from '@/components/seo/JsonLd';
import { listPublishedBlogArticles } from '@/lib/blog-articles';
import { buildDicasIndexJsonLd } from '@/lib/json-ld';
import { buildMarketingMetadata } from '@/lib/seo-metadata';
import type { BlogArticle } from '@/types/blog-article';
import { Link } from '@/libs/I18nNavigation';
import { resolveAppLocale } from '@/utils/locale';

type DicasPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: DicasPageProps): Promise<Metadata> {
  const locale = resolveAppLocale((await props.params)?.locale);
  const t = await getTranslations({
    locale,
    namespace: 'DicasPage',
  });
  return buildMarketingMetadata({
    title: t('meta_title'),
    description: t('meta_description'),
    path: '/dicas',
  });
}

function ArticleCard(props: {
  article: BlogArticle;
  readingLabel: string;
  readMoreLabel: string;
  featuredLabel: string;
  featured?: boolean;
}) {
  const { article, featured } = props;

  if (featured) {
    return (
      <li className="overflow-hidden rounded-2xl border border-neutral-200 bg-surface shadow-sm">
        <Link className="group block lg:grid lg:grid-cols-2" href={`/dicas/${article.slug}`}>
          {article.coverImageUrl ? (
            <div className="relative aspect-[16/10] w-full bg-neutral-100 lg:aspect-auto lg:min-h-[280px]">
              <Image
                alt=""
                className="object-contain object-center transition duration-300 group-hover:scale-[1.02]"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 560px"
                src={article.coverImageUrl}
              />
            </div>
          ) : (
            <div className="min-h-[220px] bg-neutral-100 lg:min-h-[280px]" />
          )}
          <div className="flex flex-col justify-center p-6 sm:p-8">
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">
              {props.featuredLabel}
            </p>
            <p className="mt-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">
              {props.readingLabel}
            </p>
            <h2 className="mt-3 font-heading text-2xl font-bold text-neutral-900 group-hover:text-primary sm:text-3xl">
              {article.title}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-neutral-600">{article.excerpt}</p>
            <span className="mt-6 text-sm font-semibold text-primary">{props.readMoreLabel}</span>
          </div>
        </Link>
      </li>
    );
  }

  return (
    <li className="overflow-hidden rounded-2xl border border-neutral-200 bg-surface shadow-sm transition hover:border-neutral-300 hover:shadow-md">
      <Link className="group block h-full" href={`/dicas/${article.slug}`}>
        {article.coverImageUrl ? (
          <div className="relative aspect-[16/10] w-full bg-neutral-100">
            <Image
              alt=""
              className="object-contain object-center transition duration-300 group-hover:scale-[1.02]"
              fill
              sizes="(max-width: 768px) 100vw, 360px"
              src={article.coverImageUrl}
            />
          </div>
        ) : null}
        <div className="p-5 sm:p-6">
          <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
            {props.readingLabel}
          </p>
          <h2 className="mt-2 font-heading text-xl font-bold text-neutral-900 group-hover:text-primary">
            {article.title}
          </h2>
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-neutral-600">
            {article.excerpt}
          </p>
          <span className="mt-4 inline-block text-sm font-semibold text-primary">
            {props.readMoreLabel}
          </span>
        </div>
      </Link>
    </li>
  );
}

export default async function DicasPage(props: DicasPageProps) {
  const locale = resolveAppLocale((await props.params)?.locale);
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'DicasPage',
  });
  const articles = await listPublishedBlogArticles();
  const [featured, ...rest] = articles;

  return (
    <>
      <JsonLd data={buildDicasIndexJsonLd(articles)} />
      <div className="border-b border-neutral-200 bg-[linear-gradient(180deg,#f8f7f5_0%,#ffffff_72%)]">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">{t('eyebrow')}</p>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            {t('title')}
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-neutral-600">{t('intro')}</p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {articles.length === 0 ? (
          <p className="text-neutral-600">{t('empty')}</p>
        ) : (
          <div className="space-y-8">
            {featured ? (
              <ul>
                <ArticleCard
                  article={featured}
                  featured
                  featuredLabel={t('featured_label')}
                  readMoreLabel={t('read_more')}
                  readingLabel={t('reading_time', { minutes: featured.readingMinutes })}
                />
              </ul>
            ) : null}
            {rest.length > 0 ? (
              <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {rest.map((article) => (
                  <ArticleCard
                    article={article}
                    featuredLabel={t('featured_label')}
                    key={article.slug}
                    readMoreLabel={t('read_more')}
                    readingLabel={t('reading_time', { minutes: article.readingMinutes })}
                  />
                ))}
              </ul>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
