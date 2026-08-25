import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { EquipmentViewTracker } from '@/components/analytics/EquipmentViewTracker';
import { ConversionCtas } from '@/components/marketing/ConversionCtas';
import { EquipmentCard } from '@/components/marketing/EquipmentCard';
import { EquipmentDetailImage } from '@/components/marketing/EquipmentDetailImage';
import { EquipmentLaudoLink } from '@/components/marketing/EquipmentLaudoLink';
import { ExpandableParagraphs } from '@/components/marketing/ExpandableParagraphs';
import { RegiaoLinks } from '@/components/marketing/RegiaoLinks';
import { SetMobileDockConfig } from '@/components/marketing/mobile-dock-config';
import { SpecTable } from '@/components/marketing/SpecTable';
import { AddToQuoteButton } from '@/components/quote-cart/AddToQuoteButton';
import { JsonLd } from '@/components/seo/JsonLd';
import { getRegioesForCategory } from '@/data/regioes';
import { buildEquipmentWhatsAppUrl, equipmentSeoTitle } from '@/lib/brand';
import {
  getAllSlugs,
  getEquipmentBySlug,
  getEquipmentQuoteCartKind,
  getRelatedEquipment,
} from '@/lib/equipment';
import { getEquipmentGalleryImages, getResolvedEquipmentImageMap } from '@/lib/equipment-images-server';
import { getEquipmentSeoExtra } from '@/lib/equipment-seo-extra';
import {
  buildEquipmentMetaDescription,
  getEquipmentPageBodyDescription,
} from '@/lib/equipment-meta-description';
import { hasEquipmentLongDescription } from '@/lib/equipment-long-description';
import { buildEquipmentPageJsonLd } from '@/lib/json-ld';
import { buildMarketingMetadata } from '@/lib/seo-metadata';
import { Link } from '@/libs/I18nNavigation';
import { routing } from '@/libs/I18nRouting';
import { CATEGORY_LABELS } from '@/types/equipment';
import { resolveAppLocale } from '@/utils/locale';

type EquipmentDetailProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateStaticParams() {
  const slugs = await getAllSlugs();
  return routing.locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

export async function generateMetadata(props: EquipmentDetailProps): Promise<Metadata> {
  const slug = (await props.params)?.slug;
  if (!slug) {
    return { title: 'Equipamento' };
  }
  const equipment = await getEquipmentBySlug(slug);
  if (!equipment) {
    return { title: 'Equipamento' };
  }
  return buildMarketingMetadata({
    title: equipmentSeoTitle(equipment.name),
    description: buildEquipmentMetaDescription(equipment),
    path: `/equipamentos/${equipment.slug}`,
    ogPath: `/equipamentos/${equipment.slug}/opengraph-image`,
  });
}

export default async function EquipmentDetailPage(props: EquipmentDetailProps) {
  const params = await props.params;
  const locale = resolveAppLocale(params?.locale ?? routing.defaultLocale);
  const slug = params?.slug;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'EquipamentoDetail',
  });

  if (!slug) {
    notFound();
  }
  const equipment = await getEquipmentBySlug(slug);

  if (!equipment) {
    notFound();
  }

  const whatsappHref = buildEquipmentWhatsAppUrl(equipment);
  const [related, imageBySlug, galleryImages] = await Promise.all([
    getRelatedEquipment(slug),
    getResolvedEquipmentImageMap(),
    getEquipmentGalleryImages(equipment.slug, equipment.name),
  ]);
  const seoExtra = getEquipmentSeoExtra(equipment);
  const pageBodyDescription = getEquipmentPageBodyDescription(equipment);
  const showTechnicalSection = hasEquipmentLongDescription(equipment);
  const laudoHref = equipment.laudoUrl?.trim() || null;
  const laudoLabel = equipment.laudoLabel?.trim() || t('laudo_link_default');

  return (
    <>
      <EquipmentViewTracker name={equipment.name} slug={equipment.slug} />
      <JsonLd data={buildEquipmentPageJsonLd(equipment, galleryImages.map((image) => image.src))} />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <Link
          className="text-xs font-medium text-primary hover:underline sm:text-sm"
          href={`/categorias/${equipment.category}`}
        >
          ← {t('back_to_category', { category: CATEGORY_LABELS[equipment.category] })}
        </Link>

        <div className="mt-4 grid gap-6 lg:mt-6 lg:grid-cols-2 lg:gap-10">
          <EquipmentDetailImage images={galleryImages} name={equipment.name} slug={equipment.slug} />

          <div>
            <Link
              className="text-xs font-semibold tracking-wide text-primary uppercase hover:underline sm:text-sm"
              href={`/categorias/${equipment.category}`}
            >
              {CATEGORY_LABELS[equipment.category]}
            </Link>
            <h1 className="mt-2 font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
              {equipment.name}
            </h1>

            {!showTechnicalSection && pageBodyDescription ? (
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-neutral-600 sm:line-clamp-none sm:text-base">
                {pageBodyDescription}
              </p>
            ) : null}

            {!showTechnicalSection && laudoHref ? (
              <EquipmentLaudoLink
                downloadHint={t('laudo_download_hint')}
                href={laudoHref}
                label={laudoLabel}
              />
            ) : null}

            <div className="mt-4 flex flex-col gap-3 sm:mt-6">
              <AddToQuoteButton
                className="w-full sm:max-w-md"
                item={{
                  slug: equipment.slug,
                  name: equipment.name,
                  kind: getEquipmentQuoteCartKind(equipment),
                }}
                size="md"
              />
              <ConversionCtas
                equipmentName={equipment.name}
                equipmentSlug={equipment.slug}
                quoteLabel={t('cta_quote')}
                whatsappHref={whatsappHref}
                whatsappLabel={t('cta_whatsapp')}
                whatsappOrigin="site-detalhe"
              />
            </div>
            <div aria-hidden className="h-0" id="equipment-hero-sentinel" />

            <div className="mt-6">
              <SpecTable
                specs={equipment.specs}
                title={t('specs_title')}
                variant={equipment.category === 'plataformas-elevatorias' ? 'aerial' : 'default'}
              />
            </div>

            {showTechnicalSection && pageBodyDescription ? (
              <section className="mt-6">
                <h2 className="font-heading text-base font-semibold text-neutral-900 sm:text-lg">
                  {t('technical_description_title')}
                </h2>
                <p className="mt-2 hidden text-sm leading-relaxed text-neutral-600 sm:block sm:text-base">
                  {pageBodyDescription}
                </p>
                <details className="mt-2 sm:hidden">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-primary marker:content-none hover:underline [&::-webkit-details-marker]:hidden">
                    {t('technical_read_more')}
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600">{pageBodyDescription}</p>
                </details>
                {laudoHref ? (
                  <EquipmentLaudoLink
                    downloadHint={t('laudo_download_hint')}
                    href={laudoHref}
                    label={laudoLabel}
                  />
                ) : null}
              </section>
            ) : showTechnicalSection && laudoHref ? (
              <section className="mt-6">
                <h2 className="font-heading text-base font-semibold text-neutral-900 sm:text-lg">
                  {t('technical_description_title')}
                </h2>
                <EquipmentLaudoLink
                  downloadHint={t('laudo_download_hint')}
                  href={laudoHref}
                  label={laudoLabel}
                />
              </section>
            ) : null}

            {seoExtra ? (
              <section className="mt-6">
                <h2 className="font-heading text-base font-semibold text-neutral-900 sm:text-lg">
                  {seoExtra.commercialOnly ? t('seo_quote_title') : seoExtra.title}
                </h2>
                <ExpandableParagraphs
                  className="mt-3"
                  paragraphs={seoExtra.paragraphs}
                  readMoreLabel={t('seo_read_more', { name: equipment.name })}
                />
              </section>
            ) : null}

            <RegiaoLinks
              className="mt-8"
              regioes={getRegioesForCategory(equipment.category)}
              title={t('regions_title')}
            />
          </div>
        </div>

        <section
          aria-labelledby="equipment-detail-cta-title"
          className="mt-10 rounded-[var(--radius-card)] border border-primary/15 bg-primary/[0.04] p-5 sm:mt-12 sm:p-6"
        >
          <h2
            className="text-center font-heading text-lg font-bold text-neutral-900"
            id="equipment-detail-cta-title"
          >
            {t('detail_cta_title', { name: equipment.name })}
          </h2>
          <p className="mt-1 text-center text-sm text-neutral-600">{t('detail_cta_subtitle')}</p>
          <ConversionCtas
            className="mt-4 justify-center"
            equipmentName={equipment.name}
            equipmentSlug={equipment.slug}
            quoteLabel={t('cta_quote')}
            size="sm"
            whatsappHref={whatsappHref}
            whatsappLabel={t('cta_whatsapp')}
            whatsappOrigin="site-detalhe-cta"
          />
        </section>

        {related.length > 0 && (
          <section className="mt-12 border-t border-neutral-200 pt-10 sm:mt-16 sm:pt-12">
            <h2 className="font-heading text-xl font-bold text-neutral-900 sm:text-2xl">
              {t('related_title')}
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
              {related.map((item) => (
                <EquipmentCard
                  equipment={item}
                  imageSrc={imageBySlug[item.slug]}
                  key={item.slug}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <SetMobileDockConfig
        equipmentName={equipment.name}
        equipmentSlug={equipment.slug}
        quoteLabel={t('cta_quote')}
        sentinelId="equipment-hero-sentinel"
        whatsappHref={whatsappHref}
        whatsappLabel={t('cta_whatsapp')}
        whatsappOrigin="site-detalhe-sticky"
      />
    </>
  );
}
