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
    orderBy() {
      return this;
    },
    set() {
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
      update: () => query([]),
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
    createdAt: '2026-10-22T18:00:00.000Z',
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
      [{
        id: 9,
        leadId: 42,
        phone: '31999998877',
        clickedAt: new Date('2026-10-01T00:00:00.000Z'),
        gclid: 'click',
        gbraid: null,
        wbraid: null,
        utmMedium: null,
      }],
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
      closed: true,
    });
    expect(mocks.info).toHaveBeenCalledWith('Closed proposal recorded', {
      proposalId: PROPOSAL_ID,
      match: 'phone',
    });
  });

  it('stores the proposal without traffic when the contact misses the paid click', async () => {
    dbMock.state.selectQueue = [
      [],
      [{
        id: 9,
        leadId: 7,
        phone: '31999998877',
        clickedAt: new Date('2026-10-01T00:00:00.000Z'),
        gclid: 'click',
        gbraid: null,
        wbraid: null,
        utmMedium: null,
      }],
    ];
    dbMock.state.insertRows = [{ matchKind: 'none', leadId: null, traffic: false }];

    const response = await POST(
      signedRequest(
        payload({
          phones: ['(31) 98888-7766'],
          attendance: [{ phoneKey: '31999998877', name: 'Ana', phoneMatched: false }],
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, match: 'none' });
    expect(mocks.judge).not.toHaveBeenCalled();
    expect(dbMock.state.inserts[0]).toMatchObject({
      valorTotal: '1500.50',
      matchKind: 'none',
      leadId: null,
      traffic: false,
    });
  });

  it('updates a proposal that was already recorded', async () => {
    dbMock.state.selectQueue = [
      [],
      [{
        id: 9,
        leadId: 4,
        phone: '31999998877',
        clickedAt: new Date('2026-10-01T00:00:00.000Z'),
        gclid: 'click',
        gbraid: null,
        wbraid: null,
        utmMedium: null,
      }],
    ];
    dbMock.state.insertRows = [{ matchKind: 'phone', leadId: 4, traffic: true }];

    const response = await POST(signedRequest(payload({ valorTotal: 999 })));

    expect(await response.json()).toEqual({ ok: true, match: 'phone' });
    expect(mocks.judge).not.toHaveBeenCalled();
    expect(dbMock.state.inserts[0]).toMatchObject({ valorTotal: '999.00', traffic: true, closed: true });
  });

  it('stores the closed value of each equipment segment', async () => {
    dbMock.state.selectQueue = [
      [],
      [{
        id: 9,
        leadId: 4,
        phone: '31999998877',
        clickedAt: new Date('2026-10-01T00:00:00.000Z'),
        gclid: 'click',
        gbraid: null,
        wbraid: null,
        utmMedium: null,
      }],
    ];
    dbMock.state.insertRows = [{ matchKind: 'phone', leadId: 4, traffic: true }];

    const response = await POST(signedRequest(payload({
      segments: { plataformas: 1000, guindastes: 500, andaimes: 200, ferramentas: 80 },
    })));

    expect(response.status).toBe(200);
    expect(dbMock.state.inserts[0]).toMatchObject({
      segmentPlataformas: '1000.00',
      segmentGuindastes: '500.00',
      segmentAndaimes: '200.00',
      segmentFerramentas: '80.00',
    });
  });

  it('stores Sandra as the seller of the closed proposal', async () => {
    dbMock.state.insertRows = [{ matchKind: 'none', leadId: null, traffic: false }];

    const response = await POST(signedRequest(payload({ seller: 'Sandra Silva' })));

    expect(response.status).toBe(200);
    expect(dbMock.state.inserts[0]).toMatchObject({ seller: 'Sandra' });
  });

  it('stores Andrezza as Renata', async () => {
    dbMock.state.insertRows = [{ matchKind: 'none', leadId: null, traffic: false }];

    const response = await POST(signedRequest(payload({ seller: 'Andrezza' })));

    expect(response.status).toBe(200);
    expect(dbMock.state.inserts[0]).toMatchObject({ seller: 'Renata' });
  });

  it('keeps a paid lead when a later post does not match the phone', async () => {
    const approvedAt = new Date('2026-10-22T19:26:00.000Z');
    dbMock.state.selectQueue = [
      [],
      [],
      [{
        leadId: 4,
        traffic: true,
        channel: 'paid',
        closed: true,
        matchKind: 'phone',
        proposalCreatedAt: new Date('2026-10-22T18:00:00.000Z'),
        approvedAt,
      }],
    ];
    dbMock.state.insertRows = [{ matchKind: 'phone', leadId: 4, traffic: true }];

    const response = await POST(signedRequest(payload({
      phones: [],
      channel: 'organic',
      closed: false,
      approvedAt: null,
      createdAt: null,
    })));

    expect(response.status).toBe(200);
    expect(dbMock.state.inserts[0]).toMatchObject({
      traffic: true,
      channel: 'paid',
      leadId: 4,
      closed: true,
      matchKind: 'phone',
      approvedAt,
    });
  });

  it('keeps a later proposal marked as recorrência when the phone no longer matches', async () => {
    dbMock.state.selectQueue = [
      [],
      [],
      [{
        leadId: null,
        traffic: true,
        channel: 'paid',
        closed: true,
        matchKind: 'phone',
        dealKind: 'ltv',
        proposalCreatedAt: new Date('2026-10-22T18:00:00.000Z'),
        approvedAt: new Date('2026-10-22T19:26:00.000Z'),
      }],
    ];
    dbMock.state.insertRows = [{ matchKind: 'phone', leadId: null, traffic: true }];

    const response = await POST(signedRequest(payload({
      phones: [],
      channel: 'organic',
      closed: false,
      approvedAt: null,
      createdAt: null,
    })));

    expect(response.status).toBe(200);
    expect(dbMock.state.inserts[0]).toMatchObject({
      traffic: true,
      channel: 'paid',
      dealKind: 'ltv',
    });
  });

  it('counts a proposal when the attendance contact is paid and the proposal is later', async () => {
    dbMock.state.insertRows = [{ matchKind: 'phone', leadId: null, traffic: true }];

    const response = await POST(signedRequest(payload({
      attendance: [{
        phoneKey: '31999998877',
        name: 'Ana',
        phoneMatched: true,
        channel: 'paid',
        paidAt: '2026-10-01T00:00:00.000Z',
      }],
    })));

    expect(response.status).toBe(200);
    expect(dbMock.state.inserts[0]).toMatchObject({
      traffic: true,
      channel: 'paid',
      matchKind: 'phone',
    });
  });

  it('leaves a proposal out when it was created before the paid attendance', async () => {
    dbMock.state.insertRows = [{ matchKind: 'none', leadId: null, traffic: false }];

    const response = await POST(signedRequest(payload({
      attendance: [{
        phoneKey: '31999998877',
        name: 'Ana',
        phoneMatched: true,
        channel: 'paid',
        paidAt: '2026-10-23T00:00:00.000Z',
      }],
    })));

    expect(response.status).toBe(200);
    expect(dbMock.state.inserts[0]).toMatchObject({
      traffic: false,
      channel: null,
      matchKind: 'none',
    });
  });

  it('leaves a proposal out when the same 8 digits belong to two numbers', async () => {
    dbMock.state.insertRows = [{ matchKind: 'none', leadId: null, traffic: false }];

    const response = await POST(signedRequest(payload({
      phones: ['31999998877'],
      attendance: [
        {
          phoneKey: '31999998877',
          name: 'Ana',
          phoneMatched: true,
          channel: 'paid',
          paidAt: '2026-10-01T00:00:00.000Z',
        },
        {
          phoneKey: '11999998877',
          name: 'Bruno',
          phoneMatched: true,
          channel: 'paid',
          paidAt: '2026-10-01T00:00:00.000Z',
        },
      ],
    })));

    expect(response.status).toBe(200);
    expect(dbMock.state.inserts[0]).toMatchObject({
      traffic: false,
      channel: null,
      matchKind: 'none',
    });
  });

  it('reports whether the webhook secret is configured', async () => {
    const configured = await GET();
    expect(await configured.json()).toEqual({ service: 'proposta-aprovada', configured: true });
    mocks.secret = undefined;
    const missing = await GET();
    expect(await missing.json()).toEqual({ service: 'proposta-aprovada', configured: false });
  });
});
