'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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

/** Entra compacto abaixo deste Y; só expande acima do OFF (zona morta entre os dois) */
const SCROLL_COMPACT_ON = 160;
const SCROLL_COMPACT_OFF = 32;
const TOGGLE_LOCK_MS = 450;

const navLinks = [
  { href: '/', key: 'home_link' as const },
  { href: '/equipamentos', key: 'equipamentos_link' as const },
  { href: '/solucoes', key: 'solucoes_link' as const },
  { href: '/regioes', key: 'regioes_link' as const },
  { href: '/treinamento-plataformas-aereas', key: 'treinamento_link' as const },
  { href: '/dicas', key: 'blog_link' as const },
  { href: '/sobre', key: 'sobre_link' as const },
  { href: '/contato', key: 'contato_link' as const },
];

export function SiteHeader({ searchIndex }: SiteHeaderProps) {
  const t = useTranslations('RootLayout');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [spacerHeight, setSpacerHeight] = useState(0);

  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const compactRef = useRef(false);
  const heightsRef = useRef({ expanded: 0, compact: 0 });
  const lockedUntilRef = useRef(0);
  const scrollBeforeToggleRef = useRef(0);
  const pendingCompensationRef = useRef(0);
  const heightsReadyRef = useRef(false);

  const whatsappHeader = buildWhatsAppUrl(buildWhatsAppMessage({ origin: 'site-header' }));

  const applyCompact = useCallback((next: boolean) => {
    if (next === compactRef.current) {
      return;
    }
    if (Date.now() < lockedUntilRef.current) {
      return;
    }

    const { expanded, compact: compactH } = heightsRef.current;
    scrollBeforeToggleRef.current = window.scrollY;

    if (expanded > 0 && compactH > 0) {
      pendingCompensationRef.current = next ? expanded - compactH : compactH - expanded;
    }

    lockedUntilRef.current = Date.now() + TOGGLE_LOCK_MS;
    compactRef.current = next;
    setCompact(next);
  }, []);

  const evaluateScroll = useCallback(() => {
    if (Date.now() < lockedUntilRef.current || !heightsReadyRef.current) {
      return;
    }

    const y = window.scrollY;
    const isCompact = compactRef.current;

    if (isCompact) {
      if (y < SCROLL_COMPACT_OFF) {
        applyCompact(false);
      }
    } else if (y > SCROLL_COMPACT_ON) {
      applyCompact(true);
    }
  }, [applyCompact]);

  useEffect(() => {
    evaluateScroll();

    let ticking = false;
    const onScroll = () => {
      if (ticking) {
        return;
      }
      ticking = true;
      requestAnimationFrame(() => {
        evaluateScroll();
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () =>{  window.removeEventListener('scroll', onScroll); };
  }, [evaluateScroll]);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) {
      return;
    }

    const measured = header.offsetHeight;
    if (compact) {
      heightsRef.current.compact = measured;
      setSpacerHeight(measured);
    } else {
      heightsRef.current.expanded = measured;
      setSpacerHeight(0);
      heightsReadyRef.current = true;
    }

    const compensation = pendingCompensationRef.current;
    if (compensation !== 0) {
      pendingCompensationRef.current = 0;
      window.scrollTo({
        top: Math.max(0, scrollBeforeToggleRef.current + compensation),
        behavior: 'auto',
      });
    }
  }, [compact, mobileOpen]);

  useEffect(() => {
    if (!compact) {
      setMobileOpen(false);
    }
  }, [compact]);

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
    <>
      <div
        aria-hidden
        className="pointer-events-none w-full shrink-0"
        style={{ height: compact ? spacerHeight : 0 }}
      />

      <header
        ref={headerRef}
        className={`right-0 left-0 z-40 w-full border-b border-neutral-200 bg-surface/95 shadow-[var(--shadow-header)] backdrop-blur-sm [overflow-anchor:none] ${
          compact ? 'fixed top-0' : 'sticky top-0'
        }`}
      >
        <div
          className="mx-auto grid w-full max-w-7xl gap-x-2 gap-y-2 px-2 py-1.5 sm:gap-x-3 sm:px-4 sm:py-2 lg:px-6"
          style={{
            gridTemplateAreas: compact ? '"logo search nav"' : '"logo nav" "search search"',
            gridTemplateColumns: compact ? 'auto minmax(0, 1fr) auto' : '1fr auto',
          }}
        >
          <Link
            aria-label="Acesso Equipamentos — início"
            className="block shrink-0 leading-none"
            href="/"
            style={{ gridArea: 'logo' }}
          >
            <div
              className="flex items-center overflow-hidden transition-[height] duration-300 ease-out"
              style={{ height: compact ? 48 : undefined, minHeight: compact ? 48 : 80 }}
            >
              <BrandLogo compact={compact} />
            </div>
          </Link>

          <div className="flex min-w-0 items-center" style={{ gridArea: 'search' }}>
            <GlobalSearch
              className="w-full"
              compact={compact}
              id="global-search"
              index={searchIndex}
            />
          </div>

          <div
            className="flex shrink-0 items-center justify-end gap-1.5 self-center sm:gap-2"
            style={{ gridArea: 'nav' }}
          >
            <nav
              aria-label="Principal"
              className={`hidden items-center md:flex ${
                compact ? 'gap-3 lg:gap-5 xl:flex' : 'gap-4 lg:gap-6'
              }`}
            >
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
              className={`rounded-lg p-2 text-neutral-700 hover:bg-neutral-100 ${
                compact ? 'xl:hidden' : 'md:hidden'
              }`}
              onClick={() => {
                setMobileOpen((o) => !o);
              }}
              ref={menuButtonRef}
              type="button"
            >
              <MenuIcon open={mobileOpen} />
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className="border-t border-neutral-100 px-4 py-3 xl:hidden" id="site-mobile-nav">
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
        )}
      </header>
    </>
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
