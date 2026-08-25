import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CategoryIcon } from '@/components/marketing/CategoryIcon';
import { ConversionCtas } from '@/components/marketing/ConversionCtas';
import { EquipmentCard } from '@/components/marketing/EquipmentCard';
import { FaqAccordion } from '@/components/marketing/FaqAccordion';
import { SetMobileDockConfig } from '@/components/marketing/mobile-dock-config';
import { RegiaoLinks } from '@/components/marketing/RegiaoLinks';
import { SolucaoIcon } from '@/components/marketing/SolucaoIcon';
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

      <div className="border-b border-neutral-200 bg-neutral-50">
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
            <li aria-hidden>/</li>
            <li>
              <Link className="hover:text-primary" href="/solucoes">
                {t('breadcrumb_solucoes')}
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="font-medium text-neutral-900">{solucao.name}</li>
          </ol>
        </nav>
      </div>

      <section className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex h-14 w-14 items-center justify-center bg-primary/[0.08] text-primary">
                <SolucaoIcon className="h-9 w-9" slug={solucao.slug} />
              </div>
              <p className="mt-5 text-xs font-semibold tracking-[0.22em] text-primary uppercase">
                {t('hero_eyebrow')}
              </p>
              <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl lg:text-[2.6rem] lg:leading-tight">
                {solucao.h1}
              </h1>
              <p className="mt-4 text-base leading-relaxed text-neutral-600 sm:text-lg">
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

            <aside className="w-full max-w-md border border-neutral-200 bg-neutral-50 p-6 sm:p-7">
              <span aria-hidden className="block h-1 w-10 bg-primary" />
              <h2 className="mt-4 font-heading text-lg font-bold text-neutral-900">
                {t('challenges_title')}
              </h2>
              <ul className="mt-4 space-y-3">
                {solucao.challenges.map((item) => (
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
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <span aria-hidden className="block h-1 w-12 bg-primary" />
          <h2 className="mt-4 font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
            {t('intro_title', { name: solucao.name })}
          </h2>
          <div className="mt-6 max-w-3xl space-y-4 text-base leading-relaxed text-neutral-600">
            {solucao.intro.map((paragraph) => (
              <p key={paragraph.slice(0, 48)}>{paragraph}</p>
            ))}
          </div>

          <h3 className="mt-12 font-heading text-xl font-bold text-neutral-900">
            {t('applications_title')}
          </h3>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {solucao.applications.map((item) => (
              <li
                className="border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700"
                key={item}
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-y border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <span aria-hidden className="block h-1 w-12 bg-primary" />
          <h2 className="mt-4 font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
            {t('categories_title')}
          </h2>
          <p className="mt-3 max-w-2xl text-neutral-600">{t('categories_subtitle')}</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {solucao.featuredCategorySlugs.map((categorySlug) => (
              <li key={categorySlug}>
                <Link
                  className="group flex h-full items-center gap-4 border border-neutral-200 bg-white p-5 transition hover:border-primary/40 hover:shadow-sm"
                  href={`/categorias/${categorySlug}`}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center bg-primary/[0.08] text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <CategoryIcon category={categorySlug} className="h-6 w-6" />
                  </span>
                  <span className="flex-1 font-heading text-base font-semibold text-neutral-900 group-hover:text-primary">
                    {CATEGORY_LABELS[categorySlug]}
                  </span>
                  <span aria-hidden className="text-primary">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {featuredEquipment.length > 0 ? (
            <div className="mt-12">
              <h3 className="font-heading text-xl font-bold text-neutral-900">
                {t('equipment_title')}
              </h3>
              <p className="mt-2 text-sm text-neutral-600">{t('equipment_subtitle')}</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <span aria-hidden className="block h-1 w-12 bg-primary" />
          <h2 className="mt-4 font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
            {t('highlights_title')}
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {solucao.highlights.map((item) => (
              <li
                className="border border-neutral-200 bg-neutral-50 p-5 text-sm leading-relaxed text-neutral-700"
                key={item}
              >
                {item}
              </li>
            ))}
          </ul>

          <RegiaoLinks className="mt-12" regioes={regioes} title={t('regions_title')} />
        </div>
      </section>

      <section className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <h2 className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
            {t('faq_title', { name: solucao.name })}
          </h2>
          <div className="mt-8">
            <FaqAccordion items={faqItems} />
          </div>
        </div>
      </section>

      <section className="border-t border-primary/20 bg-primary/[0.05]">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 sm:py-16 lg:px-8">
          <h2 className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
            {t('cta_block_title', { name: solucao.name })}
          </h2>
          <p className="mt-3 text-neutral-600">{t('cta_block_subtitle')}</p>
          <ConversionCtas
            className="mt-8 justify-center"
            quoteLabel={t('cta_quote')}
            size="md"
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
