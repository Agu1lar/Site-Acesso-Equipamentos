import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { ConversionCtas } from '@/components/marketing/ConversionCtas';
import { JsonLd } from '@/components/seo/JsonLd';
import { getAllRegioes, focusLabel } from '@/data/regioes';
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
      <section className="relative overflow-hidden bg-neutral-950 text-white">
        <div className="absolute inset-0">
          <Image
            alt=""
            className="object-cover opacity-55"
            fill
            priority
            sizes="100vw"
            src="/regioes/belo-horizonte-hero.webp"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/85 to-neutral-950/35" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
            {t('hero_eyebrow')}
          </p>
          <h1 className="mt-3 max-w-3xl font-heading text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            {t('hero_title')}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-neutral-200 sm:text-lg">
            {t('hero_subtitle')}
          </p>
          <ConversionCtas
            className="mt-8"
            onDark
            quoteLabel={t('cta_quote')}
            size="md"
            whatsappHref={whatsappHref}
            whatsappLabel={t('cta_whatsapp')}
            whatsappOrigin="site-regioes"
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
            {t('list_title')}
          </h2>
          <p className="mt-3 text-neutral-600">{t('list_subtitle')}</p>
        </div>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {regioes.map((regiao) => (
            <li key={regiao.slug}>
              <Link
                className="group block overflow-hidden rounded-[var(--radius-card)] border border-neutral-200 bg-white shadow-sm transition hover:border-primary/30 hover:shadow-md"
                href={`/regioes/${regiao.slug}`}
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-neutral-100">
                  <Image
                    alt={regiao.heroAlt}
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    src={regiao.heroImage}
                  />
                </div>
                <div className="p-5">
                  <p className="text-[11px] font-semibold tracking-wider text-primary uppercase">
                    {focusLabel(regiao.focus)}
                  </p>
                  <h3 className="mt-1 font-heading text-xl font-bold text-neutral-900 group-hover:text-primary">
                    {regiao.name}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-neutral-600">
                    {regiao.tagline}
                  </p>
                  <p className="mt-4 text-sm font-semibold text-primary">
                    {t('card_cta')}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
