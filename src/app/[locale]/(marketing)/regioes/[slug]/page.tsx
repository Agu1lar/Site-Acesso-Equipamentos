import Image from 'next/image';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CategoryIcon } from '@/components/marketing/CategoryIcon';
import { ConversionCtas } from '@/components/marketing/ConversionCtas';
import { FaqAccordion } from '@/components/marketing/FaqAccordion';
import { SetMobileDockConfig } from '@/components/marketing/mobile-dock-config';
import { RegiaoCityCard } from '@/components/marketing/RegiaoCityCard';
import { SolucaoLinks } from '@/components/marketing/SolucaoLinks';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  ALL_REGIAO_SLUGS,
  focusLabel,
  getNearbyRegioes,
  getRegiaoBySlug,
  isRegiaoSlug,
} from '@/data/regioes';
import { isRegiaoCategoriaCombo } from '@/data/regiao-categoria';
import { getSolucoesForRegiaoFocus } from '@/data/solucoes';
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
  const solucoes = getSolucoesForRegiaoFocus(regiao.focus, 3);
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

      {/* Light breadcrumb bar — Mills-style. */}
      <div className="border-b border-neutral-200 bg-white">
        <nav
          aria-label="Breadcrumb"
          className="mx-auto max-w-7xl px-4 py-3 text-xs text-neutral-600 sm:px-6 sm:text-sm lg:px-8"
        >
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link className="hover:text-primary" href="/">
                {t('breadcrumb_home')}
              </Link>
            </li>
            <li aria-hidden className="text-neutral-300">
              /
            </li>
            <li>
              <Link className="hover:text-primary" href="/regioes">
                {t('breadcrumb_regioes')}
              </Link>
            </li>
            <li aria-hidden className="text-neutral-300">
              /
            </li>
            <li className="font-semibold text-neutral-900">{regiao.name}</li>
          </ol>
        </nav>
      </div>

      {/* Split hero — light copy panel + bright photo, no dark overlay. */}
      <section
        aria-labelledby="regiao-hero-title"
        className="border-b border-neutral-200 bg-white"
      >
        <div className="mx-auto grid max-w-7xl lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className="relative flex flex-col justify-center px-4 py-12 sm:px-6 sm:py-16 lg:px-10 lg:py-20">
            <span
              aria-hidden
              className="absolute top-12 left-0 hidden h-14 w-1 bg-primary lg:block"
            />
            <p className="text-xs font-semibold tracking-[0.22em] text-primary uppercase">
              {focusLabel(regiao.focus)} · {t('hero_eyebrow')}
            </p>
            <h1
              className="mt-4 max-w-xl font-heading text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08]"
              id="regiao-hero-title"
            >
              {regiao.h1}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">
              {regiao.tagline}
            </p>
            <ConversionCtas
              className="mt-8"
              quoteLabel={t('cta_quote')}
              size="md"
              whatsappHref={whatsappHref}
              whatsappLabel={t('cta_whatsapp')}
              whatsappOrigin="site-regiao"
            />
            <div aria-hidden className="h-0" id="regiao-hero-sentinel" />
          </div>

          <div className="relative min-h-[300px] sm:min-h-[420px] lg:min-h-[540px]">
            <Image
              alt={regiao.heroAlt}
              className="object-cover brightness-[1.1] contrast-[1.03] saturate-[1.06]"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              src={regiao.heroImage}
            />
          </div>
        </div>
      </section>

      {/* Intro copy + highlights sidebar on white. */}
      <section aria-labelledby="regiao-intro-title" className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <span aria-hidden className="block h-1 w-12 bg-primary" />
              <h2
                className="mt-4 font-heading text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl lg:text-4xl"
                id="regiao-intro-title"
              >
                {t('intro_title', { city: regiao.name })}
              </h2>
              <div className="mt-6 space-y-5 text-base leading-relaxed text-neutral-700">
                {regiao.intro.map((paragraph) => (
                  <p key={paragraph.slice(0, 48)}>{paragraph}</p>
                ))}
              </div>
            </div>

            <aside
              aria-labelledby="regiao-highlights-title"
              className="rounded-[var(--radius-card)] border border-primary/15 bg-primary/[0.04] p-7 sm:p-8"
            >
              <span aria-hidden className="block h-1 w-10 bg-primary" />
              <h2
                className="mt-4 font-heading text-lg font-bold text-neutral-900 sm:text-xl"
                id="regiao-highlights-title"
              >
                {t('highlights_title')}
              </h2>
              <ul className="mt-5 space-y-4">
                {regiao.highlights.map((item) => (
                  <li className="flex gap-3 text-sm leading-relaxed text-neutral-700" key={item}>
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                    >
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M5 12l5 5L20 7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      </section>

      {/* Featured categories — icon + label link rows on soft-gray band. */}
      <section
        aria-labelledby="regiao-categories-title"
        className="border-y border-neutral-200 bg-neutral-50"
      >
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-2xl">
            <span aria-hidden className="block h-1 w-12 bg-primary" />
            <h2
              className="mt-4 font-heading text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl lg:text-4xl"
              id="regiao-categories-title"
            >
              {t('categories_title', { city: regiao.name })}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-neutral-600">
              {t('categories_subtitle')}
            </p>
          </div>

          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {regiao.featuredCategorySlugs.map((categorySlug) => (
              <li key={categorySlug}>
                <Link
                  className="group flex h-full items-center gap-4 rounded-[var(--radius-card)] border border-neutral-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_14px_40px_-20px_rgba(196,30,36,0.35)]"
                  href={
                    isRegiaoCategoriaCombo(regiao.slug, categorySlug)
                      ? `/regioes/${regiao.slug}/${categorySlug}`
                      : `/categorias/${categorySlug}`
                  }
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <CategoryIcon category={categorySlug} className="h-6 w-6" />
                  </span>
                  <span className="flex-1 font-heading text-base font-semibold text-neutral-900 group-hover:text-primary sm:text-lg">
                    {CATEGORY_LABELS[categorySlug]}
                  </span>
                  <span
                    aria-hidden
                    className="text-primary transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {nearby.length > 0 ? (
        <section aria-labelledby="regiao-nearby-title" className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="max-w-2xl">
              <span aria-hidden className="block h-1 w-12 bg-primary" />
              <h2
                className="mt-4 font-heading text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl lg:text-4xl"
                id="regiao-nearby-title"
              >
                {t('nearby_title')}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-neutral-600">
                {t('nearby_subtitle')}
              </p>
            </div>

            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {nearby.map((item) => (
                <li key={item.slug}>
                  <RegiaoCityCard
                    compact
                    ctaLabel={t('card_cta')}
                    imageSizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    regiao={item}
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <SolucaoLinks solucoes={solucoes} title={t('solutions_title')} />
        </div>
      </section>

      <section
        aria-labelledby="regiao-faq-title"
        className="border-t border-neutral-200 bg-neutral-50"
      >
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <span aria-hidden className="block h-1 w-12 bg-primary" />
          <h2
            className="mt-4 font-heading text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl lg:text-4xl"
            id="regiao-faq-title"
          >
            {t('faq_title', { city: regiao.name })}
          </h2>
          <div className="mt-8">
            <FaqAccordion items={faqItems} />
          </div>
        </div>
      </section>

      {/* Final CTA on light primary tint — never dark. */}
      <section
        aria-labelledby="regiao-cta-title"
        className="border-t border-primary/15 bg-primary/[0.05]"
      >
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
          <span aria-hidden className="mx-auto block h-1 w-12 bg-primary" />
          <h2
            className="mt-4 font-heading text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl lg:text-4xl"
            id="regiao-cta-title"
          >
            {t('cta_block_title', { city: regiao.name })}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-neutral-700">
            {t('cta_block_subtitle')}
          </p>
          <ConversionCtas
            className="mt-8 justify-center"
            quoteLabel={t('cta_quote')}
            size="lg"
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
