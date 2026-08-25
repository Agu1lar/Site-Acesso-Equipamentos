import Image from 'next/image';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ConversionCtas } from '@/components/marketing/ConversionCtas';
import { FaqAccordion } from '@/components/marketing/FaqAccordion';
import { SetMobileDockConfig } from '@/components/marketing/mobile-dock-config';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  ALL_REGIAO_SLUGS,
  focusLabel,
  getNearbyRegioes,
  getRegiaoBySlug,
  isRegiaoSlug,
} from '@/data/regioes';
import { buildWhatsAppMessage, buildWhatsAppUrl } from '@/lib/brand';
import { buildRegiaoPageJsonLd } from '@/lib/regioes-json-ld';
import { buildMarketingMetadata } from '@/lib/seo-metadata';
import { Link } from '@/libs/I18nNavigation';
import { routing } from '@/libs/I18nRouting';
import { CATEGORY_LABELS } from '@/types/equipment';
import { resolveAppLocale } from '@/utils/locale';

type RegiaoPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

/** @see MARKETING_ISR_REVALIDATE_SECONDS in @/lib/isr-revalidate */
export const revalidate = 86_400;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    ALL_REGIAO_SLUGS.map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata(props: RegiaoPageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const regiao = getRegiaoBySlug(slug);
  if (!regiao) {
    return { title: 'Região' };
  }
  return buildMarketingMetadata({
    title: regiao.metaTitle,
    description: regiao.metaDescription,
    path: `/regioes/${regiao.slug}`,
  });
}

export default async function RegiaoDetailPage(props: RegiaoPageProps) {
  const { locale, slug } = await props.params;
  setRequestLocale(resolveAppLocale(locale));

  if (!isRegiaoSlug(slug)) {
    notFound();
  }

  const regiao = getRegiaoBySlug(slug);
  if (!regiao) {
    notFound();
  }

  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'RegiaoDetail',
  });
  const nearby = getNearbyRegioes(regiao.slug);
  const faqItems = regiao.faqs.map((item, index) => ({
    id: `${regiao.slug}-faq-${index}`,
    question: item.question,
    answer: item.answer,
  }));
  const whatsappHref = buildWhatsAppUrl(
    buildWhatsAppMessage({
      origin: 'site-regiao',
      topic: `locação de equipamentos em ${regiao.name}`,
    }),
  );

  return (
    <>
      <JsonLd data={buildRegiaoPageJsonLd(regiao)} />

      <section className="relative min-h-[70vh] overflow-hidden bg-neutral-950 text-white lg:min-h-[78vh]">
        <div className="absolute inset-0">
          <Image
            alt={regiao.heroAlt}
            className="object-cover"
            fill
            priority
            sizes="100vw"
            src={regiao.heroImage}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/70 via-neutral-950/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/55 via-transparent to-neutral-950/20" />
        </div>

        <div className="relative mx-auto flex min-h-[70vh] max-w-7xl flex-col justify-end px-4 pb-12 pt-24 sm:px-6 sm:pb-16 lg:min-h-[78vh] lg:px-8 lg:pb-20">
          <nav aria-label="Breadcrumb" className="text-xs text-neutral-300 sm:text-sm">
            <ol className="flex flex-wrap items-center gap-1">
              <li>
                <Link className="hover:text-white" href="/">
                  {t('breadcrumb_home')}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link className="hover:text-white" href="/regioes">
                  {t('breadcrumb_regioes')}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="font-medium text-white">{regiao.name}</li>
            </ol>
          </nav>

          <p className="mt-6 text-xs font-semibold tracking-[0.18em] text-primary uppercase">
            {focusLabel(regiao.focus)} · {t('hero_eyebrow')}
          </p>
          <h1 className="mt-3 max-w-3xl font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            {regiao.h1}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-neutral-200 sm:text-lg">
            {regiao.tagline}
          </p>
          <ConversionCtas
            className="mt-8"
            onDark
            quoteLabel={t('cta_quote')}
            size="md"
            whatsappHref={whatsappHref}
            whatsappLabel={t('cta_whatsapp')}
            whatsappOrigin="site-regiao"
          />
          <div aria-hidden className="h-0" id="regiao-hero-sentinel" />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-14">
          <div>
            <h2 className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
              {t('intro_title', { city: regiao.name })}
            </h2>
            <div className="mt-5 space-y-4 text-base leading-relaxed text-neutral-600">
              {regiao.intro.map((paragraph) => (
                <p key={paragraph.slice(0, 48)}>{paragraph}</p>
              ))}
            </div>
          </div>

          <aside className="rounded-[var(--radius-card)] border border-primary/15 bg-primary/[0.04] p-6 sm:p-7">
            <h2 className="font-heading text-lg font-bold text-neutral-900">
              {t('highlights_title')}
            </h2>
            <ul className="mt-4 space-y-3">
              {regiao.highlights.map((item) => (
                <li className="flex gap-3 text-sm leading-relaxed text-neutral-700" key={item}>
                  <span
                    aria-hidden
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </section>

      <section className="border-y border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <h2 className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
            {t('categories_title', { city: regiao.name })}
          </h2>
          <p className="mt-3 max-w-2xl text-neutral-600">{t('categories_subtitle')}</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {regiao.featuredCategorySlugs.map((categorySlug) => (
              <li key={categorySlug}>
                <Link
                  className="group flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-neutral-200 bg-white px-5 py-4 transition hover:border-primary/35 hover:shadow-sm"
                  href={`/categorias/${categorySlug}`}
                >
                  <span className="font-heading text-base font-semibold text-neutral-900 group-hover:text-primary">
                    {CATEGORY_LABELS[categorySlug]}
                  </span>
                  <span aria-hidden className="text-primary">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {nearby.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <h2 className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
            {t('nearby_title')}
          </h2>
          <p className="mt-3 max-w-2xl text-neutral-600">{t('nearby_subtitle')}</p>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {nearby.map((item) => (
              <li key={item.slug}>
                <Link
                  className="group block overflow-hidden rounded-[var(--radius-card)] border border-neutral-200 bg-white shadow-sm transition hover:border-primary/30 hover:shadow-md"
                  href={`/regioes/${item.slug}`}
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-neutral-100">
                    <Image
                      alt={item.heroAlt}
                      className="object-cover transition duration-500 group-hover:scale-[1.03]"
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      src={item.heroImage}
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-heading text-lg font-bold text-neutral-900 group-hover:text-primary">
                      {item.name}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{item.tagline}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="border-t border-neutral-200 bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <h2 className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
            {t('faq_title', { city: regiao.name })}
          </h2>
          <div className="mt-8">
            <FaqAccordion items={faqItems} />
          </div>
        </div>
      </section>

      <section className="border-t border-primary/15 bg-primary/[0.04]">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 sm:py-16 lg:px-8">
          <h2 className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
            {t('cta_block_title', { city: regiao.name })}
          </h2>
          <p className="mt-3 text-neutral-600">{t('cta_block_subtitle')}</p>
          <ConversionCtas
            className="mt-8 justify-center"
            quoteLabel={t('cta_quote')}
            size="md"
            whatsappHref={whatsappHref}
            whatsappLabel={t('cta_whatsapp')}
            whatsappOrigin="site-regiao-cta"
          />
        </div>
      </section>

      <SetMobileDockConfig
        quoteLabel={t('cta_quote')}
        sentinelId="regiao-hero-sentinel"
        whatsappHref={whatsappHref}
        whatsappLabel={t('cta_whatsapp')}
        whatsappOrigin="site-regiao-sticky"
      />
    </>
  );
}
