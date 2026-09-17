'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { TrackedWhatsAppLink } from '@/components/analytics/TrackedWhatsAppLink';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { GlobalSearch } from '@/components/marketing/GlobalSearch';
import type { SearchIndexItem } from '@/components/marketing/GlobalSearch';
import { QuoteCartNavLink } from '@/components/quote-cart/QuoteCartNavLink';
import { Button } from '@/components/ui/Button';
import { buildWhatsAppMessage, buildWhatsAppUrl } from '@/lib/brand';
import { Link } from '@/libs/I18nNavigation';

type SiteHeaderProps = {
  searchIndex: SearchIndexItem[];
};

const navLinks = [
  { href: '/', key: 'home_link' as const },
  { href: '/equipamentos', key: 'equipamentos_link' as const },
  { href: '/solucoes', key: 'solucoes_link' as const },
  { href: '/regioes', key: 'regioes_link' as const },
  { href: '/treinamento', key: 'treinamento_link' as const },
  { href: '/dicas', key: 'blog_link' as const },
  { href: '/sobre', key: 'sobre_link' as const },
  { href: '/contato', key: 'contato_link' as const },
];

/**
 * Sticky marketing header with a fixed layout (no scroll-compact resize).
 * Height changes on scroll were the main mobile CLS contributor in CrUX.
 */
export function SiteHeader({ searchIndex }: SiteHeaderProps) {
  const t = useTranslations('RootLayout');
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const whatsappHeader = buildWhatsAppUrl(buildWhatsAppMessage({ origin: 'site-header' }));

  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-surface/95 shadow-[var(--shadow-header)] backdrop-blur-sm [overflow-anchor:none]">
      <div
        className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-2 px-2 py-2 sm:gap-x-3 sm:px-4 lg:px-6"
        style={{
          gridTemplateAreas: '"logo nav" "search search"',
        }}
      >
        <Link
          aria-label="Acesso Equipamentos — início"
          className="block shrink-0 leading-none"
          href="/"
          style={{ gridArea: 'logo' }}
        >
          <div className="flex h-14 items-center overflow-hidden sm:h-16">
            <BrandLogo />
          </div>
        </Link>

        <div className="flex min-w-0 items-center" style={{ gridArea: 'search' }}>
          <GlobalSearch className="w-full" id="global-search" index={searchIndex} />
        </div>

        <div
          className="flex shrink-0 items-center justify-end gap-1.5 self-center sm:gap-2"
          style={{ gridArea: 'nav' }}
        >
          <nav aria-label="Principal" className="hidden items-center gap-4 md:flex lg:gap-6">
            {navLinks.map((link) => (
              <Link
                className="text-sm font-medium text-neutral-700 transition-colors hover:text-primary"
                href={link.href}
                key={link.href}
              >
                {t(link.key)}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Button
              href={whatsappHeader}
              size="sm"
              variant="whatsapp"
              whatsappOrigin="site-header"
            >
              {t('whatsapp_link')}
            </Button>
            <QuoteCartNavLink label={t('orcamento_link')} />
          </div>

          <button
            aria-controls="site-mobile-nav"
            aria-expanded={mobileOpen}
            aria-label="Menu"
            className="rounded-lg p-2 text-neutral-700 hover:bg-neutral-100 md:hidden"
            onClick={() => {
              setMobileOpen((open) => !open);
            }}
            ref={menuButtonRef}
            type="button"
          >
            <MenuIcon open={mobileOpen} />
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <nav className="border-t border-neutral-100 px-4 py-3 md:hidden" id="site-mobile-nav">
          <ul className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  className="block rounded-lg px-3 py-2 text-neutral-800 hover:bg-background-muted"
                  href={link.href}
                  onClick={() => {
                    setMobileOpen(false);
                  }}
                >
                  {t(link.key)}
                </Link>
              </li>
            ))}
            <li>
              <TrackedWhatsAppLink
                className="block rounded-lg bg-cta-whatsapp px-3 py-2 text-center font-semibold text-white"
                href={whatsappHeader}
                onClick={() => {
                  setMobileOpen(false);
                }}
                origin="site-header"
                rel="noopener noreferrer"
                target="_blank"
              >
                {t('whatsapp_link')}
              </TrackedWhatsAppLink>
            </li>
            <li>
              <QuoteCartNavLink
                className="block w-full justify-center rounded-lg border border-neutral-200 px-3 py-2 text-center"
                label={t('orcamento_link')}
              />
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg aria-hidden className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {open ? (
        <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeWidth={2} />
      ) : (
        <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeWidth={2} />
      )}
    </svg>
  );
}
