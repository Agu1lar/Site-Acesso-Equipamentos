import 'server-only';
import { eq } from 'drizzle-orm';
import type { AttributionInput } from '@/lib/attribution';
import {
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
  analyticsEventId?: number;
  attribution?: AttributionInput;
  leadId?: number;
  conversionDate?: Date;
};

export type GoogleAdsQualifiedLeadConversionInput = {
  attribution?: AttributionInput;
  leadId: number;
  conversionDate?: Date;
};

export type GoogleAdsConfirmedContactConversionInput = {
  attribution?: AttributionInput;
  leadId: number;
  conversionDate?: Date;
};

export type GoogleAdsOfflineConversionResult = {
  uploaded: boolean;
  reason?:
    | 'not_configured'
    | 'missing_click_id'
    | 'not_eligible'
    | 'duplicate'
    | 'partial_failure'
    | 'request_failed';
};

type GoogleAdsDataManagerEvent = {
  adIdentifiers: Partial<Record<'gclid' | 'gbraid' | 'wbraid', string>>;
  eventTimestamp: string;
  eventSource: 'WEB';
  conversionValue: number;
  currency: string;
  transactionId: string;
};

type GoogleAdsDataManagerResponse = {
  requestId?: string;
  error?: {
    message?: string;
  };
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

function readQualifiedLeadConversionActionResourceName() {
  const explicit = Env.GOOGLE_ADS_QUALIFIED_LEAD_CONVERSION_ACTION_RESOURCE_NAME?.trim();
  if (explicit) {
    return explicit;
  }

  const actionId = Env.GOOGLE_ADS_QUALIFIED_LEAD_CONVERSION_ACTION_ID?.replaceAll(/\D/gu, '');
  const customerId = Env.GOOGLE_ADS_CUSTOMER_ID?.trim();
  if (!actionId || !customerId) {
    return null;
  }

  return `customers/${normalizeGoogleAdsCustomerId(customerId)}/conversionActions/${actionId}`;
}

function readConfirmedContactConversionActionResourceName() {
  const explicit = Env.GOOGLE_ADS_CONFIRMED_CONTACT_CONVERSION_ACTION_RESOURCE_NAME?.trim();
  if (explicit) {
    return explicit;
  }

  const actionId = Env.GOOGLE_ADS_CONFIRMED_CONTACT_CONVERSION_ACTION_ID?.replaceAll(/\D/gu, '');
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

/**
 * Returns true when qualified lead conversion upload can run.
 * @returns Whether the Google Ads API and qualified-lead action are configured.
 */
export function isGoogleAdsQualifiedLeadConversionConfigured() {
  return isGoogleAdsApiConfigured() && Boolean(readQualifiedLeadConversionActionResourceName());
}

/**
 * Returns true when confirmed-contact conversion upload can run.
 * @returns Whether the Google Ads API and confirmed-contact action are configured.
 */
export function isGoogleAdsConfirmedContactConversionConfigured() {
  return isGoogleAdsApiConfigured() && Boolean(readConfirmedContactConversionActionResourceName());
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

function buildDataManagerEvent(options: {
  conversionDate: Date;
  clickId: { type: 'gclid' | 'gbraid' | 'wbraid'; value: string };
  orderId: string;
}): GoogleAdsDataManagerEvent {
  return {
    adIdentifiers: { [options.clickId.type]: options.clickId.value },
    eventTimestamp: options.conversionDate.toISOString(),
    eventSource: 'WEB',
    conversionValue: GOOGLE_ADS_CONVERSION_VALUE,
    currency: GOOGLE_ADS_CONVERSION_CURRENCY,
    transactionId: options.orderId,
  };
}

function readConversionActionId(resourceName: string) {
  return resourceName.split('/').at(-1)?.replaceAll(/\D/gu, '') || null;
}

async function insertPendingUpload(options: {
  analyticsEventId?: number;
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
        analyticsEventId: options.analyticsEventId ?? null,
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
      const [existing] = await db
        .select({
          id: googleAdsOfflineConversionsSchema.id,
          status: googleAdsOfflineConversionsSchema.status,
        })
        .from(googleAdsOfflineConversionsSchema)
        .where(eq(googleAdsOfflineConversionsSchema.orderId, options.orderId))
        .limit(1);

      if (!existing || existing.status !== 'failed') {
        return null;
      }

      await db
        .update(googleAdsOfflineConversionsSchema)
        .set({
          status: 'pending',
          responsePayload: null,
          errorMessage: null,
          uploadedAt: null,
        })
        .where(eq(googleAdsOfflineConversionsSchema.id, existing.id));

      return { id: existing.id };
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
  return uploadGoogleAdsConversion({
    ...input,
    conversionAction: readOfflineConversionActionResourceName(),
    orderId: (clickId) => `wa-${clickId.type}-${clickId.value}`,
  });
}

/**
 * Uploads a manually qualified lead as a separate Google Ads conversion.
 * @param input Qualified lead and its original campaign attribution.
 * @returns Upload result with skip/failure reason when not uploaded.
 */
export async function uploadGoogleAdsQualifiedLeadConversion(
  input: GoogleAdsQualifiedLeadConversionInput,
): Promise<GoogleAdsOfflineConversionResult> {
  return uploadGoogleAdsConversion({
    ...input,
    conversionAction: readQualifiedLeadConversionActionResourceName(),
    orderId: () => `qualified-lead-${input.leadId}`,
  });
}

/**
 * Uploads one paid lead after WhatsApp opens or the first inbound reply arrives.
 * @param input Lead and its original campaign attribution.
 * @returns Upload result with skip/failure reason when not uploaded.
 */
export async function uploadGoogleAdsConfirmedContactConversion(
  input: GoogleAdsConfirmedContactConversionInput,
): Promise<GoogleAdsOfflineConversionResult> {
  return uploadGoogleAdsConversion({
    ...input,
    conversionAction: readConfirmedContactConversionActionResourceName(),
    orderId: () => `confirmed-contact-${input.leadId}`,
  });
}

async function uploadGoogleAdsConversion(
  input: GoogleAdsOfflineConversionInput & {
    conversionAction: string | null;
    orderId: (clickId: { type: 'gclid' | 'gbraid' | 'wbraid'; value: string }) => string;
  },
): Promise<GoogleAdsOfflineConversionResult> {
  if (!isGoogleAdsApiConfigured() || !input.conversionAction) {
    return { uploaded: false, reason: 'not_configured' };
  }

  const clickId = resolveClickId(input.attribution);
  if (!clickId) {
    return { uploaded: false, reason: 'missing_click_id' };
  }

  const conversionAction = input.conversionAction;
  const conversionActionId = readConversionActionId(conversionAction);
  if (!conversionActionId) {
    return { uploaded: false, reason: 'not_configured' };
  }

  const orderId = input.orderId(clickId);
  const event = buildDataManagerEvent({
    conversionDate: input.conversionDate ?? new Date(),
    clickId,
    orderId,
  });
  const creds = readConfiguredGoogleAdsCredentials();
  const customerId = normalizeGoogleAdsCustomerId(creds.customerId);
  const loginCustomerId = creds.loginCustomerId
    ? normalizeGoogleAdsCustomerId(creds.loginCustomerId)
    : customerId;
  const requestPayload = {
    destinations: [
      {
        operatingAccount: {
          accountType: 'GOOGLE_ADS',
          accountId: customerId,
        },
        loginAccount: {
          accountType: 'GOOGLE_ADS',
          accountId: loginCustomerId,
        },
        productDestinationId: conversionActionId,
      },
    ],
    encoding: 'HEX',
    events: [event],
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
    const accessToken = await fetchGoogleAdsAccessToken();

    const response = await fetch(
      'https://datamanager.googleapis.com/v1/events:ingest',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
        signal: AbortSignal.timeout(20_000),
      },
    );

    const payload = (await response.json()) as GoogleAdsDataManagerResponse;
    const responsePayload = payload as Record<string, unknown>;

    if (!response.ok || !payload.requestId) {
      const message = payload.error?.message ?? 'google_ads_offline_upload_failed';
      await updateUploadStatus({
        id: uploadRow.id,
        status: 'failed',
        responsePayload,
        errorMessage: message,
      });
      logger.warn('Google Ads offline conversion upload failed', {
        analyticsEventId: input.analyticsEventId,
        leadId: input.leadId,
        message,
      });
      return {
        uploaded: false,
        reason: 'request_failed',
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
      leadId: input.leadId,
      message,
    });
    return { uploaded: false, reason: 'request_failed' };
  }
}
