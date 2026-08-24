import 'server-only';

import { Env } from '@/libs/Env';

export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_ADS_API_VERSION = 'v18';

export type GoogleAdsSpendOptions = {
  dateFrom: string;
  dateTo: string;
  campaignPrefix: string;
};

export type GoogleAdsSpendResult = {
  spendByCampaign: Record<string, number>;
  currencyCode: string | null;
  campaignsMatched: number;
};

type TokenCache = {
  accessToken: string;
  expiresAtMs: number;
};

type GoogleAdsCredentials = {
  developerToken: string | null;
  customerId: string | null;
  loginCustomerId: string | null;
  clientId: string | null;
  clientSecret: string | null;
  refreshToken: string | null;
};

type ConfiguredGoogleAdsCredentials = {
  developerToken: string;
  customerId: string;
  loginCustomerId: string | null;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

let tokenCache: TokenCache | null = null;

export function readGoogleAdsCredentials(): GoogleAdsCredentials {
  return {
    developerToken: Env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() || null,
    customerId: Env.GOOGLE_ADS_CUSTOMER_ID?.trim() || null,
    loginCustomerId: Env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim() || null,
    clientId: Env.GOOGLE_ADS_CLIENT_ID?.trim() || null,
    clientSecret: Env.GOOGLE_ADS_CLIENT_SECRET?.trim() || null,
    refreshToken: Env.GOOGLE_ADS_REFRESH_TOKEN?.trim() || null,
  };
}

/**
 * Returns true when all Google Ads API credentials are configured.
 * @returns Whether Google Ads API calls can authenticate.
 */
export function isGoogleAdsApiConfigured() {
  const creds = readGoogleAdsCredentials();
  return Boolean(
    creds.developerToken
    && creds.customerId
    && creds.clientId
    && creds.clientSecret
    && creds.refreshToken,
  );
}

/**
 * Reads configured Google Ads credentials or throws a setup error.
 * @returns Complete Google Ads credentials.
 * @throws When a required credential is missing.
 */
export function readConfiguredGoogleAdsCredentials(): ConfiguredGoogleAdsCredentials {
  const creds = readGoogleAdsCredentials();
  if (
    !creds.developerToken ||
    !creds.customerId ||
    !creds.clientId ||
    !creds.clientSecret ||
    !creds.refreshToken
  ) {
    throw new Error('google_ads_not_configured');
  }

  return {
    developerToken: creds.developerToken,
    customerId: creds.customerId,
    loginCustomerId: creds.loginCustomerId,
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
    refreshToken: creds.refreshToken,
  };
}

/**
 * Normalizes Google Ads campaign name to match utm_campaign keys.
 * @param name Google Ads campaign name.
 * @returns Normalized campaign key.
 */
export function googleAdsCampaignSpendKey(name: string) {
  return name.trim().toLowerCase().replaceAll(/\s+/gu, '_');
}

export function normalizeGoogleAdsCustomerId(value: string) {
  return value.replaceAll(/\D/gu, '');
}

function microsToCurrency(micros: number) {
  return Number((micros / 1_000_000).toFixed(2));
}

function campaignMatchesPrefix(options: {
  campaignName: string;
  prefix: string;
  prefixKey: string;
}) {
  return (
    googleAdsCampaignSpendKey(options.campaignName).startsWith(options.prefixKey) ||
    options.campaignName.toLowerCase().startsWith(options.prefix)
  );
}

function addGoogleAdsSpendRow(options: {
  row: GoogleAdsSearchRow;
  prefix: string;
  prefixKey: string;
  spendByCampaign: Record<string, number>;
}) {
  const campaignName = options.row.campaign?.name?.trim();
  if (!campaignName) {
    return null;
  }
  if (!campaignMatchesPrefix({ campaignName, prefix: options.prefix, prefixKey: options.prefixKey })) {
    return null;
  }

  const micros = Number(options.row.metrics?.costMicros ?? 0);
  if (!Number.isFinite(micros) || micros <= 0) {
    return null;
  }

  const key = googleAdsCampaignSpendKey(campaignName);
  options.spendByCampaign[key] = Number(
    ((options.spendByCampaign[key] ?? 0) + microsToCurrency(micros)).toFixed(2),
  );

  return options.row.customer?.currencyCode ?? null;
}

export async function fetchGoogleAdsAccessToken() {
  if (tokenCache && tokenCache.expiresAtMs > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const creds = readConfiguredGoogleAdsCredentials();

  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: creds.refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(20_000),
  });

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error || 'google_ads_token_failed');
  }

  const expiresInSec = payload.expires_in ?? 3600;
  tokenCache = {
    accessToken: payload.access_token,
    expiresAtMs: Date.now() + expiresInSec * 1000,
  };

  return payload.access_token;
}

type GoogleAdsSearchRow = {
  campaign?: { name?: string };
  metrics?: { costMicros?: string };
  customer?: { currencyCode?: string };
};

type GoogleAdsSearchResponse = {
  results?: GoogleAdsSearchRow[];
  nextPageToken?: string;
};

/**
 * Fetches campaign spend from Google Ads API for the given date range.
 * @param options Brasília date range and utm campaign prefix filter.
 * @returns Spend grouped by normalized campaign key.
 */
export async function fetchGoogleAdsCampaignSpend(
  options: GoogleAdsSpendOptions,
): Promise<GoogleAdsSpendResult> {
  const creds = readConfiguredGoogleAdsCredentials();
  const customerId = normalizeGoogleAdsCustomerId(creds.customerId);
  const loginCustomerId = creds.loginCustomerId
    ? normalizeGoogleAdsCustomerId(creds.loginCustomerId)
    : null;

  const accessToken = await fetchGoogleAdsAccessToken();
  const prefix = options.campaignPrefix.toLowerCase();
  const prefixKey = prefix.replaceAll(/\s+/gu, '_');

  const query = [
    'SELECT campaign.name, metrics.cost_micros, customer.currency_code',
    'FROM campaign',
    `WHERE segments.date BETWEEN '${options.dateFrom}' AND '${options.dateTo}'`,
  ].join(' ');

  const spendByCampaign: Record<string, number> = {};
  let currencyCode: string | null = null;
  let pageToken: string | undefined;

  do {
    const url = new URL(
      `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:search`,
    );

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'developer-token': creds.developerToken,
        'content-type': 'application/json',
        ...(loginCustomerId ? { 'login-customer-id': loginCustomerId } : {}),
      },
      body: JSON.stringify({
        query,
        pageToken,
      }),
      signal: AbortSignal.timeout(45_000),
    });

    const payload = (await response.json()) as GoogleAdsSearchResponse & {
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(payload.error?.message || 'google_ads_search_failed');
    }

    for (const row of payload.results ?? []) {
      currencyCode ??= addGoogleAdsSpendRow({
        row,
        prefix,
        prefixKey,
        spendByCampaign,
      });
    }

    pageToken = payload.nextPageToken;
  } while (pageToken);

  return {
    spendByCampaign,
    currencyCode,
    campaignsMatched: Object.keys(spendByCampaign).length,
  };
}

/** Resets OAuth token cache (tests). */
export function resetGoogleAdsTokenCacheForTests() {
  tokenCache = null;
}
