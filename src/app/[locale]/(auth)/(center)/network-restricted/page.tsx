import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { resolveAppLocale } from '@/utils/locale';

type NetworkRestrictedPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: NetworkRestrictedPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'NetworkRestrictedPage',
  });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
    robots: { index: false, follow: false },
  };
}

export default async function NetworkRestrictedPage(props: NetworkRestrictedPageProps) {
  const { locale } = await props.params;
  const resolvedLocale = resolveAppLocale(locale);
  setRequestLocale(resolvedLocale);
  const t = await getTranslations({
    locale: resolvedLocale,
    namespace: 'NetworkRestrictedPage',
  });

  return (
    <main className="mx-auto max-w-lg px-6 py-12 text-center">
      <h1 className="font-heading text-2xl font-bold text-neutral-900">{t('title')}</h1>
    </main>
  );
}
