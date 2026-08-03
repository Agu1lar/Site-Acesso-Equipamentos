'use client';

import { Suspense, useEffect, useLayoutEffect, useState } from 'react';
import { AnalyticsConsentContext } from '@/components/analytics/AnalyticsConsentContext';
import { AnalyticsErrorBoundary } from '@/components/analytics/AnalyticsErrorBoundary';
import { CookieConsentBanner } from '@/components/analytics/CookieConsentBanner';
import { GoogleOneTapManager } from '@/components/analytics/GoogleOneTapManager';
import { GaPageView } from '@/components/analytics/GaPageView';
import { GoogleAnalyticsScripts } from '@/components/analytics/GoogleAnalyticsScripts';
import { PostHogAttributionSync } from '@/components/analytics/PostHogAttributionSync';
import { PageEngagementTracker } from '@/components/analytics/PageEngagementTracker';
import { PostHogPageView } from '@/components/analytics/PostHogPageView';
import { ScrollDepthTracker } from '@/components/analytics/ScrollDepthTracker';
import { COOKIE_CONSENT_STORAGE_KEY, parseConsentValue } from '@/lib/cookie-consent';
import type { CookieConsentStatus, CookieConsentValue } from '@/lib/cookie-consent';
import {
  denyGoogleAnalyticsConsent,
  grantGoogleAnalyticsConsent,
  isGoogleAnalyticsConfigured,
  syncGoogleAnalyticsConsentFromStorage,
} from '@/lib/google-analytics';
import { initPostHog } from '@/lib/posthog-client';
import { recordAnalyticsConsent } from '@/lib/record-analytics-consent';
import { captureVisitorGeoAfterConsent } from '@/lib/visitor-geo';

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

/**
 * Gates PostHog behind analytics cookie consent and shows the consent banner.
 */
export function AnalyticsConsentProvider(props: AnalyticsConsentProviderProps) {
  const [status, setStatus] = useState<CookieConsentStatus>(() =>
    typeof window === 'undefined' ? 'pending' : readStoredConsent(),
  );
  const [hydrated, setHydrated] = useState(false);

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
    if (status === 'analytics') {
      initPostHog();
      grantGoogleAnalyticsConsent();
      void captureVisitorGeoAfterConsent();
    }
  }, [status]);

  const acceptAnalytics = () => {
    persistConsent('analytics');
    setStatus('analytics');
    initPostHog();
    grantGoogleAnalyticsConsent();
    void recordAnalyticsConsent('accept');
    void captureVisitorGeoAfterConsent();
  };

  const rejectAnalytics = () => {
    persistConsent('essential');
    setStatus('essential');
    denyGoogleAnalyticsConsent();
    void recordAnalyticsConsent('reject');
  };

  const reopenBanner = () => {
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
      {props.children}
      {showBanner ? <CookieConsentBanner /> : null}
      {analyticsOn ? (
        <AnalyticsErrorBoundary>
          <GoogleOneTapManager />
          <PostHogAttributionSync />
          <Suspense fallback={null}>
            <GaPageView />
            <PageEngagementTracker />
            <ScrollDepthTracker />
            <PostHogPageView />
          </Suspense>
        </AnalyticsErrorBoundary>
      ) : null}
    </AnalyticsConsentContext>
  );
}
