import { db } from '@/libs/DB';
import { analyticsEventsSchema } from '@/models/Schema';
import type { AttributionInput } from '@/lib/attribution';
import type { VisitorGeoInput } from '@/lib/visitor-geo';

export type RecordAnalyticsEventInput = {
  eventType:
    | 'whatsapp_click'
    | 'phone_click'
    | 'quote_submit'
    | 'analytics_consent'
    | 'visitor_geo'
    | 'one_tap_prompt'
    | 'equipment_view'
    | 'add_to_quote'
    | 'remove_from_quote'
    | 'quote_abandon'
    | 'category_filter'
    | 'search'
    | 'scroll_depth';
  origin?: string;
  equipmentSlug?: string;
  equipmentName?: string;
  pathname?: string;
  device?: string;
  /** Whether analytics cookies were accepted when the event fired. */
  analyticsConsent?: boolean;
  attribution?: AttributionInput;
  visitorGeo?: VisitorGeoInput;
};

/**
 * Persists a conversion event for the operational dashboard.
 */
export async function recordAnalyticsEvent(input: RecordAnalyticsEventInput) {
  const attribution = input.attribution;

  const [row] = await db
    .insert(analyticsEventsSchema)
    .values({
      eventType: input.eventType,
      origin: input.origin ?? null,
      equipmentSlug: input.equipmentSlug ?? null,
      equipmentName: input.equipmentName ?? null,
      pathname: input.pathname ?? null,
      device: input.device ?? null,
      analyticsConsent: input.analyticsConsent ?? null,
      utmSource: attribution?.utmSource ?? null,
      utmMedium: attribution?.utmMedium ?? null,
      utmCampaign: attribution?.utmCampaign ?? null,
      utmContent: attribution?.utmContent ?? null,
      utmTerm: attribution?.utmTerm ?? null,
      gclid: attribution?.gclid ?? null,
      gbraid: attribution?.gbraid ?? null,
      wbraid: attribution?.wbraid ?? null,
      referrer: attribution?.referrer ?? null,
      landingPage: attribution?.landingPage ?? null,
      geoCity: input.visitorGeo?.geoCity ?? null,
      geoRegion: input.visitorGeo?.geoRegion ?? null,
    })
    .returning({ id: analyticsEventsSchema.id });

  return row;
}
