import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ConversionCtas } from '@/components/marketing/ConversionCtas';
import { SolucaoSegmentGrid } from '@/components/marketing/SolucaoSegmentGrid';
import { JsonLd } from '@/components/seo/JsonLd';
import { getAllSolucoes } from '@/data/solucoes';
import { buildWhatsAppMessage, buildWhatsAppUrl } from '@/lib/brand';
import { buildMarketingMetadata } from '@/lib/seo-metadata';
import { buildSolucoesIndexJsonLd } from '@/lib/solucoes-json-ld';
import { routing } from '@/libs/I18nRouting';
import { resolveAppLocale } from '@/utils/locale';

type SolucoesPageProps = {
  params: Promise<{ locale: string }>;
};

/** @see MARKETING_ISR_REVALIDATE_SECONDS in @/lib/isr-revalidate */
export const revalidate = 86_400;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(props: SolucoesPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'SolucoesPage',
  });
  return buildMarketingMetadata({
    title: t('meta_title'),
    description: t('meta_description'),
    path: '/solucoes',
  });
}

export default async function SolucoesPage(props: SolucoesPageProps) {
  const { locale } = await props.params;
  setRequestLocale(resolveAppLocale(locale));
  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'SolucoesPage',
  });
  const solucoes = getAllSolucoes();
  const whatsappHref = buildWhatsAppUrl(buildWhatsAppMessage({ origin: 'site-solucoes' }));

  return (
    <>
      <JsonLd data={buildSolucoesIndexJsonLd(solucoes)} />

      <section className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <p className="text-xs font-semibold tracking-[0.22em] text-primary uppercase">
            {t('hero_eyebrow')}
          </p>
          <h1 className="mt-4 max-w-3xl font-heading text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl lg:text-5xl lg:leading-[1.08]">
            {t('hero_title')}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-600 sm:text-lg">
            {t('hero_subtitle')}
          </p>
          <ConversionCtas
            className="mt-8"
            quoteLabel={t('cta_quote')}
            size="md"
            whatsappHref={whatsappHref}
            whatsappLabel={t('cta_whatsapp')}
            whatsappOrigin="site-solucoes"
          />
        </div>
      </section>

      <section className="bg-neutral-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-2xl">
            <span aria-hidden className="block h-1 w-12 bg-primary" />
            <h2 className="mt-4 font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
              {t('list_title')}
            </h2>
            <p className="mt-3 text-neutral-600">{t('list_subtitle')}</p>
          </div>
          <SolucaoSegmentGrid
            className="mt-10"
            ctaLabel={t('card_cta')}
            solucoes={solucoes}
          />
        </div>
      </section>
    </>
  );
}
