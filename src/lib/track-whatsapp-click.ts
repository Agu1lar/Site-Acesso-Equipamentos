import { readStoredAttribution } from '@/lib/attribution';
import type { AttributionInput } from '@/lib/attribution';
import { pickEssentialCampaignAttribution } from '@/lib/attribution';
import { readStoredVisitorGeo } from '@/lib/visitor-geo';
import type { VisitorGeoInput } from '@/lib/visitor-geo';
import {
  GA_CONVERSION_EVENTS,
  captureGaEvent,
  preparePaidSearchAdsConversion,
  isGoogleAnalyticsConsentGranted,
  syncGoogleAnalyticsConsentFromStorage,
} from '@/lib/google-analytics';
import { fireAdsContactConversion } from '@/lib/ads-contact-conversion';
import { captureWhatsAppClick, type WhatsAppClickInput } from '@/lib/posthog-events';
import { appendWhatsAppAttributionRefToUrl } from '@/lib/whatsapp-attribution-bridge';

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
 * Without analytics cookies: still keeps essential campaign attribution (gclid/UTM/landing)
 * for Ads conversion counting — never geo or profiling fields.
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

  if (options.analyticsConsent) {
    return {
      ...base,
      attribution: options.attribution ?? undefined,
      visitorGeo: options.visitorGeo ?? undefined,
    };
  }

  const essential = pickEssentialCampaignAttribution(options.attribution);
  if (!essential) {
    return base;
  }

  return {
    ...base,
    attribution: essential,
  };
}

function buildWhatsAppClickRequestBody(input: WhatsAppClickInput) {
  const analyticsConsent = isGoogleAnalyticsConsentGranted();
  const attribution = readStoredAttribution();

  return buildWhatsAppClickAnalyticsPayload({
    origin: input.origin,
    equipmentSlug: input.equipmentSlug,
    equipmentName: input.equipmentName,
    pathname: typeof window === 'undefined' ? '/' : window.location.pathname,
    device: detectDevice(),
    analyticsConsent,
    attribution,
    visitorGeo: analyticsConsent ? readStoredVisitorGeo() : null,
  });
}

/**
 * Records a WhatsApp click and returns a campaign ref code when minted.
 * @param input PostHog origin and optional equipment context.
 */
export async function trackWhatsAppClickWithRef(input: WhatsAppClickInput) {
  syncGoogleAnalyticsConsentFromStorage();
  preparePaidSearchAdsConversion();
  const analyticsConsent = isGoogleAnalyticsConsentGranted();

  fireAdsContactConversion({
    source: 'whatsapp',
    origin: input.origin,
    equipmentSlug: input.equipmentSlug,
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
    return null;
  }

  const body = JSON.stringify(buildWhatsAppClickRequestBody(input));

  try {
    const response = await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      signal: AbortSignal.timeout(3_000),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { refCode?: string | null };
    return payload.refCode?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Opens WhatsApp in a new tab with optional campaign ref code in the prefill.
 * @param href Base wa.me URL.
 * @param input Analytics origin context.
 */
export async function openTrackedWhatsApp(href: string, input: WhatsAppClickInput) {
  const refCode = await trackWhatsAppClickWithRef(input);
  const target = refCode ? appendWhatsAppAttributionRefToUrl(href, refCode) : href;
  window.open(target, '_blank', 'noopener,noreferrer');
}

/**
 * Counts WhatsApp button clicks in Neon always (no cookie required).
 * Fires the shared Ads contact conversion (once per session) without analytics cookies.
 * For paid search (gclid), restores click id + ad_storage so the Ads snippet attributes.
 * GA4 / PostHog still require analytics cookie consent.
 */
export function trackWhatsAppClick(input: WhatsAppClickInput) {
  void trackWhatsAppClickWithRef(input);
}
