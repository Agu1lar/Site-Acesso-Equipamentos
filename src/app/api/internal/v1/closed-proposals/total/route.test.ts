import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  total: vi.fn(),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  },
}));
vi.mock('@/lib/closed-proposal-name-judge', () => ({
  judgeClosedProposalName: vi.fn(),
}));
vi.mock('@/lib/closed-proposal-store', () => ({
  trafficClosedTotal: mocks.total,
}));

import { GET } from './route';

function requestWithAuth(token?: string) {
  return new Request('https://example.test/api/internal/v1/closed-proposals/total', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

describe('closed proposal traffic total', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    mocks.total.mockReset();
  });

  it('returns 503 when the internal secret is missing', async () => {
    vi.stubEnv('INTERNAL_API_SECRET', '');
    const response = await GET(requestWithAuth('token'));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'internal_api_not_configured' });
    expect(mocks.total).not.toHaveBeenCalled();
  });

  it('returns 401 when the bearer token is wrong', async () => {
    vi.stubEnv('INTERNAL_API_SECRET', 'super-secret-token-with-length');
    const response = await GET(requestWithAuth('wrong-token'));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
  });

  it('returns the traffic closed total', async () => {
    vi.stubEnv('INTERNAL_API_SECRET', 'super-secret-token-with-length');
    mocks.total.mockResolvedValue({ proposals: 2, valorTotal: '1500.50' });
    const response = await GET(requestWithAuth('super-secret-token-with-length'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ proposals: 2, valorTotal: '1500.50' });
  });
});
