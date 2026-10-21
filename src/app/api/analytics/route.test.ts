import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ record: vi.fn(), mint: vi.fn(), upload: vi.fn(), after: vi.fn(), warn: vi.fn() }));
vi.mock('next/server', () => ({ NextResponse: { json: (data: unknown, init?: ResponseInit) => Response.json(data, init) }, after: mocks.after }));
vi.mock('@/lib/analytics-events', () => ({ recordAnalyticsEvent: mocks.record }));
vi.mock('@/lib/whatsapp-attribution-token', () => ({ mintWhatsAppAttributionToken: mocks.mint }));
vi.mock('@/lib/google-ads-offline-conversions', () => ({ uploadGoogleAdsOfflineClickConversion: mocks.upload }));
vi.mock('@/libs/Logger', () => ({ logger: { warn: mocks.warn, error: vi.fn() } }));

import { POST } from './route';

const request = () => new Request('https://example.test/api/analytics', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ eventType: 'whatsapp_click', origin: 'site', attribution: { gclid: 'test-click' } }),
});

describe('WhatsApp click reference response', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.record.mockResolvedValue({ id: 12, reused: false });
    mocks.mint.mockResolvedValue('ABCD1234');
  });

  it('returns the reference without waiting for the Google upload', async () => {
    mocks.upload.mockImplementation(() => new Promise(() => {}));
    const response = await POST(request());
    expect(await response.json()).toEqual({ ok: true, refCode: 'ABCD1234' });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.after).toHaveBeenCalledOnce();
    mocks.upload.mockResolvedValue({ status: 'uploaded' });
    await mocks.after.mock.calls[0]![0]();
    expect(mocks.upload).toHaveBeenCalledWith({ analyticsEventId: 12, attribution: { gclid: 'test-click' } });
  });

  it('isolates a deferred upload failure from the WhatsApp link', async () => {
    mocks.upload.mockRejectedValue(new Error('Upload unavailable'));
    const response = await POST(request());
    expect(response.status).toBe(200);
    await expect(mocks.after.mock.calls[0]![0]()).resolves.toBeUndefined();
    expect(mocks.warn).toHaveBeenCalledOnce();
  });

  it('does not schedule duplicate conversion uploads for a reused click', async () => {
    mocks.record.mockResolvedValue({ id: 12, reused: true });
    const response = await POST(request());
    expect(await response.json()).toEqual({ ok: true, refCode: 'ABCD1234' });
    expect(mocks.after).not.toHaveBeenCalled();
  });
});
