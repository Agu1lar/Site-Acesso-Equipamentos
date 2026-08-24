import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyExplicitCustomerLossGuardrail,
  applyRoleGuardrails,
  evaluateChatProLeadWithClaude,
  selectMessagesForClaudeAnalysis,
} from '@/lib/chatpro-roi-ai-core';

const sampleEvaluation = {
  stage: 'negotiation',
  intentScore: 78,
  dealLikelihood: 65,
  estimatedMonthlyValueBrl: 4800,
  contractDetected: false,
  contractConsistent: null,
  contractNotes: null,
  equipmentMentioned: ['plataforma tesoura 12m'],
  summary:
    'Cliente de campanha pediu plataforma tesoura 12m por 30 dias em Contagem; comercial passou valor mensal e cliente sinalizou fechamento.',
  suggestedStatus: 'quoted',
  detectedContactName: null,
  detectedEmail: null,
  roiNotes: 'Lead quente com valor mensal informado; acompanhar envio de contrato.',
  followUpPriority: 'high',
};

describe('selectMessagesForClaudeAnalysis', () => {
  const messages = [
    {
      id: 1,
      fromMe: false,
      messageText: 'Oi',
      mediaType: null,
      mediaFilename: null,
      mediaMimetype: null,
      mediaUrl: null,
      eventAt: new Date('2026-08-12T14:00:00.000Z'),
    },
    {
      id: 2,
      fromMe: true,
      messageText: 'Olá',
      mediaType: null,
      mediaFilename: null,
      mediaMimetype: null,
      mediaUrl: null,
      eventAt: new Date('2026-08-12T14:01:00.000Z'),
    },
    {
      id: 3,
      fromMe: false,
      messageText: 'Vamos fechar',
      mediaType: null,
      mediaFilename: null,
      mediaMimetype: null,
      mediaUrl: null,
      eventAt: new Date('2026-08-12T14:02:00.000Z'),
    },
  ];

  it('returns full thread on first analysis', () => {
    const selected = selectMessagesForClaudeAnalysis(messages, null);
    expect(selected.mode).toBe('full');
    expect(selected.messages).toHaveLength(3);
  });

  it('returns only new messages after prior lastMessageId', () => {
    const selected = selectMessagesForClaudeAnalysis(messages, 1);
    expect(selected.mode).toBe('incremental');
    expect(selected.messages.map((message) => message.id)).toEqual([2, 3]);
  });

  it('reprocesses full thread when incremental batch has media', () => {
    const withImage = [
      ...messages,
      {
        id: 4,
        fromMe: true,
        messageText: 'Segue NF',
        mediaType: 'image',
        mediaFilename: 'nf.jpg',
        mediaMimetype: 'image/jpeg',
        mediaUrl: 'https://cdn.chatpro.com.br/nf.jpg',
        eventAt: new Date('2026-08-12T14:03:00.000Z'),
      },
    ];
    const selected = selectMessagesForClaudeAnalysis(withImage, 3);
    expect(selected.mode).toBe('full');
    expect(selected.messages).toHaveLength(4);
  });
});

describe('applyExplicitCustomerLossGuardrail', () => {
  it('marks demand resolved elsewhere as lost', () => {
    const result = applyExplicitCustomerLossGuardrail(
      { ...sampleEvaluation, stage: 'closed_won', suggestedStatus: 'won', dealLikelihood: 92 },
      [
        {
          id: 1,
          fromMe: true,
          messageText: 'Conseguiu falar com o José sobre a documentação?',
          mediaType: null,
          mediaFilename: null,
          mediaMimetype: null,
          mediaUrl: null,
          eventAt: new Date('2026-08-20T11:54:00.000Z'),
        },
        {
          id: 2,
          fromMe: false,
          messageText: 'O José Geraldo resolveu de outra forma. Muito obrigado por sua ajuda.',
          mediaType: null,
          mediaFilename: null,
          mediaMimetype: null,
          mediaUrl: null,
          eventAt: new Date('2026-08-20T12:03:00.000Z'),
        },
      ],
    );

    expect(result).toMatchObject({
      stage: 'closed_lost',
      suggestedStatus: 'lost',
      dealLikelihood: 0,
      followUpPriority: 'low',
    });
    expect(result.summary).toContain('sem locação');
  });

  it('preserves a reopened demand after an earlier external solution', () => {
    const result = applyExplicitCustomerLossGuardrail(
      sampleEvaluation,
      [
        {
          id: 1,
          fromMe: false,
          messageText: 'Resolvi de outra forma.',
          mediaType: null,
          mediaFilename: null,
          mediaMimetype: null,
          mediaUrl: null,
          eventAt: new Date('2026-08-20T12:03:00.000Z'),
        },
        {
          id: 2,
          fromMe: false,
          messageText: 'A nova obra começou e agora preciso do martelete novamente.',
          mediaType: null,
          mediaFilename: null,
          mediaMimetype: null,
          mediaUrl: null,
          eventAt: new Date('2026-08-20T13:03:00.000Z'),
        },
      ],
    );

    expect(result).toEqual(sampleEvaluation);
  });

  it('keeps the loss after a later neutral acknowledgement', () => {
    const result = applyExplicitCustomerLossGuardrail(
      sampleEvaluation,
      [
        {
          id: 1,
          fromMe: false,
          messageText: 'Resolvi de outra forma.',
          mediaType: null,
          mediaFilename: null,
          mediaMimetype: null,
          mediaUrl: null,
          eventAt: new Date('2026-08-20T12:03:00.000Z'),
        },
        {
          id: 2,
          fromMe: false,
          messageText: 'Obrigado, abraço.',
          mediaType: null,
          mediaFilename: null,
          mediaMimetype: null,
          mediaUrl: null,
          eventAt: new Date('2026-08-20T12:04:00.000Z'),
        },
      ],
    );

    expect(result.stage).toBe('closed_lost');
    expect(result.suggestedStatus).toBe('lost');
  });
});

describe('applyRoleGuardrails', () => {
  it('treats Pedro in from-me messages as seller, not company or lead contact', () => {
    const result = applyRoleGuardrails(
      {
        ...sampleEvaluation,
        summary: 'Empresa (Pedro) mantém contato cordial com Erica.',
        roiNotes: 'Empresa (Pedro) precisa enviar orçamento.',
        detectedContactName: 'Pedro',
      },
      [
        {
          id: 1,
          fromMe: true,
          messageText: 'Olá, aqui é Pedro do comercial da Acesso.',
          mediaType: null,
          mediaFilename: null,
          mediaMimetype: null,
          mediaUrl: null,
          eventAt: new Date('2026-08-20T12:03:00.000Z'),
        },
      ],
    );

    expect(result.summary).toBe('vendedor Pedro mantém contato cordial com Erica.');
    expect(result.roiNotes).toBe('vendedor Pedro precisa enviar orçamento.');
    expect(result.detectedContactName).toBeNull();
  });
});

describe('evaluateChatProLeadWithClaude', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses structured Claude ROI response', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        content: [{ type: 'text', text: JSON.stringify(sampleEvaluation) }],
        stop_reason: 'end_turn',
      }),
    );
    vi.stubGlobal(
      'fetch',
      fetchMock,
    );

    const result = await evaluateChatProLeadWithClaude(
      {
        id: 1,
        name: 'Lead Sandbox',
        status: 'contacted',
        equipmentName: 'Plataforma tesoura 12m',
        city: 'Contagem',
        message: 'Preciso de plataforma',
        utmCampaign: 'nova_plataformas_mg',
        utmSource: 'google',
        utmMedium: 'cpc',
        gclid: 'sandbox-gclid',
      },
      [
        {
          id: 1,
          fromMe: false,
          messageText: 'Quero plataforma tesoura 12m por 30 dias. Cód. AB12CD34',
          mediaType: null,
          mediaFilename: null,
          mediaMimetype: null,
          mediaUrl: null,
          eventAt: new Date('2026-08-12T14:00:00.000Z'),
        },
      ],
      { apiKey: 'sk-ant-test', model: 'claude-haiku-4-5-20251001' },
    );

    expect(result.stage).toBe('negotiation');
    expect(result.dealLikelihood).toBe(65);
    expect(result.equipmentMentioned).toContain('plataforma tesoura 12m');

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      messages: Array<{ content: Array<{ text?: string }> }>;
    };
    const prompt = body.messages[0]?.content[0]?.text ?? '';
    expect(prompt).toContain('[2026-08-12 11:00 America/Sao_Paulo] Cliente:');
    expect(prompt).toContain('Linhas marcadas como "Vendedor da Acesso"');
    expect(prompt).toContain('Fuso da linha do tempo: America/Sao_Paulo');
  });

  it('maps Anthropic 401 to anthropic_auth_invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            type: 'error',
            error: { type: 'authentication_error', message: 'API key is invalid.' },
          },
          { status: 401 },
        ),
      ),
    );

    await expect(
      evaluateChatProLeadWithClaude(
        {
          id: 1,
          name: 'Lead',
          status: 'new',
          equipmentName: null,
          city: null,
          message: null,
          utmCampaign: null,
          utmSource: null,
          utmMedium: null,
          gclid: 'x',
        },
        [
          {
            id: 1,
            fromMe: false,
            messageText: 'Oi',
            mediaType: null,
            mediaFilename: null,
            mediaMimetype: null,
            mediaUrl: null,
            eventAt: new Date(),
          },
        ],
        { apiKey: 'sk-ant-invalid', model: 'claude-haiku-4-5-20251001' },
      ),
    ).rejects.toThrow('anthropic_auth_invalid');
  });
});
