import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'integration-test-secret-with-32-characters';
const PROPOSAL_ID = '550e8400-e29b-41d4-a716-446655440000';

function query(rows: unknown[], capture?: (value: unknown) => void) {
  const promise = Promise.resolve(rows);
  return Object.assign(promise, {
    from() {
      return this;
    },
    where() {
      return this;
    },
    limit() {
      return this;
    },
    values(value: unknown) {
      capture?.(value);
      return this;
    },
    onConflictDoUpdate() {
      return this;
    },
    returning() {
      return this;
    },
  });
}

const mocks = vi.hoisted(() => ({
  judge: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  secret: 'integration-test-secret-with-32-characters' as string | undefined,
}));

const dbMock = vi.hoisted(() => {
  const state: { selectQueue: unknown[][]; inserts: unknown[]; insertRows: unknown[]; selectCalls: number } = {
    selectQueue: [],
    inserts: [],
    insertRows: [],
    selectCalls: 0,
  };

  return {
    state,
    db: {
      select: () => {
        state.selectCalls += 1;
        return query(state.selectQueue.shift() ?? []);
      },
      insert: () =>
        query(state.insertRows, (value) => {
          state.inserts.push(value);
        }),
    },
  };
});

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  },
}));
vi.mock('@/libs/Env', () => ({
  Env: {
    get CHATWOOT_WEBHOOK_SECRET() {
      return mocks.secret;
    },
  },
}));
vi.mock('@/libs/Logger', () => ({
  logger: { info: mocks.info, error: mocks.error, warn: vi.fn() },
}));
vi.mock('@/libs/DB', () => ({ db: dbMock.db }));
vi.mock('@/lib/closed-proposal-name-judge', () => ({
  judgeClosedProposalName: mocks.judge,
}));

import { GET, POST } from './route';

function signedRequest(body: string, secret = SECRET) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
  return new Request('https://example.test/api/webhooks/proposta-aprovada', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-chatwoot-timestamp': timestamp,
      'x-chatwoot-signature': signature,
    },
    body,
  });
}

function payload(overrides?: Record<string, unknown>) {
  return JSON.stringify({
    proposalId: PROPOSAL_ID,
    numero: '1042',
    approvedAt: '2026-10-22T19:26:00.000Z',
    valorTotal: 1500.5,
    companyName: 'Construtora Alfa',
    phones: ['31999998877'],
    contactNames: ['João'],
    attendance: [],
    ...overrides,
  });
}

describe('proposta aprovada webhook', () => {
  beforeEach(() => {
    mocks.judge.mockReset();
    mocks.info.mockReset();
    mocks.error.mockReset();
    mocks.secret = SECRET;
    mocks.judge.mockResolvedValue('insufficient');
    dbMock.state.selectQueue = [];
    dbMock.state.inserts = [];
    dbMock.state.insertRows = [];
    dbMock.state.selectCalls = 0;
  });

  it('returns 503 when the webhook secret is missing', async () => {
    mocks.secret = undefined;
    const response = await POST(signedRequest(payload()));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'webhook_not_configured' });
    expect(dbMock.state.selectCalls).toBe(0);
    expect(mocks.judge).not.toHaveBeenCalled();
  });

  it('rejects a bad signature', async () => {
    const response = await POST(signedRequest(payload(), 'another-integration-secret-32-characters'));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
    expect(mocks.judge).not.toHaveBeenCalled();
  });

  it('rejects invalid json', async () => {
    const response = await POST(signedRequest('not-json'));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_json' });
  });

  it('rejects an invalid body', async () => {
    const response = await POST(signedRequest(JSON.stringify({ proposalId: 'nope' })));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_body' });
    expect(dbMock.state.selectCalls).toBe(0);
  });

  it('records a phone match without calling the name judge', async () => {
    dbMock.state.selectQueue = [
      [],
      [{ phoneKey: '31999998877', leadId: 42, gclid: 'click', gbraid: null, wbraid: null, utmMedium: null }],
    ];
    dbMock.state.insertRows = [{ matchKind: 'phone', leadId: 42, traffic: true }];

    const response = await POST(signedRequest(payload()));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, match: 'phone' });
    expect(mocks.judge).not.toHaveBeenCalled();
    expect(dbMock.state.inserts[0]).toMatchObject({
      proposalId: PROPOSAL_ID,
      numero: '1042',
      valorTotal: '1500.50',
      matchKind: 'phone',
      leadId: 42,
      traffic: true,
    });
    expect(mocks.info).toHaveBeenCalledWith('Closed proposal recorded', {
      proposalId: PROPOSAL_ID,
      match: 'phone',
    });
  });

  it('asks the name judge once and records an ai match', async () => {
    mocks.judge.mockResolvedValue('same_account');
    dbMock.state.selectQueue = [
      [],
      [{ phoneKey: '31999998877', leadId: 7, gclid: 'click', gbraid: null, wbraid: null, utmMedium: null }],
    ];
    dbMock.state.insertRows = [{ matchKind: 'ai', leadId: 7, traffic: true }];

    const response = await POST(
      signedRequest(
        payload({
          phones: ['(31) 98888-7766'],
          attendance: [{ phoneKey: '31999998877', name: 'Ana', phoneMatched: false }],
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, match: 'ai' });
    expect(mocks.judge).toHaveBeenCalledOnce();
    expect(mocks.judge).toHaveBeenCalledWith({
      companyName: 'Construtora Alfa',
      contactNames: ['João'],
      attendanceName: 'Ana',
    });
    expect(dbMock.state.inserts[0]).toMatchObject({
      valorTotal: '1500.50',
      matchKind: 'ai',
      leadId: 7,
      traffic: true,
    });
  });

  it('returns an existing traffic match without calling the name judge', async () => {
    dbMock.state.selectQueue = [[{ matchKind: 'phone', leadId: 4, traffic: true }]];

    const response = await POST(signedRequest(payload({ valorTotal: 999 })));

    expect(await response.json()).toEqual({ ok: true, match: 'phone' });
    expect(mocks.judge).not.toHaveBeenCalled();
    expect(dbMock.state.inserts).toEqual([]);
    expect(dbMock.state.selectCalls).toBe(1);
  });

  it('reports whether the webhook secret is configured', async () => {
    const configured = await GET();
    expect(await configured.json()).toEqual({ service: 'proposta-aprovada', configured: true });
    mocks.secret = undefined;
    const missing = await GET();
    expect(await missing.json()).toEqual({ service: 'proposta-aprovada', configured: false });
  });
});
