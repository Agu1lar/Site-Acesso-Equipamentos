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
 * Counts phone clicks in Neon always (no cookie required).
 * GA4 / PostHog only run after analytics consent.
 */
export function trackPhoneClick(input: TrackPhoneClickInput) {
  syncGoogleAnalyticsConsentFromStorage();
  const analyticsConsent = isGoogleAnalyticsConsentGranted();

  if (analyticsConsent) {
    capturePhoneClick(input);
    captureGaEvent(GA_CONVERSION_EVENTS.phoneClick, {
      origin: input.origin,
    });
  }

  if (typeof window === 'undefined') {
    return;
  }

  const pathname = window.location.pathname;
  const body = JSON.stringify({
    eventType: 'phone_click',
    origin: input.origin,
    pathname,
    device: detectDevice(),
    analyticsConsent,
    ...(analyticsConsent
      ? {
          attribution: readStoredAttribution() ?? undefined,
          visitorGeo: readStoredVisitorGeo() ?? undefined,
        }
      : {}),
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
