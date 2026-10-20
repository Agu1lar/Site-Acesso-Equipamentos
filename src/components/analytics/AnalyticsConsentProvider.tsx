'use client';

import { Suspense, useEffect, useLayoutEffect, useState } from 'react';
import { AnalyticsConsentContext } from '@/components/analytics/AnalyticsConsentContext';
import { AnalyticsErrorBoundary } from '@/components/analytics/AnalyticsErrorBoundary';
import { CookieConsentBanner } from '@/components/analytics/CookieConsentBanner';
import { GaPageView } from '@/components/analytics/GaPageView';
import { GoogleAnalyticsScripts } from '@/components/analytics/GoogleAnalyticsScripts';
import type { GoogleOneTapManager } from '@/components/analytics/GoogleOneTapManager';
import type { PageEngagementTracker } from '@/components/analytics/PageEngagementTracker';
import type { PostHogAttributionSync } from '@/components/analytics/PostHogAttributionSync';
import type { PostHogPageView } from '@/components/analytics/PostHogPageView';
import type { ScrollDepthTracker } from '@/components/analytics/ScrollDepthTracker';
import { MetaPixel } from '@/components/analytics/MetaPixel';
import { revokeMetaPixelConsent } from '@/lib/meta-pixel';
import { COOKIE_CONSENT_STORAGE_KEY, parseConsentValue } from '@/lib/cookie-consent';
import type { CookieConsentStatus, CookieConsentValue } from '@/lib/cookie-consent';
import {
  denyGoogleAnalyticsConsent,
  grantGoogleAnalyticsConsent,
  isGoogleAnalyticsConfigured,
  syncGoogleAnalyticsConsentFromStorage,
} from '@/lib/google-analytics';
import { recordAnalyticsConsent } from '@/lib/record-analytics-consent';
import { captureVisitorGeoAfterConsent } from '@/lib/visitor-geo';

type DeferredAnalyticsModules = {
  GoogleOneTapManager: typeof GoogleOneTapManager;
  PageEngagementTracker: typeof PageEngagementTracker;
  PostHogAttributionSync: typeof PostHogAttributionSync;
  PostHogPageView: typeof PostHogPageView;
  ScrollDepthTracker: typeof ScrollDepthTracker;
};

type AnalyticsConsentProviderProps = {
  children: React.ReactNode;
};

function readStoredConsent(): CookieConsentStatus {
  if (typeof window === 'undefined') {
    return 'pending';
  }
  return parseConsentValue(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY));
}

function persistConsent(value: CookieConsentValue) {
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, value);
}

async function initializePostHog() {
  const { initPostHog } = await import('@/lib/posthog-client');
  initPostHog();
}

async function loadDeferredAnalytics(): Promise<DeferredAnalyticsModules> {
  const [googleOneTap, pageEngagement, postHogAttribution, postHogPageView, scrollDepth] =
    await Promise.all([
      import('@/components/analytics/GoogleOneTapManager'),
      import('@/components/analytics/PageEngagementTracker'),
      import('@/components/analytics/PostHogAttributionSync'),
      import('@/components/analytics/PostHogPageView'),
      import('@/components/analytics/ScrollDepthTracker'),
    ]);

  return {
    GoogleOneTapManager: googleOneTap.GoogleOneTapManager,
    PageEngagementTracker: pageEngagement.PageEngagementTracker,
    PostHogAttributionSync: postHogAttribution.PostHogAttributionSync,
    PostHogPageView: postHogPageView.PostHogPageView,
    ScrollDepthTracker: scrollDepth.ScrollDepthTracker,
  };
}

/**
 * Gates PostHog behind analytics cookie consent and shows the consent banner.
 */
export function AnalyticsConsentProvider(props: AnalyticsConsentProviderProps) {
  const [status, setStatus] = useState<CookieConsentStatus>(() =>
    typeof window === 'undefined' ? 'pending' : readStoredConsent(),
  );
  const [hydrated, setHydrated] = useState(false);
  const [deferredAnalytics, setDeferredAnalytics] = useState<DeferredAnalyticsModules | null>(null);

  useLayoutEffect(() => {
    const stored = readStoredConsent();
    setStatus(stored);
    setHydrated(true);
    if (stored === 'analytics' && isGoogleAnalyticsConfigured()) {
      grantGoogleAnalyticsConsent();
    } else {
      syncGoogleAnalyticsConsentFromStorage();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (status === 'analytics') {
      void initializePostHog();
      void loadDeferredAnalytics().then((modules) => {
        if (!cancelled) {
          setDeferredAnalytics(modules);
        }
      });
      grantGoogleAnalyticsConsent();
      void captureVisitorGeoAfterConsent();
    }

    return () => {
      cancelled = true;
    };
  }, [status]);

  const acceptAnalytics = () => {
    persistConsent('analytics');
    setStatus('analytics');
    void initializePostHog();
    grantGoogleAnalyticsConsent();
    void recordAnalyticsConsent('accept');
    void captureVisitorGeoAfterConsent();
  };

  const rejectAnalytics = () => {
    persistConsent('essential');
    setStatus('essential');
    denyGoogleAnalyticsConsent();
    revokeMetaPixelConsent();
    void recordAnalyticsConsent('reject');
  };

  const reopenBanner = () => {
    revokeMetaPixelConsent();
    window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY);
    setStatus('pending');
  };

  const showBanner = hydrated && status === 'pending';
  const analyticsOn = status === 'analytics';

  return (
    <AnalyticsConsentContext
      value={{
        status,
        acceptAnalytics,
        rejectAnalytics,
        reopenBanner,
      }}
    >
      <GoogleAnalyticsScripts />
      {hydrated && analyticsOn ? <Suspense fallback={null}><MetaPixel /></Suspense> : null}
      {props.children}
      {showBanner ? <CookieConsentBanner /> : null}
      {analyticsOn && deferredAnalytics ? (
        <AnalyticsErrorBoundary>
          <Suspense fallback={null}>
            <deferredAnalytics.GoogleOneTapManager />
            <GaPageView />
            <deferredAnalytics.PageEngagementTracker />
            <deferredAnalytics.PostHogAttributionSync />
            <deferredAnalytics.PostHogPageView />
            <deferredAnalytics.ScrollDepthTracker />
          </Suspense>
        </AnalyticsErrorBoundary>
      ) : null}
    </AnalyticsConsentContext>
  );
}
