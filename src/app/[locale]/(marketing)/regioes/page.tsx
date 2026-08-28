import Image from 'next/image';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ConversionCtas } from '@/components/marketing/ConversionCtas';
import { MarketingBreadcrumb } from '@/components/marketing/MarketingBreadcrumb';
import { RegiaoCityCard } from '@/components/marketing/RegiaoCityCard';
import { SeoPillarCrossLink } from '@/components/marketing/SeoPillarCrossLink';
import { JsonLd } from '@/components/seo/JsonLd';
import { getAllRegioes } from '@/data/regioes';
import { buildWhatsAppMessage, buildWhatsAppUrl } from '@/lib/brand';
import { buildRegioesIndexJsonLd } from '@/lib/regioes-json-ld';
import { buildMarketingMetadata } from '@/lib/seo-metadata';
import { routing } from '@/libs/I18nRouting';
import { resolveAppLocale } from '@/utils/locale';

type RegioesPageProps = {
  params: Promise<{ locale: string }>;
};

/** @see MARKETING_ISR_REVALIDATE_SECONDS in @/lib/isr-revalidate */
export const revalidate = 86_400;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(props: RegioesPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'RegioesPage',
  });
  return buildMarketingMetadata({
    title: t('meta_title'),
    description: t('meta_description'),
    path: '/regioes',
  });
}

export default async function RegioesPage(props: RegioesPageProps) {
  const { locale } = await props.params;
  setRequestLocale(resolveAppLocale(locale));
  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'RegioesPage',
  });
  const regioes = getAllRegioes();
  const whatsappHref = buildWhatsAppUrl(buildWhatsAppMessage({ origin: 'site-regioes' }));

  return (
    <>
      <JsonLd data={buildRegioesIndexJsonLd(regioes)} />

      <div className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <MarketingBreadcrumb
            items={[
              { label: t('breadcrumb_home'), href: '/' },
              { label: t('hero_title') },
            ]}
          />
        </div>
      </div>

      {/* Split hero — light copy panel + bright photo, no dark overlay. */}
      <section
        aria-labelledby="regioes-hero-title"
        className="border-b border-neutral-200 bg-white"
      >
        <div className="mx-auto grid max-w-7xl lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className="relative flex flex-col justify-center px-4 py-14 sm:px-6 sm:py-20 lg:px-10 lg:py-24">
            <span
              aria-hidden
              className="absolute top-16 left-0 hidden h-16 w-1 bg-primary lg:block"
            />
            <p className="text-xs font-semibold tracking-[0.22em] text-primary uppercase">
              {t('hero_eyebrow')}
            </p>
            <h1
              className="mt-4 max-w-xl font-heading text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl lg:text-5xl lg:leading-[1.08]"
              id="regioes-hero-title"
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
              whatsappOrigin="site-regioes"
            />
          </div>

          <div className="relative min-h-[280px] sm:min-h-[400px] lg:min-h-[560px]">
            <Image
              alt="Plataforma elevatória em operação industrial na região metropolitana de Belo Horizonte"
              className="object-cover brightness-[1.08] contrast-[1.02] saturate-[1.05]"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              src="/regioes/contagem-hero.webp"
            />
          </div>
        </div>
      </section>

      {/* City grid on soft-gray band with generous whitespace. */}
      <section aria-labelledby="regioes-list-title" className="bg-neutral-50">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="max-w-2xl">
            <span aria-hidden className="block h-1 w-12 bg-primary" />
            <h2
              className="mt-4 font-heading text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl lg:text-4xl"
              id="regioes-list-title"
            >
              {t('list_title')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-neutral-600">
              {t('list_subtitle')}
            </p>
          </div>

          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {regioes.map((regiao, index) => (
              <li key={regiao.slug}>
                <RegiaoCityCard
                  ctaLabel={t('card_cta')}
                  imagePriority={index < 3}
                  imageSizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  regiao={regiao}
                />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <SeoPillarCrossLink
        description={t('cross_link_solucoes_description')}
        href="/solucoes"
        linkLabel={t('cross_link_solucoes_cta')}
        title={t('cross_link_solucoes_title')}
      />
    </>
  );
}
