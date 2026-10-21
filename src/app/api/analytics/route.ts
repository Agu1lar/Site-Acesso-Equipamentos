import { after, NextResponse } from 'next/server';
import * as z from 'zod';
import { recordAnalyticsEvent } from '@/lib/analytics-events';
import { uploadGoogleAdsOfflineClickConversion } from '@/lib/google-ads-offline-conversions';
import { mintWhatsAppAttributionToken } from '@/lib/whatsapp-attribution-token';
import { logger } from '@/libs/Logger';
import { AnalyticsEventSchema } from '@/validations/analytics';

export const POST = async (request: Request) => {
  try {
    const json = await request.json();
    const parsed = AnalyticsEventSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: z.treeifyError(parsed.error) },
        { status: 422 },
      );
    }

    const { data } = parsed;
    const event = await recordAnalyticsEvent({
      eventType: data.eventType,
      origin: data.origin,
      equipmentSlug: data.equipmentSlug,
      equipmentName: data.equipmentName,
      pathname: data.pathname,
      device: data.device,
      attribution: data.attribution,
      visitorGeo: data.visitorGeo,
      analyticsConsent: data.analyticsConsent,
    });

    let refCode: string | null = null;
    if (data.eventType === 'whatsapp_click') {
      refCode = await mintWhatsAppAttributionToken({
        metaContext: data.analyticsConsent === true ? data.metaContext : undefined,
        origin: data.origin,
        equipmentSlug: data.equipmentSlug,
        equipmentName: data.equipmentName,
        pathname: data.pathname,
        device: data.device,
        attribution: data.attribution,
      });

      // Return the WhatsApp reference before a slow Ads request can exhaust the browser's timeout.
      if (event?.id && !event.reused) {
        after(async () => {
          try {
            await uploadGoogleAdsOfflineClickConversion({
              analyticsEventId: event.id,
              attribution: data.attribution,
            });
          } catch (error) {
            logger.warn('Deferred Ads click upload failed', {
              analyticsEventId: event.id,
              message: error instanceof Error ? error.message : String(error),
            });
          }
        });
      }
    }

    return NextResponse.json({ ok: true, refCode });
  } catch (error) {
    logger.error('Failed to record analytics event', {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to record event' }, { status: 500 });
  }
};
