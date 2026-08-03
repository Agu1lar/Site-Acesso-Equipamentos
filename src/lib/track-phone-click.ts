import { readStoredAttribution } from '@/lib/attribution';
import { readStoredVisitorGeo } from '@/lib/visitor-geo';
import { capturePhoneClick } from '@/lib/posthog-events';
import {
  GA_CONVERSION_EVENTS,
  captureGaEvent,
  isGoogleAnalyticsConsentGranted,
  syncGoogleAnalyticsConsentFromStorage,
} from '@/lib/google-analytics';

type TrackPhoneClickInput = {
  origin: string;
};

function detectDevice() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.matchMedia('(max-width: 768px)').matches ? 'mobile' : 'desktop';
}

/**
 * Sends phone_click to PostHog, GA4 and persists the event in Neon.
 */
export function trackPhoneClick(input: TrackPhoneClickInput) {
  syncGoogleAnalyticsConsentFromStorage();
  const analyticsConsent = isGoogleAnalyticsConsentGranted();

  capturePhoneClick(input);

  captureGaEvent(GA_CONVERSION_EVENTS.phoneClick, {
    origin: input.origin,
  });

  if (typeof window === 'undefined') {
    return;
  }

  const attribution = readStoredAttribution();
  const visitorGeo = readStoredVisitorGeo();
  const pathname = window.location.pathname;
  const body = JSON.stringify({
    eventType: 'phone_click',
    origin: input.origin,
    pathname,
    device: detectDevice(),
    analyticsConsent,
    attribution: attribution ?? undefined,
    visitorGeo: visitorGeo ?? undefined,
  });

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon('/api/analytics', new Blob([body], { type: 'application/json' }));
    return;
  }

  void fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  });
}
