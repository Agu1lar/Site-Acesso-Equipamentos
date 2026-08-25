import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CategoryGallery } from '@/components/marketing/CategoryGallery';
import { CategorySeoSection } from '@/components/marketing/CategorySeoSection';
import { ConversionCtas } from '@/components/marketing/ConversionCtas';
import { SetMobileDockConfig } from '@/components/marketing/mobile-dock-config';
import { CategoryEquipmentGrid } from '@/components/marketing/CategoryEquipmentGrid';
import { MarketingBreadcrumb } from '@/components/marketing/MarketingBreadcrumb';
import { RegiaoLinks } from '@/components/marketing/RegiaoLinks';
import { SolucaoLinks } from '@/components/marketing/SolucaoLinks';
import { JsonLd } from '@/components/seo/JsonLd';
import { getRegioesForCategory } from '@/data/regioes';
import { getSolucoesForCategory } from '@/data/solucoes';
import { buildWhatsAppMessage, buildWhatsAppUrl } from '@/lib/brand';
import {
  ALL_EQUIPMENT_CATEGORIES,
  getCategorySeo,
  isEquipmentCategory,
} from '@/lib/categories-seo';
import { getCategoryGallery } from '@/lib/category-gallery';
import { getEquipmentByCategory } from '@/lib/equipment';
import { getResolvedEquipmentImageMap } from '@/lib/equipment-images-server';
import { buildCategoryPageJsonLd } from '@/lib/json-ld';
import { buildMarketingMetadata } from '@/lib/seo-metadata';
import { Link } from '@/libs/I18nNavigation';
import { routing } from '@/libs/I18nRouting';
import { CATEGORY_LABELS } from '@/types/equipment';
import { resolveAppLocale } from '@/utils/locale';

type CategoryPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

/** @see MARKETING_ISR_REVALIDATE_SECONDS in @/lib/isr-revalidate */
export const revalidate = 86_400;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    ALL_EQUIPMENT_CATEGORIES.map((slug) => ({ locale, slug })),
  );
}

export async function generateMetadata(props: CategoryPageProps): Promise<Metadata> {
  const { slug } = await props.params;
  if (!isEquipmentCategory(slug)) {
    return { title: 'Categoria' };
  }
  const seo = getCategorySeo(slug);
  return buildMarketingMetadata({
    title: seo.metaTitle,
    description: seo.metaDescription,
    path: `/categorias/${slug}`,
  });
}

export default async function CategoryPage(props: CategoryPageProps) {
  const { locale, slug } = await props.params;
  setRequestLocale(resolveAppLocale(locale));

  if (!isEquipmentCategory(slug)) {
    notFound();
  }

  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'Categoria',
  });
  const seo = getCategorySeo(slug);
  const [equipment, imageBySlug] = await Promise.all([
    getEquipmentByCategory(slug),
    getResolvedEquipmentImageMap(),
  ]);
  const gallery = getCategoryGallery(slug);
  const categoryLabel = CATEGORY_LABELS[slug];
  const regioes = getRegioesForCategory(slug);
  const solucoes = getSolucoesForCategory(slug);
  const whatsappHref = buildWhatsAppUrl(
    buildWhatsAppMessage({
      equipmentName: categoryLabel,
      equipmentSlug: slug,
      origin: 'site-categoria',
    }),
  );

  return (
    <>
      <JsonLd data={buildCategoryPageJsonLd({ slug, seo, equipment })} />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <MarketingBreadcrumb
          items={[
            { label: t('breadcrumb_home'), href: '/' },
            { label: t('breadcrumb_equipment'), href: '/equipamentos' },
            { label: categoryLabel },
          ]}
        />

        <header className="mt-4 max-w-3xl sm:mt-6">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">
            {t('hero_tagline')}
          </p>
          <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight text-neutral-900 sm:mt-3 sm:text-3xl lg:text-4xl">
            {seo.h1}
          </h1>
          <p className="mt-2 line-clamp-2 text-base leading-snug text-neutral-600 sm:mt-3 sm:line-clamp-none sm:text-lg sm:leading-relaxed">
            {seo.metaDescription}
          </p>
          <ConversionCtas
            className="mt-4 sm:mt-6"
            equipmentName={categoryLabel}
            equipmentSlug={slug}
            quoteLabel={t('cta_quote')}
            size="md"
            whatsappHref={whatsappHref}
            whatsappLabel={t('cta_whatsapp')}
            whatsappOrigin="site-categoria"
          />
          <div aria-hidden className="h-0" id="category-hero-sentinel" />
        </header>

        <CategoryGallery
          className="mt-6 sm:mt-8"
          images={gallery}
          title={categoryLabel}
        />

        <section aria-labelledby="category-catalog-title" className="mt-8 sm:mt-10">
          <div>
            <h2
              className="font-heading text-xl font-bold text-neutral-900 sm:text-2xl"
              id="category-catalog-title"
            >
              {t('catalog_title', { category: categoryLabel })}
            </h2>
          </div>

          <CategoryEquipmentGrid
            equipment={equipment}
            imageBySlug={imageBySlug}
            showPlatformKindFilter={slug === 'plataformas-elevatorias'}
          />

          <section
            aria-labelledby="category-catalog-cta-title"
            className="mt-8 rounded-[var(--radius-card)] border border-primary/15 bg-primary/[0.04] p-5 sm:mt-10 sm:p-6"
          >
            <h3
              className="text-center font-heading text-lg font-bold text-neutral-900"
              id="category-catalog-cta-title"
            >
              {t('catalog_cta_title', { category: categoryLabel })}
            </h3>
            <p className="mt-1 text-center text-sm text-neutral-600">{t('catalog_cta_subtitle')}</p>
            <ConversionCtas
              className="mt-4 justify-center"
              equipmentName={categoryLabel}
              equipmentSlug={slug}
              quoteLabel={t('cta_quote')}
              size="sm"
              whatsappHref={whatsappHref}
              whatsappLabel={t('cta_whatsapp')}
              whatsappOrigin="site-categoria-catalogo"
            />
          </section>

          <p className="mt-8 text-center text-sm text-neutral-600">
            <Link className="font-semibold text-primary hover:underline" href="/equipamentos">
              {t('view_all_catalog')}
            </Link>
          </p>
        </section>

        <CategorySeoSection
          faqTitle={seo.faqs?.length ? (seo.faqTitle ?? t('seo_faq_title')) : undefined}
          faqs={seo.faqs}
          paragraphs={seo.paragraphs}
          readMoreLabel={t('seo_read_more', { category: categoryLabel })}
        />

        <RegiaoLinks
          className="mt-10 sm:mt-12"
          categorySlug={slug}
          regioes={regioes}
          title={t('regions_title')}
        />
        <SolucaoLinks className="mt-8" solucoes={solucoes} title={t('solutions_title')} />
      </div>

      <SetMobileDockConfig
        equipmentName={categoryLabel}
        equipmentSlug={slug}
        quoteLabel={t('cta_quote')}
        sentinelId="category-hero-sentinel"
        whatsappHref={whatsappHref}
        whatsappLabel={t('cta_whatsapp')}
        whatsappOrigin="site-categoria-sticky"
      />
    </>
  );
}
