import { readStoredAttribution } from '@/lib/attribution';
import { readStoredVisitorGeo } from '@/lib/visitor-geo';
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

/**
 * Sends whatsapp_click to PostHog, GA4, Google Ads (optional) and Neon.
 */
export function trackWhatsAppClick(input: WhatsAppClickInput) {
  // Restore consent before Ads/GA4 so returning visitors are not dropped pre-hydration.
  syncGoogleAnalyticsConsentFromStorage();
  const analyticsConsent = isGoogleAnalyticsConsentGranted();

  captureWhatsAppClick(input);

  captureGaEvent(GA_CONVERSION_EVENTS.whatsappClick, {
    origin: input.origin,
    equipment_slug: input.equipmentSlug,
    equipment_name: input.equipmentName,
  });

  captureGoogleAdsWhatsAppConversion({
    origin: input.origin,
    equipment_slug: input.equipmentSlug,
  });

  if (typeof window === 'undefined') {
    return;
  }

  const attribution = readStoredAttribution();
  const visitorGeo = readStoredVisitorGeo();
  const pathname = window.location.pathname;

  const body = JSON.stringify({
      eventType: 'whatsapp_click',
      origin: input.origin,
      equipmentSlug: input.equipmentSlug,
      equipmentName: input.equipmentName,
      pathname,
      device: detectDevice(),
      analyticsConsent,
      attribution: attribution ?? undefined,
      visitorGeo: visitorGeo ?? undefined,
    });

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
