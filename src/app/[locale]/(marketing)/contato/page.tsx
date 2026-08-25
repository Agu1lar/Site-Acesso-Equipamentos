import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TrackedPhoneLink } from '@/components/TrackedPhoneLink';
import { TrackedWhatsAppLink } from '@/components/analytics/TrackedWhatsAppLink';
import { ConversionCtas } from '@/components/marketing/ConversionCtas';
import { ServiceAreaSection } from '@/components/marketing/ServiceAreaSection';
import { InstagramIcon, LinkedInIcon, WhatsAppIcon } from '@/components/layout/SocialIcons';
import { brand, buildWhatsAppMessage, buildWhatsAppUrl, seoTitle } from '@/lib/brand';
import { buildMarketingMetadata } from '@/lib/seo-metadata';
import { resolveAppLocale } from '@/utils/locale';

type PageProps = { params: Promise<{ locale: string }> };

const whatsappContato = buildWhatsAppUrl(buildWhatsAppMessage({ origin: 'site-contato' }));

export const metadata: Metadata = buildMarketingMetadata({
  title: seoTitle('Contato e orçamento'),
  description: `Telefone, WhatsApp, Instagram e endereço da ${brand.name} em Belo Horizonte. Atendimento comercial em horário útil para locação de equipamentos em Minas Gerais e em todo o Brasil.`,
  path: '/contato',
});

export default async function ContatoPage(props: PageProps) {
  const locale = resolveAppLocale((await props.params)?.locale);
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'ServiceArea',
  });

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="font-heading text-3xl font-bold text-neutral-900">Contato</h1>
        <ul className="mt-8 space-y-4 text-neutral-700">
          <li>
            <strong className="text-neutral-900">Telefone:</strong>{' '}
            <TrackedPhoneLink
              className="text-primary hover:underline"
              href={`tel:+55${brand.phone}`}
              origin="site-contato-ligar"
            >
              {brand.phoneDisplay}
            </TrackedPhoneLink>
          </li>
          <li>
            <strong className="text-neutral-900">Celular / WhatsApp:</strong>{' '}
            <TrackedWhatsAppLink
              className="inline-flex items-center gap-2 text-primary hover:underline"
              href={whatsappContato}
              origin="site-contato"
              rel="noopener noreferrer"
              target="_blank"
            >
              <WhatsAppIcon className="h-5 w-5 shrink-0 text-cta-whatsapp" />
              {brand.whatsappDisplay}
            </TrackedWhatsAppLink>
          </li>
          <li>
            <strong className="text-neutral-900">E-mail:</strong>{' '}
            <a className="text-primary hover:underline" href={`mailto:${brand.email}`}>
              {brand.email}
            </a>
          </li>
          <li>
            <strong className="text-neutral-900">Endereço:</strong> {brand.address.full}
          </li>
          <li>
            <strong className="text-neutral-900">Horário:</strong> {brand.hours}
          </li>
          <li>
            <strong className="text-neutral-900">Redes sociais:</strong>
            <ul className="mt-2 space-y-2">
              <li>
                <a
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                  href={brand.instagramUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <InstagramIcon className="h-5 w-5 shrink-0" />
                  @{brand.instagram}
                </a>
              </li>
              <li>
                <a
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                  href={brand.linkedinUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <LinkedInIcon className="h-5 w-5 shrink-0" />
                  LinkedIn — Acesso Equipamentos
                </a>
              </li>
            </ul>
          </li>
        </ul>
        <ConversionCtas
          className="mt-8"
          quoteLabel="Solicitar orçamento"
          whatsappHref={whatsappContato}
          whatsappLabel="Falar no WhatsApp"
          whatsappOrigin="site-contato"
        />
      </div>

      <ServiceAreaSection
        className="border-t-0"
        eyebrow={t('eyebrow')}
        hubLinkLabel={t('hub_link')}
        moreLabel={t('more_label')}
        primaryLabel={t('primary_label')}
        title={t('title')}
      />
    </>
  );
}
