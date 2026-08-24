import 'server-only';

import { eq } from 'drizzle-orm';
import type { AttributionInput } from '@/lib/attribution';
import {
  GOOGLE_ADS_API_VERSION,
  fetchGoogleAdsAccessToken,
  isGoogleAdsApiConfigured,
  normalizeGoogleAdsCustomerId,
  readConfiguredGoogleAdsCredentials,
} from '@/lib/google-ads-spend';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { googleAdsOfflineConversionsSchema } from '@/models/Schema';

export type GoogleAdsOfflineConversionInput = {
  analyticsEventId: number;
  attribution?: AttributionInput;
  leadId?: number;
  conversionDate?: Date;
};

export type GoogleAdsOfflineConversionResult = {
  uploaded: boolean;
  reason?:
    | 'not_configured'
    | 'missing_click_id'
    | 'duplicate'
    | 'partial_failure'
    | 'request_failed';
};

type GoogleAdsClickConversion = {
  conversionAction: string;
  conversionDateTime: string;
  conversionValue: number;
  currencyCode: string;
  orderId: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
};

type GoogleAdsUploadClickConversionsResponse = {
  partialFailureError?: {
    message?: string;
    details?: unknown[];
  };
  results?: unknown[];
};

const GOOGLE_ADS_CONVERSION_VALUE = 1;
const GOOGLE_ADS_CONVERSION_CURRENCY = 'BRL';

function readOfflineConversionActionResourceName() {
  const explicit = Env.GOOGLE_ADS_OFFLINE_CONVERSION_ACTION_RESOURCE_NAME?.trim();
  if (explicit) {
    return explicit;
  }

  const actionId = Env.GOOGLE_ADS_OFFLINE_CONVERSION_ACTION_ID?.replaceAll(/\D/gu, '');
  const customerId = Env.GOOGLE_ADS_CUSTOMER_ID?.trim();
  if (!actionId || !customerId) {
    return null;
  }

  return `customers/${normalizeGoogleAdsCustomerId(customerId)}/conversionActions/${actionId}`;
}

/**
 * Returns true when Google Ads offline click conversion upload can run.
 * @returns Whether offline conversion upload is fully configured.
 */
export function isGoogleAdsOfflineConversionConfigured() {
  return isGoogleAdsApiConfigured() && Boolean(readOfflineConversionActionResourceName());
}

function resolveClickId(attribution: AttributionInput | undefined) {
  if (attribution?.gclid?.trim()) {
    return { type: 'gclid' as const, value: attribution.gclid.trim() };
  }
  if (attribution?.gbraid?.trim()) {
    return { type: 'gbraid' as const, value: attribution.gbraid.trim() };
  }
  if (attribution?.wbraid?.trim()) {
    return { type: 'wbraid' as const, value: attribution.wbraid.trim() };
  }
  return null;
}

function formatGoogleAdsConversionDateTime(date: Date) {
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/u, '+00:00');
}

function buildClickConversion(options: {
  conversionAction: string;
  conversionDate: Date;
  clickId: { type: 'gclid' | 'gbraid' | 'wbraid'; value: string };
  orderId: string;
}): GoogleAdsClickConversion {
  return {
    conversionAction: options.conversionAction,
    conversionDateTime: formatGoogleAdsConversionDateTime(options.conversionDate),
    conversionValue: GOOGLE_ADS_CONVERSION_VALUE,
    currencyCode: GOOGLE_ADS_CONVERSION_CURRENCY,
    orderId: options.orderId,
    [options.clickId.type]: options.clickId.value,
  };
}

async function insertPendingUpload(options: {
  analyticsEventId: number;
  leadId?: number;
  clickId: { type: 'gclid' | 'gbraid' | 'wbraid'; value: string };
  conversionAction: string;
  orderId: string;
  requestPayload: Record<string, unknown>;
}) {
  try {
    const [row] = await db
      .insert(googleAdsOfflineConversionsSchema)
      .values({
        analyticsEventId: options.analyticsEventId,
        leadId: options.leadId ?? null,
        clickId: options.clickId.value,
        clickIdType: options.clickId.type,
        conversionAction: options.conversionAction,
        orderId: options.orderId,
        requestPayload: options.requestPayload,
      })
      .returning({ id: googleAdsOfflineConversionsSchema.id });

    return row ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/duplicate|unique/iu.test(message)) {
      return null;
    }
    throw error;
  }
}

async function updateUploadStatus(options: {
  id: number;
  status: 'uploaded' | 'failed';
  responsePayload: Record<string, unknown>;
  errorMessage?: string;
}) {
  await db
    .update(googleAdsOfflineConversionsSchema)
    .set({
      status: options.status,
      responsePayload: options.responsePayload,
      errorMessage: options.errorMessage ?? null,
      uploadedAt: options.status === 'uploaded' ? new Date() : null,
    })
    .where(eq(googleAdsOfflineConversionsSchema.id, options.id));
}

/**
 * Uploads one WhatsApp click conversion to Google Ads from a stored click id.
 * @param input Analytics event with first-touch campaign attribution.
 * @returns Upload result with skip/failure reason when not uploaded.
 */
export async function uploadGoogleAdsOfflineClickConversion(
  input: GoogleAdsOfflineConversionInput,
): Promise<GoogleAdsOfflineConversionResult> {
  if (!isGoogleAdsOfflineConversionConfigured()) {
    return { uploaded: false, reason: 'not_configured' };
  }

  const clickId = resolveClickId(input.attribution);
  if (!clickId) {
    return { uploaded: false, reason: 'missing_click_id' };
  }

  const conversionAction = readOfflineConversionActionResourceName();
  if (!conversionAction) {
    return { uploaded: false, reason: 'not_configured' };
  }

  const orderId = `wa-${input.analyticsEventId}`;
  const conversion = buildClickConversion({
    conversionAction,
    conversionDate: input.conversionDate ?? new Date(),
    clickId,
    orderId,
  });
  const requestPayload = {
    conversions: [conversion],
    partialFailure: true,
    validateOnly: false,
  };

  const uploadRow = await insertPendingUpload({
    analyticsEventId: input.analyticsEventId,
    leadId: input.leadId,
    clickId,
    conversionAction,
    orderId,
    requestPayload,
  });

  if (!uploadRow) {
    return { uploaded: false, reason: 'duplicate' };
  }

  try {
    const creds = readConfiguredGoogleAdsCredentials();
    const customerId = normalizeGoogleAdsCustomerId(creds.customerId);
    const loginCustomerId = creds.loginCustomerId
      ? normalizeGoogleAdsCustomerId(creds.loginCustomerId)
      : null;
    const accessToken = await fetchGoogleAdsAccessToken();

    const response = await fetch(
      `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}:uploadClickConversions`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'developer-token': creds.developerToken,
          'content-type': 'application/json',
          ...(loginCustomerId ? { 'login-customer-id': loginCustomerId } : {}),
        },
        body: JSON.stringify(requestPayload),
        signal: AbortSignal.timeout(20_000),
      },
    );

    const payload = (await response.json()) as GoogleAdsUploadClickConversionsResponse & {
      error?: { message?: string };
    };
    const responsePayload = payload as Record<string, unknown>;
    const partialFailure = payload.partialFailureError?.message;

    if (!response.ok || partialFailure) {
      const message = payload.error?.message ?? partialFailure ?? 'google_ads_offline_upload_failed';
      await updateUploadStatus({
        id: uploadRow.id,
        status: 'failed',
        responsePayload,
        errorMessage: message,
      });
      logger.warn('Google Ads offline conversion upload failed', {
        analyticsEventId: input.analyticsEventId,
        message,
      });
      return {
        uploaded: false,
        reason: partialFailure ? 'partial_failure' : 'request_failed',
      };
    }

    await updateUploadStatus({
      id: uploadRow.id,
      status: 'uploaded',
      responsePayload,
    });

    return { uploaded: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateUploadStatus({
      id: uploadRow.id,
      status: 'failed',
      responsePayload: {},
      errorMessage: message,
    });
    logger.warn('Google Ads offline conversion upload failed', {
      analyticsEventId: input.analyticsEventId,
      message,
    });
    return { uploaded: false, reason: 'request_failed' };
  }
}
