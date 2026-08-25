import Image from 'next/image';
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

      <section
        aria-labelledby="solucoes-hero-title"
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
              id="solucoes-hero-title"
            >
              {t('hero_title')}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">
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

          <div className="relative min-h-[280px] sm:min-h-[400px] lg:min-h-[520px]">
            <Image
              alt={t('hero_image_alt')}
              className="object-cover brightness-[1.08] contrast-[1.03] saturate-[1.05]"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              src="/solucoes/industria-hero.webp"
            />
          </div>
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
