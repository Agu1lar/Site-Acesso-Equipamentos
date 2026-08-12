import 'server-only';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_ADS_API_VERSION = 'v18';

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

let tokenCache: TokenCache | null = null;

function readGoogleAdsCredentials() {
  return {
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() || null,
    customerId: process.env.GOOGLE_ADS_CUSTOMER_ID?.trim() || null,
    loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim() || null,
    clientId: process.env.GOOGLE_ADS_CLIENT_ID?.trim() || null,
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET?.trim() || null,
    refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim() || null,
  };
}

/** True when all Google Ads API credentials are configured. */
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

/** Normalizes Google Ads campaign name to match utm_campaign keys. */
export function googleAdsCampaignSpendKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, '_');
}

function normalizeCustomerId(value: string) {
  return value.replace(/\D/g, '');
}

function microsToCurrency(micros: number) {
  return Number((micros / 1_000_000).toFixed(2));
}

async function fetchGoogleAdsAccessToken() {
  if (tokenCache && tokenCache.expiresAtMs > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const creds = readGoogleAdsCredentials();
  if (!creds.clientId || !creds.clientSecret || !creds.refreshToken) {
    throw new Error('google_ads_not_configured');
  }

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
 */
export async function fetchGoogleAdsCampaignSpend(
  options: GoogleAdsSpendOptions,
): Promise<GoogleAdsSpendResult> {
  if (!isGoogleAdsApiConfigured()) {
    throw new Error('google_ads_not_configured');
  }

  const creds = readGoogleAdsCredentials();
  const developerToken = creds.developerToken!;
  const customerId = normalizeCustomerId(creds.customerId!);
  const loginCustomerId = creds.loginCustomerId
    ? normalizeCustomerId(creds.loginCustomerId)
    : null;

  const accessToken = await fetchGoogleAdsAccessToken();
  const prefix = options.campaignPrefix.toLowerCase();

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
        'developer-token': developerToken,
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
      const campaignName = row.campaign?.name?.trim();
      if (!campaignName) {
        continue;
      }
      if (!googleAdsCampaignSpendKey(campaignName).startsWith(prefix.replace(/\s+/g, '_'))) {
        if (!campaignName.toLowerCase().startsWith(prefix)) {
          continue;
        }
      }

      const micros = Number(row.metrics?.costMicros ?? 0);
      if (!Number.isFinite(micros) || micros <= 0) {
        continue;
      }

      const key = googleAdsCampaignSpendKey(campaignName);
      spendByCampaign[key] = Number(((spendByCampaign[key] ?? 0) + microsToCurrency(micros)).toFixed(2));
      currencyCode ??= row.customer?.currencyCode ?? null;
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
