import { afterEach, describe, expect, it, vi } from 'vitest';

const anthropicEnv = vi.hoisted(() => ({
  ANTHROPIC_API_KEY: undefined as string | undefined,
  ANTHROPIC_MODEL: 'claude-test',
}));

vi.mock('@/libs/Env', () => ({ Env: anthropicEnv }));

import { judgeClosedProposalName, parseNameJudgement } from '@/lib/closed-proposal-name-judge';

const namedInput = {
  companyName: ' Acesso Equipamentos ',
  contactNames: [' Maria Silva ', 'João'],
  attendanceName: ' Acesso ',
};

describe('parseNameJudgement', () => {
  it('accepts same_account', () => {
    expect(parseNameJudgement('same_account')).toBe('same_account');
    expect(parseNameJudgement('  SAME_ACCOUNT  ')).toBe('same_account');
    expect(parseNameJudgement('\n\n same_account \nextra')).toBe('same_account');
  });

  it('rejects prose', () => {
    expect(parseNameJudgement('não dá para saber')).toBe('insufficient');
    expect(parseNameJudgement('same_account insufficient')).toBe('insufficient');
  });

  it('rejects empty text', () => {
    expect(parseNameJudgement('')).toBe('insufficient');
    expect(parseNameJudgement(' \n\t ')).toBe('insufficient');
  });

  it('rejects a sentence that contains the token', () => {
    expect(parseNameJudgement('acho que é same_account')).toBe('insufficient');
  });
});

describe('judgeClosedProposalName', () => {
  afterEach(() => {
    anthropicEnv.ANTHROPIC_API_KEY = undefined;
    vi.unstubAllGlobals();
  });

  it('returns insufficient when names are blank', async () => {
    anthropicEnv.ANTHROPIC_API_KEY = 'sk-ant-test';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(judgeClosedProposalName({
      companyName: '  ',
      contactNames: ['', '  '],
      attendanceName: 'Acesso',
    })).resolves.toBe('insufficient');
    await expect(judgeClosedProposalName({
      companyName: 'Acesso Equipamentos',
      contactNames: ['Maria Silva'],
      attendanceName: ' ',
    })).resolves.toBe('insufficient');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns insufficient when the key is missing', async () => {
    anthropicEnv.ANTHROPIC_API_KEY = undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(judgeClosedProposalName(namedInput)).resolves.toBe('insufficient');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns same_account when the model answers same_account', async () => {
    anthropicEnv.ANTHROPIC_API_KEY = 'sk-ant-test';
    const fetchMock = vi.fn(async () => Response.json({
      content: [{ type: 'text', text: 'same_account' }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(judgeClosedProposalName(namedInput)).resolves.toBe('same_account');

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'x-api-key': 'sk-ant-test',
      },
    });
    const body = JSON.parse(String(init?.body)) as {
      model: string;
      max_tokens: number;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe('claude-test');
    expect(body.max_tokens).toBe(20);
    expect(body.messages[0]?.content).toBe([
      'Conversa: Acesso',
      'Empresa: Acesso Equipamentos',
      'Contatos: Maria Silva; João',
    ].join('\n'));
  });

  it('returns insufficient when the request returns 500', async () => {
    anthropicEnv.ANTHROPIC_API_KEY = 'sk-ant-test';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('upstream', { status: 500 })));

    await expect(judgeClosedProposalName(namedInput)).resolves.toBe('insufficient');
  });
});
