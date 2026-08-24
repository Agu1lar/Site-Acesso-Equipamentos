import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbState = {
  rows: [] as Record<string, unknown>[],
  nextId: 1,
  updates: [] as Record<string, unknown>[],
};

vi.mock('@/libs/DB', () => ({
  db: {
    insert: () => ({
      values: (value: Record<string, unknown>) => ({
        returning: () => {
          const duplicate = dbState.rows.some(row => row.orderId === value.orderId);
          if (duplicate) {
            throw new Error('duplicate key value violates unique constraint');
          }

          const row = { id: dbState.nextId, ...value };
          dbState.nextId += 1;
          dbState.rows.push(row);
          return Promise.resolve([{ id: row.id }]);
        },
      }),
    }),
    update: () => ({
      set: (value: Record<string, unknown>) => ({
        where: () => {
          dbState.updates.push(value);
          return Promise.resolve();
        },
      }),
    }),
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

function stubGoogleAdsEnv() {
  vi.stubEnv('DATABASE_URL', 'postgresql://postgres:postgres@127.0.0.1:5433/postgres');
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_x');
  vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_x');
  vi.stubEnv('GOOGLE_ADS_DEVELOPER_TOKEN', 'developer-token');
  vi.stubEnv('GOOGLE_ADS_CUSTOMER_ID', '123-456-7890');
  vi.stubEnv('GOOGLE_ADS_CLIENT_ID', 'client-id');
  vi.stubEnv('GOOGLE_ADS_CLIENT_SECRET', 'client-secret');
  vi.stubEnv('GOOGLE_ADS_REFRESH_TOKEN', 'refresh-token');
  vi.stubEnv('GOOGLE_ADS_OFFLINE_CONVERSION_ACTION_ID', '987654321');
}

describe('google ads offline conversions', () => {
  beforeEach(() => {
    vi.resetModules();
    dbState.rows = [];
    dbState.updates = [];
    dbState.nextId = 1;
    stubGoogleAdsEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('uploads click conversion with gclid', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'access-token', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [{}] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { uploadGoogleAdsOfflineClickConversion } = await import(
      '@/lib/google-ads-offline-conversions'
    );

    const result = await uploadGoogleAdsOfflineClickConversion({
      analyticsEventId: 42,
      attribution: { gclid: 'gclid-123' },
      conversionDate: new Date('2026-08-21T14:13:00.000Z'),
    });

    expect(result.uploaded).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const uploadBody = JSON.parse(fetchMock.mock.calls[1][1].body as string) as {
      conversions: Record<string, unknown>[];
    };
    expect(uploadBody.conversions[0]).toMatchObject({
      conversionAction: 'customers/1234567890/conversionActions/987654321',
      conversionDateTime: '2026-08-21 14:13:00+00:00',
      conversionValue: 1,
      currencyCode: 'BRL',
      orderId: 'wa-42',
      gclid: 'gclid-123',
    });
    expect(dbState.updates[0]).toMatchObject({ status: 'uploaded' });
  });

  it('skips upload without click id', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { uploadGoogleAdsOfflineClickConversion } = await import(
      '@/lib/google-ads-offline-conversions'
    );

    const result = await uploadGoogleAdsOfflineClickConversion({
      analyticsEventId: 42,
      attribution: { utmCampaign: 'teste' },
    });

    expect(result).toEqual({ uploaded: false, reason: 'missing_click_id' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deduplicates by analytics event order id', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'access-token', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [{}] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { uploadGoogleAdsOfflineClickConversion } = await import(
      '@/lib/google-ads-offline-conversions'
    );

    await uploadGoogleAdsOfflineClickConversion({
      analyticsEventId: 42,
      attribution: { gclid: 'gclid-123' },
    });
    const second = await uploadGoogleAdsOfflineClickConversion({
      analyticsEventId: 42,
      attribution: { gclid: 'gclid-123' },
    });

    expect(second).toEqual({ uploaded: false, reason: 'duplicate' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('records partial failure response', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'access-token', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ partialFailureError: { message: 'CLICK_NOT_FOUND' } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { uploadGoogleAdsOfflineClickConversion } = await import(
      '@/lib/google-ads-offline-conversions'
    );

    const result = await uploadGoogleAdsOfflineClickConversion({
      analyticsEventId: 42,
      attribution: { gclid: 'gclid-123' },
    });

    expect(result).toEqual({ uploaded: false, reason: 'partial_failure' });
    expect(dbState.updates[0]).toMatchObject({
      status: 'failed',
      errorMessage: 'CLICK_NOT_FOUND',
    });
  });
});
