import Image from 'next/image';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CategoryIcon } from '@/components/marketing/CategoryIcon';
import { ConversionCtas } from '@/components/marketing/ConversionCtas';
import { EquipmentCard } from '@/components/marketing/EquipmentCard';
import { FaqAccordion } from '@/components/marketing/FaqAccordion';
import { SetMobileDockConfig } from '@/components/marketing/mobile-dock-config';
import { RegiaoLinks } from '@/components/marketing/RegiaoLinks';
import { JsonLd } from '@/components/seo/JsonLd';
import { getRegiaoBySlug } from '@/data/regioes';
import {
  ALL_SOLUCAO_SLUGS,
  getSolucaoBySlug,
  isSolucaoSlug,
} from '@/data/solucoes';
import { buildWhatsAppMessage, buildWhatsAppUrl } from '@/lib/brand';
import { getEquipmentBySlug } from '@/lib/equipment';
import { getResolvedEquipmentImageMap } from '@/lib/equipment-images-server';
import { buildMarketingMetadata } from '@/lib/seo-metadata';
import { buildSolucaoPageJsonLd } from '@/lib/solucoes-json-ld';
import { Link } from '@/libs/I18nNavigation';
import { routing } from '@/libs/I18nRouting';
import { CATEGORY_LABELS } from '@/types/equipment';
import { resolveAppLocale } from '@/utils/locale';

type SolucaoPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

/** @see MARKETING_ISR_REVALIDATE_SECONDS in @/lib/isr-revalidate */
export const revalidate = 86_400;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    ALL_SOLUCAO_SLUGS.map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata(props: SolucaoPageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const solucao = getSolucaoBySlug(slug);
  if (!solucao) {
    return { title: 'Solução' };
  }
  return buildMarketingMetadata({
    title: solucao.metaTitle,
    description: solucao.metaDescription,
    path: `/solucoes/${solucao.slug}`,
  });
}

export default async function SolucaoDetailPage(props: SolucaoPageProps) {
  const { locale, slug } = await props.params;
  setRequestLocale(resolveAppLocale(locale));

  if (!isSolucaoSlug(slug)) {
    notFound();
  }

  const solucao = getSolucaoBySlug(slug);
  if (!solucao) {
    notFound();
  }

  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'SolucaoDetail',
  });

  const [equipmentList, imageBySlug] = await Promise.all([
    Promise.all(solucao.featuredEquipmentSlugs.map((itemSlug) => getEquipmentBySlug(itemSlug))),
    getResolvedEquipmentImageMap(),
  ]);
  const featuredEquipment = equipmentList.filter(
    (item): item is NonNullable<typeof item> => Boolean(item),
  );
  const regioes = solucao.nearbyRegiaoSlugs
    .map((regiaoSlug) => getRegiaoBySlug(regiaoSlug))
    .filter((regiao): regiao is NonNullable<typeof regiao> => Boolean(regiao));

  const faqItems = solucao.faqs.map((item, index) => ({
    id: `${solucao.slug}-faq-${index}`,
    question: item.question,
    answer: item.answer,
  }));
  const whatsappHref = buildWhatsAppUrl(
    buildWhatsAppMessage({
      origin: 'site-solucao',
      topic: `locação de equipamentos para ${solucao.name.toLowerCase()}`,
    }),
  );

  return (
    <>
      <JsonLd data={buildSolucaoPageJsonLd(solucao)} />

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
              <Link className="hover:text-primary" href="/solucoes">
                {t('breadcrumb_solucoes')}
              </Link>
            </li>
            <li aria-hidden className="text-neutral-300">
              /
            </li>
            <li className="font-semibold text-neutral-900">{solucao.name}</li>
          </ol>
        </nav>
      </div>

      {/* Split hero — light copy + bright photo (aligned with /regioes). */}
      <section
        aria-labelledby="solucao-hero-title"
        className="border-b border-neutral-200 bg-white"
      >
        <div className="mx-auto grid max-w-7xl lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className="relative flex flex-col justify-center px-4 py-12 sm:px-6 sm:py-16 lg:px-10 lg:py-20">
            <span
              aria-hidden
              className="absolute top-12 left-0 hidden h-14 w-1 bg-primary lg:block"
            />
            <p className="text-xs font-semibold tracking-[0.22em] text-primary uppercase">
              {t('hero_eyebrow')}
            </p>
            <h1
              className="mt-4 max-w-xl font-heading text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08]"
              id="solucao-hero-title"
            >
              {solucao.h1}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">
              {solucao.tagline}
            </p>
            <ConversionCtas
              className="mt-8"
              quoteLabel={t('cta_quote')}
              size="md"
              whatsappHref={whatsappHref}
              whatsappLabel={t('cta_whatsapp')}
              whatsappOrigin="site-solucao"
            />
            <div aria-hidden className="h-0" id="solucao-hero-sentinel" />
          </div>

          <div className="relative min-h-[300px] sm:min-h-[420px] lg:min-h-[540px]">
            <Image
              alt={solucao.heroAlt}
              className="object-cover brightness-[1.08] contrast-[1.03] saturate-[1.05]"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              src={solucao.heroImage}
            />
          </div>
        </div>
      </section>

      {/* Intro + challenges */}
      <section aria-labelledby="solucao-intro-title" className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <span aria-hidden className="block h-1 w-12 bg-primary" />
              <h2
                className="mt-4 font-heading text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl lg:text-4xl"
                id="solucao-intro-title"
              >
                {t('intro_title', { name: solucao.name })}
              </h2>
              <div className="mt-6 space-y-5 text-base leading-relaxed text-neutral-700">
                {solucao.intro.map((paragraph) => (
                  <p key={paragraph.slice(0, 48)}>{paragraph}</p>
                ))}
              </div>
            </div>

            <aside
              aria-labelledby="solucao-challenges-title"
              className="rounded-[var(--radius-card)] border border-primary/15 bg-primary/[0.04] p-7 sm:p-8"
            >
              <span aria-hidden className="block h-1 w-10 bg-primary" />
              <h2
                className="mt-4 font-heading text-lg font-bold text-neutral-900 sm:text-xl"
                id="solucao-challenges-title"
              >
                {t('challenges_title')}
              </h2>
              <ul className="mt-5 space-y-4">
                {solucao.challenges.map((item) => (
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

      {/* Scenarios */}
      <section
        aria-labelledby="solucao-scenarios-title"
        className="border-y border-neutral-200 bg-neutral-50"
      >
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-2xl">
            <span aria-hidden className="block h-1 w-12 bg-primary" />
            <h2
              className="mt-4 font-heading text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl lg:text-4xl"
              id="solucao-scenarios-title"
            >
              {t('scenarios_title')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-neutral-600">
              {t('scenarios_subtitle')}
            </p>
          </div>

          <ul className="mt-10 grid gap-5 sm:grid-cols-2">
            {solucao.scenarios.map((scenario) => (
              <li
                className="border border-neutral-200 bg-white p-6 shadow-sm"
                key={scenario.title}
              >
                <h3 className="font-heading text-lg font-bold text-neutral-900">
                  {scenario.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                  {scenario.description}
                </p>
              </li>
            ))}
          </ul>

          <h3 className="mt-12 font-heading text-xl font-bold text-neutral-900">
            {t('applications_title')}
          </h3>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {solucao.applications.map((item) => (
              <li
                className="border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700"
                key={item}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Process */}
      <section aria-labelledby="solucao-process-title" className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-2xl">
            <span aria-hidden className="block h-1 w-12 bg-primary" />
            <h2
              className="mt-4 font-heading text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl lg:text-4xl"
              id="solucao-process-title"
            >
              {t('process_title')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-neutral-600">
              {t('process_subtitle')}
            </p>
          </div>

          <ol className="mt-10 grid gap-6 lg:grid-cols-3">
            {solucao.processSteps.map((step, index) => (
              <li
                className="relative border border-neutral-200 bg-neutral-50 p-6"
                key={step.title}
              >
                <span className="font-heading text-3xl font-bold text-primary/25">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 font-heading text-lg font-bold text-neutral-900">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Categories + equipment */}
      <section
        aria-labelledby="solucao-categories-title"
        className="border-y border-neutral-200 bg-neutral-50"
      >
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-2xl">
            <span aria-hidden className="block h-1 w-12 bg-primary" />
            <h2
              className="mt-4 font-heading text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl lg:text-4xl"
              id="solucao-categories-title"
            >
              {t('categories_title')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-neutral-600">
              {t('categories_subtitle')}
            </p>
          </div>

          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {solucao.featuredCategorySlugs.map((categorySlug) => (
              <li key={categorySlug}>
                <Link
                  className="group flex h-full items-center gap-4 rounded-[var(--radius-card)] border border-neutral-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_14px_40px_-20px_rgba(196,30,36,0.35)]"
                  href={`/categorias/${categorySlug}`}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-primary transition-colors group-hover:bg-primary group-hover:text-white">
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

          {featuredEquipment.length > 0 ? (
            <div className="mt-14">
              <h3 className="font-heading text-xl font-bold text-neutral-900 sm:text-2xl">
                {t('equipment_title')}
              </h3>
              <p className="mt-2 text-sm text-neutral-600 sm:text-base">{t('equipment_subtitle')}</p>
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {featuredEquipment.map((equipment) => (
                  <EquipmentCard
                    equipment={equipment}
                    imageSrc={imageBySlug[equipment.slug]}
                    key={equipment.slug}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* Highlights + regions */}
      <section aria-labelledby="solucao-highlights-title" className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <span aria-hidden className="block h-1 w-12 bg-primary" />
          <h2
            className="mt-4 font-heading text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl lg:text-4xl"
            id="solucao-highlights-title"
          >
            {t('highlights_title')}
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {solucao.highlights.map((item) => (
              <li
                className="border border-neutral-200 bg-neutral-50 p-5 text-sm leading-relaxed text-neutral-700"
                key={item}
              >
                {item}
              </li>
            ))}
          </ul>

          <RegiaoLinks className="mt-14" regioes={regioes} title={t('regions_title')} />
        </div>
      </section>

      <section
        aria-labelledby="solucao-faq-title"
        className="border-t border-neutral-200 bg-neutral-50"
      >
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <span aria-hidden className="block h-1 w-12 bg-primary" />
          <h2
            className="mt-4 font-heading text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl lg:text-4xl"
            id="solucao-faq-title"
          >
            {t('faq_title', { name: solucao.name })}
          </h2>
          <div className="mt-8">
            <FaqAccordion items={faqItems} />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="solucao-cta-title"
        className="border-t border-primary/15 bg-primary/[0.05]"
      >
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
          <span aria-hidden className="mx-auto block h-1 w-12 bg-primary" />
          <h2
            className="mt-4 font-heading text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl lg:text-4xl"
            id="solucao-cta-title"
          >
            {t('cta_block_title', { name: solucao.name })}
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
            whatsappOrigin="site-solucao-cta"
          />
        </div>
      </section>

      <SetMobileDockConfig
        quoteLabel={t('cta_quote')}
        sentinelId="solucao-hero-sentinel"
        whatsappHref={whatsappHref}
        whatsappLabel={t('cta_whatsapp')}
        whatsappOrigin="site-solucao-sticky"
      />
    </>
  );
}
