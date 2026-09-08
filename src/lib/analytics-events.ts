import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { analyticsEventsSchema } from '@/models/Schema';
import type { AttributionInput } from '@/lib/attribution';
import type { VisitorGeoInput } from '@/lib/visitor-geo';
import {
  WHATSAPP_CLICK_DEDUP_WINDOW_MS,
  whatsappClickDedupKey,
} from '@/lib/whatsapp-click-idempotency';

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

export type RecordedAnalyticsEvent = {
  id: number;
  reused: boolean;
};

type AnalyticsStore = {
  select: typeof db.select;
  insert: typeof db.insert;
};

function blankSql(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function whatsappClickFingerprint(input: RecordAnalyticsEventInput) {
  return whatsappClickDedupKey({
    createdAt: new Date(0),
    origin: input.origin,
    equipmentSlug: input.equipmentSlug,
    pathname: input.pathname,
    gclid: input.attribution?.gclid,
    gbraid: input.attribution?.gbraid,
    wbraid: input.attribution?.wbraid,
  });
}

/**
 * Returns a WhatsApp click already stored for the same button inside the dedup window.
 */
async function findRecentDuplicateWhatsAppClick(
  store: AnalyticsStore,
  input: RecordAnalyticsEventInput,
) {
  const since = new Date(Date.now() - WHATSAPP_CLICK_DEDUP_WINDOW_MS);
  const clickId = blankSql(input.attribution?.gclid)
    || blankSql(input.attribution?.gbraid)
    || blankSql(input.attribution?.wbraid);

  const [row] = await store
    .select({ id: analyticsEventsSchema.id })
    .from(analyticsEventsSchema)
    .where(
      and(
        eq(analyticsEventsSchema.eventType, 'whatsapp_click'),
        gt(analyticsEventsSchema.createdAt, since),
        sql`coalesce(trim(${analyticsEventsSchema.origin}), '') = ${blankSql(input.origin)}`,
        sql`coalesce(trim(${analyticsEventsSchema.equipmentSlug}), '') = ${blankSql(input.equipmentSlug)}`,
        sql`coalesce(trim(${analyticsEventsSchema.pathname}), '') = ${blankSql(input.pathname)}`,
        sql`coalesce(nullif(trim(${analyticsEventsSchema.gclid}), ''), nullif(trim(${analyticsEventsSchema.gbraid}), ''), nullif(trim(${analyticsEventsSchema.wbraid}), ''), '') = ${clickId}`,
      ),
    )
    .orderBy(desc(analyticsEventsSchema.createdAt))
    .limit(1);

  return row ?? null;
}

async function insertAnalyticsEvent(
  store: AnalyticsStore,
  input: RecordAnalyticsEventInput,
): Promise<RecordedAnalyticsEvent | undefined> {
  const attribution = input.attribution;

  const baseValues = {
    eventType: input.eventType,
    origin: input.origin ?? null,
    equipmentSlug: input.equipmentSlug ?? null,
    equipmentName: input.equipmentName ?? null,
    pathname: input.pathname ?? null,
    device: input.device ?? null,
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
  };

  try {
    const [row] = await store
      .insert(analyticsEventsSchema)
      .values({
        ...baseValues,
        analyticsConsent: input.analyticsConsent ?? null,
      })
      .returning({ id: analyticsEventsSchema.id });

    return row ? { id: row.id, reused: false } : undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Survive deploys where the consent column migration has not applied yet.
    if (!/analytics_consent/i.test(message)) {
      throw error;
    }

    const [row] = await store
      .insert(analyticsEventsSchema)
      .values(baseValues)
      .returning({ id: analyticsEventsSchema.id });

    return row ? { id: row.id, reused: false } : undefined;
  }
}

/**
 * Persists a conversion event for the operational dashboard.
 */
export async function recordAnalyticsEvent(
  input: RecordAnalyticsEventInput,
): Promise<RecordedAnalyticsEvent | undefined> {
  if (input.eventType !== 'whatsapp_click') {
    return insertAnalyticsEvent(db, input);
  }

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${whatsappClickFingerprint(input)})::bigint)`,
    );

    const duplicate = await findRecentDuplicateWhatsAppClick(tx, input);
    if (duplicate) {
      return { id: duplicate.id, reused: true };
    }

    return insertAnalyticsEvent(tx, input);
  });
}
