import Image from 'next/image';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CategoryIcon } from '@/components/marketing/CategoryIcon';
import { ConversionCtas } from '@/components/marketing/ConversionCtas';
import { EquipmentCard } from '@/components/marketing/EquipmentCard';
import { FaqAccordion } from '@/components/marketing/FaqAccordion';
import { MarketingBreadcrumb } from '@/components/marketing/MarketingBreadcrumb';
import { SetMobileDockConfig } from '@/components/marketing/mobile-dock-config';
import { SolucaoLinks } from '@/components/marketing/SolucaoLinks';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  buildRegiaoCategoriaContent,
  getAllRegiaoCategoriaParams,
  isRegiaoCategoriaCombo,
} from '@/data/regiao-categoria';
import { getSolucoesForCategory } from '@/data/solucoes';
import { buildWhatsAppMessage, buildWhatsAppUrl } from '@/lib/brand';
import { getEquipmentByCategory } from '@/lib/equipment';
import { getResolvedEquipmentImageMap } from '@/lib/equipment-images-server';
import { buildRegiaoCategoriaPageJsonLd } from '@/lib/regiao-categoria-json-ld';
import { buildMarketingMetadata } from '@/lib/seo-metadata';
import { Link } from '@/libs/I18nNavigation';
import { routing } from '@/libs/I18nRouting';
import { resolveAppLocale } from '@/utils/locale';

type RegiaoCategoriaPageProps = {
  params: Promise<{ locale: string; slug: string; categoria: string }>;
};

/** @see MARKETING_ISR_REVALIDATE_SECONDS in @/lib/isr-revalidate */
export const revalidate = 86_400;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    getAllRegiaoCategoriaParams().map((item) => ({
      locale,
      slug: item.slug,
      categoria: item.categoria,
    })),
  );
}

export async function generateMetadata(props: RegiaoCategoriaPageProps): Promise<Metadata> {
  const { slug, categoria } = await props.params;
  const content = buildRegiaoCategoriaContent(slug, categoria);
  if (!content) {
    return { title: 'Região' };
  }
  return buildMarketingMetadata({
    title: content.metaTitle,
    description: content.metaDescription,
    path: content.path,
  });
}

export default async function RegiaoCategoriaPage(props: RegiaoCategoriaPageProps) {
  const { locale, slug, categoria } = await props.params;
  setRequestLocale(resolveAppLocale(locale));

  if (!isRegiaoCategoriaCombo(slug, categoria)) {
    notFound();
  }

  const content = buildRegiaoCategoriaContent(slug, categoria);
  if (!content) {
    notFound();
  }

  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'RegiaoCategoria',
  });

  const [equipment, imageBySlug] = await Promise.all([
    getEquipmentByCategory(content.categorySlug),
    getResolvedEquipmentImageMap(),
  ]);
  const featuredEquipment = equipment.slice(0, 6);
  const solucoes = getSolucoesForCategory(content.categorySlug, 3);
  const faqItems = content.faqs.map((item, index) => ({
    id: `${content.citySlug}-${content.categorySlug}-faq-${index}`,
    question: item.question,
    answer: item.answer,
  }));
  const whatsappHref = buildWhatsAppUrl(
    buildWhatsAppMessage({
      origin: 'site-regiao-categoria',
      topic: `locação de ${content.categoryLabel.toLowerCase()} em ${content.regiao.name}`,
    }),
  );

  return (
    <>
      <JsonLd data={buildRegiaoCategoriaPageJsonLd(content)} />

      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <MarketingBreadcrumb
            items={[
              { label: t('breadcrumb_home'), href: '/' },
              { label: t('breadcrumb_regioes'), href: '/regioes' },
              { label: content.regiao.name, href: `/regioes/${content.citySlug}` },
              { label: content.categoryLabel },
            ]}
          />
        </div>
      </div>

      <section
        aria-labelledby="regiao-categoria-hero-title"
        className="border-b border-neutral-200 bg-white"
      >
        <div className="mx-auto grid max-w-7xl lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className="relative flex flex-col justify-center px-4 py-12 sm:px-6 sm:py-16 lg:px-10 lg:py-20">
            <span
              aria-hidden
              className="absolute top-12 left-0 hidden h-14 w-1 bg-primary lg:block"
            />
            <p className="text-xs font-semibold tracking-[0.22em] text-primary uppercase">
              {t('hero_eyebrow', { city: content.regiao.name })}
            </p>
            <h1
              className="mt-4 max-w-xl font-heading text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl lg:text-[2.5rem] lg:leading-[1.1]"
              id="regiao-categoria-hero-title"
            >
              {content.h1}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">
              {content.tagline}
            </p>
            <ConversionCtas
              className="mt-8"
              quoteLabel={t('cta_quote')}
              size="md"
              whatsappHref={whatsappHref}
              whatsappLabel={t('cta_whatsapp')}
              whatsappOrigin="site-regiao-categoria"
            />
            <div aria-hidden className="h-0" id="regiao-categoria-hero-sentinel" />
          </div>

          <div className="relative min-h-[280px] sm:min-h-[400px] lg:min-h-[520px]">
            <Image
              alt={content.regiao.heroAlt}
              className="object-cover brightness-[1.08] contrast-[1.03] saturate-[1.05]"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              src={content.regiao.heroImage}
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="regiao-categoria-intro-title" className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <span aria-hidden className="block h-1 w-12 bg-primary" />
          <h2
            className="mt-4 font-heading text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl"
            id="regiao-categoria-intro-title"
          >
            {t('intro_title', {
              category: content.categoryLabel,
              city: content.regiao.name,
            })}
          </h2>
          <div className="mt-6 max-w-3xl space-y-5 text-base leading-relaxed text-neutral-700">
            {content.intro.map((paragraph) => (
              <p key={paragraph.slice(0, 48)}>{paragraph}</p>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              className="inline-flex items-center gap-2 border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:border-primary/40 hover:text-primary"
              href={`/categorias/${content.categorySlug}`}
            >
              <CategoryIcon category={content.categorySlug} className="h-5 w-5 text-primary" />
              {t('catalog_link', { category: content.categoryLabel })}
            </Link>
            <Link
              className="inline-flex items-center border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 transition hover:border-primary/40 hover:text-primary"
              href={`/regioes/${content.citySlug}`}
            >
              {t('city_link', { city: content.regiao.name })}
            </Link>
          </div>
        </div>
      </section>

      {content.enrichment ? (
        <>
          <section
            aria-labelledby="regiao-categoria-types-title"
            className="border-t border-neutral-200 bg-neutral-50"
          >
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
              <span aria-hidden className="block h-1 w-12 bg-primary" />
              <h2
                className="mt-4 font-heading text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl"
                id="regiao-categoria-types-title"
              >
                {content.enrichment.typesTitle}
              </h2>
              <div className="mt-10 grid gap-8 sm:grid-cols-2">
                {content.enrichment.types.map((item) => (
                  <article key={item.title}>
                    <h3 className="font-heading text-lg font-semibold text-neutral-900">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-base leading-relaxed text-neutral-700">{item.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section
            aria-labelledby="regiao-categoria-propulsion-title"
            className="border-t border-neutral-200 bg-white"
          >
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
              <span aria-hidden className="block h-1 w-12 bg-primary" />
              <h2
                className="mt-4 font-heading text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl"
                id="regiao-categoria-propulsion-title"
              >
                {content.enrichment.propulsionTitle}
              </h2>
              <div className="mt-10 grid gap-8 sm:grid-cols-2">
                {content.enrichment.propulsion.map((item) => (
                  <article key={item.title}>
                    <h3 className="font-heading text-lg font-semibold text-neutral-900">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-base leading-relaxed text-neutral-700">{item.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section
            aria-labelledby="regiao-categoria-heights-title"
            className="border-t border-neutral-200 bg-neutral-50"
          >
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
              <span aria-hidden className="block h-1 w-12 bg-primary" />
              <h2
                className="mt-4 font-heading text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl"
                id="regiao-categoria-heights-title"
              >
                {content.enrichment.heightsTitle}
              </h2>
              <div className="mt-10 grid gap-8 lg:grid-cols-3">
                {content.enrichment.heights.map((item) => (
                  <article key={item.title}>
                    <h3 className="font-heading text-lg font-semibold text-neutral-900">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-base leading-relaxed text-neutral-700">{item.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section
            aria-labelledby="regiao-categoria-why-title"
            className="border-t border-neutral-200 bg-white"
          >
            <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
              <span aria-hidden className="block h-1 w-12 bg-primary" />
              <h2
                className="mt-4 font-heading text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl"
                id="regiao-categoria-why-title"
              >
                {content.enrichment.whyTitle}
              </h2>
              <ul className="mt-8 space-y-3 text-base leading-relaxed text-neutral-700">
                {content.enrichment.why.map((item) => (
                  <li className="flex gap-3" key={item}>
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      ) : null}

      {featuredEquipment.length > 0 ? (
        <section
          aria-labelledby="regiao-categoria-equipment-title"
          className="border-y border-neutral-200 bg-neutral-50"
        >
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <span aria-hidden className="block h-1 w-12 bg-primary" />
            <h2
              className="mt-4 font-heading text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl"
              id="regiao-categoria-equipment-title"
            >
              {t('equipment_title', { category: content.categoryLabel })}
            </h2>
            <p className="mt-3 max-w-2xl text-neutral-600">{t('equipment_subtitle')}</p>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featuredEquipment.map((item) => (
                <EquipmentCard
                  equipment={item}
                  imageSrc={imageBySlug[item.slug]}
                  key={item.slug}
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <SolucaoLinks solucoes={solucoes} title={t('solutions_title')} />
        </div>
      </section>

      <section
        aria-labelledby="regiao-categoria-faq-title"
        className="border-t border-neutral-200 bg-neutral-50"
      >
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <span aria-hidden className="block h-1 w-12 bg-primary" />
          <h2
            className="mt-4 font-heading text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl"
            id="regiao-categoria-faq-title"
          >
            {t('faq_title', {
              category: content.categoryLabel,
              city: content.regiao.name,
            })}
          </h2>
          <div className="mt-8">
            <FaqAccordion items={faqItems} />
          </div>
        </div>
      </section>

      <section className="border-t border-primary/15 bg-primary/[0.05]">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
          <span aria-hidden className="mx-auto block h-1 w-12 bg-primary" />
          <h2 className="mt-4 font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
            {t('cta_block_title', {
              category: content.categoryLabel,
              city: content.regiao.name,
            })}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-neutral-700">{t('cta_block_subtitle')}</p>
          <ConversionCtas
            className="mt-8 justify-center"
            quoteLabel={t('cta_quote')}
            size="lg"
            whatsappHref={whatsappHref}
            whatsappLabel={t('cta_whatsapp')}
            whatsappOrigin="site-regiao-categoria-cta"
          />
        </div>
      </section>

      <SetMobileDockConfig
        quoteLabel={t('cta_quote')}
        sentinelId="regiao-categoria-hero-sentinel"
        whatsappHref={whatsappHref}
        whatsappLabel={t('cta_whatsapp')}
        whatsappOrigin="site-regiao-categoria-sticky"
      />
    </>
  );
}
