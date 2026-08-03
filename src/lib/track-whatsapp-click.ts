import { readStoredAttribution } from '@/lib/attribution';
import type { AttributionInput } from '@/lib/attribution';
import { readStoredVisitorGeo } from '@/lib/visitor-geo';
import type { VisitorGeoInput } from '@/lib/visitor-geo';
import {
  GA_CONVERSION_EVENTS,
  captureGaEvent,
  captureGoogleAdsWhatsAppConversion,
  isGoogleAnalyticsConsentGranted,
  syncGoogleAnalyticsConsentFromStorage,
} from '@/lib/google-analytics';
import { captureWhatsAppClick, type WhatsAppClickInput } from '@/lib/posthog-events';

/**
 * Detects mobile vs desktop for analytics device breakdown.
 */
function detectDevice() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return window.matchMedia('(max-width: 768px)').matches ? 'mobile' : 'desktop';
}

export type WhatsAppClickAnalyticsPayload = {
  eventType: 'whatsapp_click';
  origin: string;
  equipmentSlug?: string;
  equipmentName?: string;
  pathname: string;
  device?: string;
  analyticsConsent: boolean;
  attribution?: AttributionInput;
  visitorGeo?: VisitorGeoInput;
};

/**
 * Builds the Neon payload for a WhatsApp click.
 * Without cookie consent, stores only operational counter fields (no UTMs/gclid/geo).
 */
export function buildWhatsAppClickAnalyticsPayload(options: {
  origin: string;
  equipmentSlug?: string;
  equipmentName?: string;
  pathname: string;
  device?: string;
  analyticsConsent: boolean;
  attribution?: AttributionInput | null;
  visitorGeo?: VisitorGeoInput | null;
}): WhatsAppClickAnalyticsPayload {
  const base: WhatsAppClickAnalyticsPayload = {
    eventType: 'whatsapp_click',
    origin: options.origin,
    equipmentSlug: options.equipmentSlug,
    equipmentName: options.equipmentName,
    pathname: options.pathname,
    device: options.device,
    analyticsConsent: options.analyticsConsent,
  };

  if (!options.analyticsConsent) {
    return base;
  }

  return {
    ...base,
    attribution: options.attribution ?? undefined,
    visitorGeo: options.visitorGeo ?? undefined,
  };
}

/**
 * Counts WhatsApp button clicks in Neon always (no cookie required).
 * Fires the Google Ads WhatsApp conversion on every click (click beacon only).
 * GA4 / PostHog still require analytics cookie consent.
 */
export function trackWhatsAppClick(input: WhatsAppClickInput) {
  syncGoogleAnalyticsConsentFromStorage();
  const analyticsConsent = isGoogleAnalyticsConsentGranted();

  // Ads conversion tracks the click itself — not tied to analytics cookies / PII.
  captureGoogleAdsWhatsAppConversion({
    origin: input.origin,
    equipment_slug: input.equipmentSlug,
  });

  if (analyticsConsent) {
    captureWhatsAppClick(input);

    captureGaEvent(GA_CONVERSION_EVENTS.whatsappClick, {
      origin: input.origin,
      equipment_slug: input.equipmentSlug,
      equipment_name: input.equipmentName,
    });
  }

  if (typeof window === 'undefined') {
    return;
  }

  const body = JSON.stringify(
    buildWhatsAppClickAnalyticsPayload({
      origin: input.origin,
      equipmentSlug: input.equipmentSlug,
      equipmentName: input.equipmentName,
      pathname: window.location.pathname,
      device: detectDevice(),
      analyticsConsent,
      attribution: analyticsConsent ? readStoredAttribution() : null,
      visitorGeo: analyticsConsent ? readStoredVisitorGeo() : null,
    }),
  );

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon(
      '/api/analytics',
      new Blob([body], { type: 'application/json' }),
    );
    return;
  }

  void fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  });
}
