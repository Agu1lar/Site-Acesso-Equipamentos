import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadMetaConfirmedContact } from '@/lib/meta-confirmed-contact';

const state = vi.hoisted(() => ({
  token: { metaContext: { consent: true, fbp: 'fb.1.123.456' }, claimedAt: new Date(), createdAt: new Date(0), metaContactSentAt: null as Date | null },
  configured: true,
}));
vi.mock('@/libs/Env', () => ({ Env: {
  get META_CONVERSIONS_ACCESS_TOKEN() { return state.configured ? 'test-token' : undefined; },
  NEXT_PUBLIC_META_PIXEL_ID: '123', META_GRAPH_API_VERSION: 'v26.0',
} }));
vi.mock('@/libs/DB', () => ({ db: {
  select: () => ({ from: () => ({ where: () => ({ orderBy: async () => [state.token] }) }) }),
  update: () => ({ set: (value: { metaContactSentAt: Date }) => ({ where: async () => { state.token.metaContactSentAt = value.metaContactSentAt; } }) }),
} }));

describe('Meta confirmed contact delivery', () => {
  const fetchMock = vi.fn();
  const input = { leadId: 1, phone: '31999991234', repliedAt: new Date() };
  beforeEach(() => {
    state.configured = true; state.token.metaContext.consent = true; state.token.metaContactSentAt = null;
    fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());
  it('skips missing credentials and missing consent without transmission', async () => {
    state.configured = false;
    expect(await uploadMetaConfirmedContact(input)).toMatchObject({ reason: 'not_configured' });
    state.configured = true; state.token.metaContext.consent = false;
    expect(await uploadMetaConfirmedContact(input)).toMatchObject({ reason: 'no_consented_site_reference' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('records successful delivery and skips repeated messages', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ events_received: 1 }) });
    expect(await uploadMetaConfirmedContact(input)).toEqual({ uploaded: true });
    expect(await uploadMetaConfirmedContact(input)).toMatchObject({ reason: 'duplicate' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('leaves failed deliveries retryable with a stable event id', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    await expect(uploadMetaConfirmedContact(input)).rejects.toThrow('http_503');
    expect(state.token.metaContactSentAt).toBeNull();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ events_received: 1 }) });
    expect(await uploadMetaConfirmedContact(input)).toEqual({ uploaded: true });
    expect(fetchMock.mock.calls[0]?.[1].body).toBe(fetchMock.mock.calls[1]?.[1].body);
  });
});
