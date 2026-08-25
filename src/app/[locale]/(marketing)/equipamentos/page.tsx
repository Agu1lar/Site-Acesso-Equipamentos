import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EquipmentCatalog } from '@/components/marketing/EquipmentCatalog';
import { MarketingBreadcrumb } from '@/components/marketing/MarketingBreadcrumb';
import { SetMobileDockConfig } from '@/components/marketing/mobile-dock-config';
import { JsonLd } from '@/components/seo/JsonLd';
import { buildWhatsAppMessage, buildWhatsAppUrl } from '@/lib/brand';
import { getAllEquipment } from '@/lib/equipment';
import { getResolvedEquipmentImageMap } from '@/lib/equipment-images-server';
import { buildEquipmentCatalogJsonLd } from '@/lib/json-ld';
import { buildMarketingMetadata } from '@/lib/seo-metadata';
import { resolveAppLocale } from '@/utils/locale';

type EquipamentosPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; categoria?: string }>;
};

/** @see MARKETING_ISR_REVALIDATE_SECONDS in @/lib/isr-revalidate */
export const revalidate = 86_400;

export async function generateMetadata(props: EquipamentosPageProps): Promise<Metadata> {
  const locale = resolveAppLocale((await props.params)?.locale);
  const t = await getTranslations({
    locale,
    namespace: 'Equipamentos',
  });
  return buildMarketingMetadata({
    title: t('meta_title'),
    description: t('meta_description'),
    path: '/equipamentos',
  });
}

export default async function EquipamentosPage(props: EquipamentosPageProps) {
  const locale = resolveAppLocale((await props.params)?.locale);
  const { q, categoria } = await props.searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'Equipamentos',
  });
  const tLayout = await getTranslations({
    locale,
    namespace: 'RootLayout',
  });
  const [equipment, imageBySlug] = await Promise.all([
    getAllEquipment(),
    getResolvedEquipmentImageMap(),
  ]);
  const whatsappHref = buildWhatsAppUrl(buildWhatsAppMessage({ origin: 'site-catalogo' }));

  return (
    <>
      <JsonLd data={buildEquipmentCatalogJsonLd(equipment)} />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <MarketingBreadcrumb
          items={[
            { label: t('breadcrumb_home'), href: '/' },
            { label: t('title') },
          ]}
        />
        <h1 className="mt-4 font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
          {t('title')}
        </h1>
        <div aria-hidden className="h-0" id="page-hero-sentinel" />
        <EquipmentCatalog
          equipment={equipment}
          imageBySlug={imageBySlug}
          initialCategory={categoria ?? ''}
          initialQuery={q ?? ''}
        />
      </div>

      <SetMobileDockConfig
        quoteLabel={tLayout('orcamento_link')}
        sentinelId="page-hero-sentinel"
        whatsappHref={whatsappHref}
        whatsappLabel={tLayout('whatsapp_link')}
        whatsappOrigin="site-catalogo-sticky"
      />
    </>
  );
}
