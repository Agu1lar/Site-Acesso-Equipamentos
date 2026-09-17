import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { notFound } from 'next/navigation';
import { AiDiscoveryHeadLinks } from '@/components/seo/AiDiscoveryHeadLinks';
import { getMarketingRobotsMetadata } from '@/lib/seo-metadata';
import { withSiteOpenGraph } from '@/lib/site-metadata';
import { routing } from '@/libs/I18nRouting';
import { shouldBlockSearchIndexing } from '@/utils/deployment';
import { resolveAppLocale } from '@/utils/locale';
import '@/styles/global.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'optional',
  weight: ['600', '700'],
  adjustFontFallback: true,
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'optional',
  weight: ['400', '500', '600'],
  adjustFontFallback: true,
});

export const metadata: Metadata = withSiteOpenGraph({
  title: {
    default: 'Acesso Equipamentos — Locação em Belo Horizonte',
    template: '%s | Acesso Equipamentos',
  },
  description:
    'Locação de plataformas elevatórias, andaimes e equipamentos para construção civil na região metropolitana de BH.',
  robots: getMarketingRobotsMetadata(),
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-96.png', type: 'image/png', sizes: '96x96' },
      { url: '/favicon-48.png', type: 'image/png', sizes: '48x48' },
      { url: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon.ico', sizes: '48x48' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveAppLocale((await props.params)?.locale ?? routing.defaultLocale);

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html className={`${plusJakarta.variable} ${inter.variable}`} lang={locale}>
      <head>
        {shouldBlockSearchIndexing() ? null : <AiDiscoveryHeadLinks />}
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {props.children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
