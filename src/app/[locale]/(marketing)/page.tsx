import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CategoryHomeGrid } from '@/components/marketing/CategoryHomeGrid';
import { ConversionCtas } from '@/components/marketing/ConversionCtas';
import { SetMobileDockConfig } from '@/components/marketing/mobile-dock-config';
import { ServiceAreaSection } from '@/components/marketing/ServiceAreaSection';
import { SolucaoSegmentGrid } from '@/components/marketing/SolucaoSegmentGrid';
import { StepsSection } from '@/components/marketing/StepsSection';
import { TestimonialsSection } from '@/components/marketing/TestimonialsSection';
import { HOME_CATEGORY_CARDS } from '@/data/home-category-cards';
import { getAllSolucoes } from '@/data/solucoes';
import { buildWhatsAppMessage, buildWhatsAppUrl } from '@/lib/brand';
import { getAllEquipment } from '@/lib/equipment';
import { getResolvedEquipmentImageMap } from '@/lib/equipment-images-server';
import { buildHomeCategoryImagePools } from '@/lib/home-category-images';
import { buildMarketingMetadata } from '@/lib/seo-metadata';
import { Link } from '@/libs/I18nNavigation';
import { resolveAppLocale } from '@/utils/locale';

type IndexPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: IndexPageProps): Promise<Metadata> {
  const locale = resolveAppLocale((await props.params)?.locale);
  const t = await getTranslations({
    locale,
    namespace: 'Index',
  });
  return buildMarketingMetadata({
    title: t('meta_title'),
    description: t('meta_description'),
    path: '/',
  });
}

export default async function HomePage(props: IndexPageProps) {
  const locale = resolveAppLocale((await props.params)?.locale);
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'Index',
  });
  const tLayout = await getTranslations({
    locale,
    namespace: 'RootLayout',
  });
  const tServiceArea = await getTranslations({
    locale,
    namespace: 'ServiceArea',
  });
  const [imageBySlug, equipment] = await Promise.all([
    getResolvedEquipmentImageMap(),
    getAllEquipment(),
  ]);
  const categoryImagePools = buildHomeCategoryImagePools(equipment, imageBySlug);
  const solucoes = getAllSolucoes();
  const whatsappHome = buildWhatsAppUrl(buildWhatsAppMessage({ origin: 'site-home' }));

  return (
    <>
      <section className="relative flex min-h-[clamp(360px,54vw,660px)] items-center overflow-hidden border-b border-neutral-200">
        <Image
          alt=""
          aria-hidden
          className="object-cover object-center"
          fill
          priority
          sizes="100vw"
          src="/assets/images/home-hero-background.jpg"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-neutral-900/60 via-neutral-900/45 to-neutral-900/70"
        />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="font-heading text-2xl leading-snug font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
              {t('hero_title')}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-neutral-100 sm:mt-6 sm:text-lg">
              {t('hero_subtitle')}
            </p>
            <ConversionCtas
              className="mt-6 justify-center sm:mt-8"
              onDark
              quoteLabel={t('hero_cta_quote')}
              size="lg"
              whatsappHref={whatsappHome}
              whatsappLabel={t('hero_cta_whatsapp')}
              whatsappOrigin="site-home"
            />
            <div aria-hidden className="h-0" id="page-hero-sentinel" />
          </div>
        </div>
      </section>

      <ServiceAreaSection
        eyebrow={tServiceArea('eyebrow')}
        hubLinkLabel={tServiceArea('hub_link')}
        moreLabel={tServiceArea('more_label')}
        primaryLabel={tServiceArea('primary_label')}
        title={tServiceArea('title')}
      />

      <section className="cv-auto mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="font-heading text-2xl font-bold text-neutral-900">
          {t('categories_title')}
        </h2>
        <CategoryHomeGrid
          cards={HOME_CATEGORY_CARDS}
          ctaLabel={t('category_card_cta')}
          imagePools={categoryImagePools}
        />
      </section>

      <section className="cv-auto bg-neutral-50">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <span aria-hidden className="block h-1 w-12 bg-primary" />
              <h2 className="mt-4 font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
                {t('solutions_title')}
              </h2>
              <p className="mt-3 text-neutral-600">{t('solutions_subtitle')}</p>
            </div>
            <Link
              className="shrink-0 text-sm font-semibold text-primary hover:underline"
              href="/solucoes"
            >
              {t('solutions_view_all')}
            </Link>
          </div>
          <SolucaoSegmentGrid
            className="mt-10"
            ctaLabel={t('solutions_card_cta')}
            solucoes={solucoes}
          />
        </div>
      </section>

      <StepsSection
        steps={[
          {
            number: t('step1_number'),
            title: t('step1_title'),
            description: t('step1_description'),
          },
          {
            number: t('step2_number'),
            title: t('step2_title'),
            description: t('step2_description'),
          },
          {
            number: t('step3_number'),
            title: t('step3_title'),
            description: t('step3_description'),
          },
        ]}
        subtitle={t('steps_subtitle')}
        title={t('steps_title')}
      />

      <TestimonialsSection
        subtitle={t('testimonials_subtitle')}
        title={t('testimonials_title')}
        viewAllLabel={t('testimonials_view_all')}
      />

      <section className="cv-auto mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-center font-heading text-2xl font-bold text-neutral-900">
          {t('trust_title')}
        </h2>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[t('trust_founded'), t('trust_team'), t('trust_delivery'), t('trust_compliance')].map(
            (item) => (
              <li
                className="rounded-[var(--radius-card)] border border-neutral-200 bg-surface p-6 text-center text-sm font-medium text-neutral-700"
                key={item}
              >
                {item}
              </li>
            ),
          )}
        </ul>
      </section>

      <section className="bg-neutral-900 px-4 py-16 text-center sm:px-6">
        <h2 className="font-heading text-2xl font-bold text-white">{t('cta_final_title')}</h2>
        <p className="mx-auto mt-3 max-w-lg text-neutral-400">{t('cta_final_subtitle')}</p>
        <ConversionCtas
          className="mt-8 justify-center"
          onDark
          quoteLabel={t('hero_cta_quote')}
          size="lg"
          whatsappHref={whatsappHome}
          whatsappLabel={t('hero_cta_whatsapp')}
          whatsappOrigin="site-home"
        />
      </section>

      <SetMobileDockConfig
        quoteLabel={t('hero_cta_quote')}
        sentinelId="page-hero-sentinel"
        whatsappHref={whatsappHome}
        whatsappLabel={tLayout('whatsapp_link')}
        whatsappOrigin="site-home-sticky"
      />
    </>
  );
}
