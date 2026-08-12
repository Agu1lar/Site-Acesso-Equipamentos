import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchGoogleAdsCampaignSpend,
  googleAdsCampaignSpendKey,
  isGoogleAdsApiConfigured,
  resetGoogleAdsTokenCacheForTests,
} from '@/lib/google-ads-spend';

describe('googleAdsCampaignSpendKey', () => {
  it('lowercases and replaces spaces with underscores', () => {
    expect(googleAdsCampaignSpendKey('Nova Plataformas MG')).toBe('nova_plataformas_mg');
  });
});

describe('fetchGoogleAdsCampaignSpend', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetGoogleAdsTokenCacheForTests();
  });

  it('returns not configured without env', async () => {
    vi.stubEnv('GOOGLE_ADS_DEVELOPER_TOKEN', '');
    expect(isGoogleAdsApiConfigured()).toBe(false);
    await expect(fetchGoogleAdsCampaignSpend({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      campaignPrefix: 'nova_',
    })).rejects.toThrow('google_ads_not_configured');
  });

  it('aggregates campaign cost_micros from search response', async () => {
    vi.stubEnv('GOOGLE_ADS_DEVELOPER_TOKEN', 'dev-token');
    vi.stubEnv('GOOGLE_ADS_CUSTOMER_ID', '1234567890');
    vi.stubEnv('GOOGLE_ADS_CLIENT_ID', 'client-id');
    vi.stubEnv('GOOGLE_ADS_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('GOOGLE_ADS_REFRESH_TOKEN', 'refresh-token');

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'access-token', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              campaign: { name: 'nova_plataformas_mg' },
              metrics: { costMicros: '2400000000' },
              customer: { currencyCode: 'BRL' },
            },
            {
              campaign: { name: 'nova_outra' },
              metrics: { costMicros: '500000000' },
            },
            {
              campaign: { name: 'legacy_old' },
              metrics: { costMicros: '1000000000' },
            },
          ],
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchGoogleAdsCampaignSpend({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      campaignPrefix: 'nova_',
    });

    expect(result.spendByCampaign).toEqual({
      nova_plataformas_mg: 2400,
      nova_outra: 500,
    });
    expect(result.currencyCode).toBe('BRL');
    expect(result.campaignsMatched).toBe(2);
  });
});
