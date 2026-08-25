import Image from 'next/image';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ConversionCtas } from '@/components/marketing/ConversionCtas';
import { JsonLd } from '@/components/seo/JsonLd';
import { focusLabel, getAllRegioes } from '@/data/regioes';
import { buildWhatsAppMessage, buildWhatsAppUrl } from '@/lib/brand';
import { buildRegioesIndexJsonLd } from '@/lib/regioes-json-ld';
import { buildMarketingMetadata } from '@/lib/seo-metadata';
import { Link } from '@/libs/I18nNavigation';
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

      {/* Mills-style split: copy on light panel, vivid photo without dark wash */}
      <section className="border-b border-neutral-200 bg-white">
        <div className="mx-auto grid max-w-7xl lg:grid-cols-2">
          <div className="flex flex-col justify-center px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
            <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
              {t('hero_eyebrow')}
            </p>
            <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              {t('hero_title')}
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-neutral-600 sm:text-lg">
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

          <div className="relative min-h-[280px] sm:min-h-[360px] lg:min-h-full">
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

      <section className="bg-neutral-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
              {t('list_title')}
            </h2>
            <p className="mt-3 text-neutral-600">{t('list_subtitle')}</p>
          </div>

          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {regioes.map((regiao) => (
              <li key={regiao.slug}>
                <Link
                  className="group flex h-full flex-col overflow-hidden border border-neutral-200 bg-white transition hover:border-primary/40 hover:shadow-[0_12px_40px_-16px_rgba(0,0,0,0.25)]"
                  href={`/regioes/${regiao.slug}`}
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-neutral-100">
                    <Image
                      alt={regiao.heroAlt}
                      className="object-cover transition duration-500 group-hover:scale-[1.04]"
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      src={regiao.heroImage}
                    />
                  </div>
                  <div className="flex flex-1 flex-col border-t-4 border-t-primary p-5">
                    <p className="text-[11px] font-semibold tracking-wider text-primary uppercase">
                      {focusLabel(regiao.focus)}
                    </p>
                    <h3 className="mt-1 font-heading text-xl font-bold text-neutral-900 group-hover:text-primary">
                      {regiao.name}
                    </h3>
                    <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-neutral-600">
                      {regiao.tagline}
                    </p>
                    <p className="mt-4 text-sm font-semibold text-primary">{t('card_cta')}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
