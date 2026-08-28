import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MarketingBreadcrumb } from '@/components/marketing/MarketingBreadcrumb';
import { brand } from '@/lib/brand';
import { buildMarketingMetadata } from '@/lib/seo-metadata';
import { Link } from '@/libs/I18nNavigation';
import { resolveAppLocale } from '@/utils/locale';

type TermosPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: TermosPageProps): Promise<Metadata> {
  const locale = resolveAppLocale((await props.params)?.locale);
  const t = await getTranslations({
    locale,
    namespace: 'TermosPage',
  });

  return buildMarketingMetadata({
    title: t('meta_title'),
    description: t('meta_description'),
    path: '/termos',
  });
}

export default async function TermosPage(props: TermosPageProps) {
  const locale = resolveAppLocale((await props.params)?.locale);
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'TermosPage',
  });

  const sections = ['service', 'quotes', 'use', 'liability', 'changes'] as const;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <MarketingBreadcrumb
        className="mb-8"
        items={[
          { label: t('breadcrumb_home'), href: '/' },
          { label: t('title') },
        ]}
      />
      <h1 className="font-heading text-3xl font-bold text-neutral-900">{t('title')}</h1>
      <p className="mt-4 text-sm text-muted">{t('updated_at')}</p>
      <p className="mt-6 leading-relaxed text-neutral-700">{t('intro')}</p>

      <div className="mt-10 space-y-8">
        {sections.map((key) => (
          <section key={key}>
            <h2 className="font-heading text-xl font-semibold text-neutral-900">
              {t(`sections.${key}.title`)}
            </h2>
            <p className="mt-3 leading-relaxed text-neutral-700">{t(`sections.${key}.body`)}</p>
          </section>
        ))}
      </div>

      <p className="mt-12 text-sm text-neutral-600">
        {t('contact_line')}{' '}
        <a className="font-medium text-primary hover:underline" href={`mailto:${brand.email}`}>
          {brand.email}
        </a>
        . {t('privacy_link_prefix')}{' '}
        <Link className="font-medium text-primary hover:underline" href="/privacidade">
          {t('privacy_link')}
        </Link>
        .
      </p>
    </div>
  );
}
