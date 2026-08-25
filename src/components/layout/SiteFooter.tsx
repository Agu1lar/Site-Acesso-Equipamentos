import { getTranslations } from 'next-intl/server';
import { CookiePreferencesLink } from '@/components/analytics/CookiePreferencesLink';
import { TrackedPhoneLink } from '@/components/TrackedPhoneLink';
import { TrackedWhatsAppLink } from '@/components/analytics/TrackedWhatsAppLink';
import { InstagramIcon, LinkedInIcon, WhatsAppIcon } from '@/components/layout/SocialIcons';
import { getRegiaoBySlug } from '@/data/regioes';
import { brand, buildWhatsAppMessage, buildWhatsAppUrl } from '@/lib/brand';
import { Link } from '@/libs/I18nNavigation';
import { AppConfig } from '@/utils/AppConfig';

const FOOTER_REGION_SLUGS = [
  'belo-horizonte',
  'contagem',
  'betim',
  'nova-lima',
] as const;

export async function SiteFooter() {
  const t = await getTranslations('Footer');
  const whatsappFooter = buildWhatsAppUrl(buildWhatsAppMessage({ origin: 'site-footer' }));
  const footerRegioes = FOOTER_REGION_SLUGS.map((slug) => getRegiaoBySlug(slug)).filter(
    (regiao): regiao is NonNullable<typeof regiao> => Boolean(regiao),
  );

  return (
    <footer className="border-t border-neutral-200 bg-neutral-900 text-neutral-300">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 lg:px-8 xl:grid-cols-5">
        <div className="min-w-0">
          <p className="font-heading text-lg font-semibold text-white">{AppConfig.name}</p>
          <p className="mt-2 text-sm leading-relaxed">{brand.footerTagline}</p>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-white">{t('links')}</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link className="hover:text-white" href="/equipamentos">
                Equipamentos
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/solucoes">
                {t('solucoes_link')}
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/regioes">
                {t('regioes_link')}
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/treinamento-plataformas-aereas">
                Treinamento — plataformas elevatórias
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/faq">
                Perguntas frequentes
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/dicas">
                {t('dicas_link')}
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/sobre">
                Sobre
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/orcamento">
                Orçamento
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/privacidade">
                {t('privacy_link')}
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/sign-in">
                {t('admin_area_link')}
              </Link>
            </li>
            <li>
              <CookiePreferencesLink />
            </li>
          </ul>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-white">{t('regioes_title')}</p>
          <ul className="mt-3 space-y-2 text-sm">
            {footerRegioes.map((regiao) => (
              <li key={regiao.slug}>
                <Link className="hover:text-white" href={`/regioes/${regiao.slug}`}>
                  {regiao.name}
                </Link>
              </li>
            ))}
            <li>
              <Link className="font-medium text-white hover:underline" href="/regioes">
                {t('regioes_link')} →
              </Link>
            </li>
          </ul>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-white">{t('contact')}</p>
          <ul className="mt-3 space-y-3 text-sm">
            <li>
              <TrackedPhoneLink
                className="hover:text-white"
                href={`tel:+55${brand.phone}`}
                origin="site-footer-ligar"
              >
                {brand.phoneDisplay}
              </TrackedPhoneLink>
            </li>
            <li>
              <TrackedWhatsAppLink
                className="inline-flex items-center gap-2 hover:text-white"
                href={whatsappFooter}
                origin="site-footer"
                rel="noopener noreferrer"
                target="_blank"
              >
                <WhatsAppIcon className="h-4 w-4 shrink-0 text-cta-whatsapp" />
                {brand.whatsappDisplay}
              </TrackedWhatsAppLink>
            </li>
            <li className="min-w-0">
              <a
                className="block max-w-full break-words hover:text-white"
                href={`mailto:${brand.email}`}
              >
                {brand.email}
              </a>
            </li>
            <li className="flex flex-wrap gap-4 pt-1">
              <a
                aria-label={`Instagram @${brand.instagram}`}
                className="inline-flex items-center gap-2 hover:text-white"
                href={brand.instagramUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <InstagramIcon className="h-5 w-5 shrink-0" />
                <span className="sr-only sm:not-sr-only">@{brand.instagram}</span>
              </a>
              <a
                aria-label="LinkedIn Acesso Equipamentos"
                className="inline-flex items-center gap-2 hover:text-white"
                href={brand.linkedinUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <LinkedInIcon className="h-5 w-5 shrink-0" />
                <span className="sr-only sm:not-sr-only">LinkedIn</span>
              </a>
            </li>
          </ul>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-white">{t('address')}</p>
          <p className="mt-3 text-sm leading-relaxed">{brand.address.full}</p>
          <p className="mt-4 font-semibold text-white">{t('hours')}</p>
          <p className="mt-1 text-sm">{brand.hours}</p>
          <p className="mt-6 font-semibold text-white">{t('support_title')}</p>
          <p className="mt-3 text-sm leading-relaxed">{t('support_body')}</p>
          <a
            className="mt-2 inline-block max-w-full break-words text-sm font-medium text-white hover:underline"
            href={`mailto:${brand.techSupportEmail}`}
          >
            {brand.techSupportEmail}
          </a>
          <p className="mt-4 text-xs leading-relaxed text-muted-inverse">{t('developed_by')}</p>
        </div>
      </div>
      <div className="border-t border-neutral-800 py-4 text-center text-xs text-muted-inverse">
        {t('rights', { year: new Date().getFullYear(), name: AppConfig.name })}
      </div>
    </footer>
  );
}
