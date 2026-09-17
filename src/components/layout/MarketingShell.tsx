import { Suspense } from 'react';
import { AnalyticsConsentProvider } from '@/components/analytics/AnalyticsConsentProvider';
import { QuoteAbandonTracker } from '@/components/analytics/QuoteAbandonTracker';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { WhatsAppButton } from '@/components/layout/WhatsAppButton';
import { MarketingMobileBottomBar } from '@/components/marketing/MarketingMobileBottomBar';
import { MobileDockConfigProvider } from '@/components/marketing/mobile-dock-config';
import { AiDiscoveryCrawlerHints } from '@/components/seo/AiDiscoveryCrawlerHints';
import { SkipToMainLink } from '@/components/ui/SkipToMainLink';
import { AttributionCapture } from '@/components/marketing/AttributionCapture';
import { QuoteCartProvider } from '@/components/quote-cart/QuoteCartProvider';
import { getSearchIndex } from '@/lib/equipment';

type MarketingShellProps = {
  children: React.ReactNode;
};

/**
 * Header loads search index without blocking the main content stream (home LCP).
 */
async function MarketingHeader() {
  const searchIndex = await getSearchIndex();
  return <SiteHeader searchIndex={searchIndex} />;
}

function MarketingHeaderFallback() {
  return (
    <div
      aria-hidden
      className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-surface/95"
      style={{ height: 119 }}
    />
  );
}

export async function MarketingShell(props: MarketingShellProps) {
  return (
    <AnalyticsConsentProvider>
      <div className="flex min-h-screen flex-col">
        <SkipToMainLink />
        <AttributionCapture />
        <MobileDockConfigProvider>
          <QuoteCartProvider>
            <QuoteAbandonTracker />
            <Suspense fallback={<MarketingHeaderFallback />}>
              <MarketingHeader />
            </Suspense>
            <main className="flex-1 pb-28 md:pb-0" id="main-content">
              {props.children}
            </main>
            <SiteFooter />
            <AiDiscoveryCrawlerHints />
            <WhatsAppButton />
            <MarketingMobileBottomBar />
          </QuoteCartProvider>
        </MobileDockConfigProvider>
      </div>
    </AnalyticsConsentProvider>
  );
}
