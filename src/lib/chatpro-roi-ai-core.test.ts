import { afterEach, describe, expect, it, vi } from 'vitest';
import {
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

describe('evaluateChatProLeadWithClaude', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses structured Claude ROI response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          content: [{ type: 'text', text: JSON.stringify(sampleEvaluation) }],
          stop_reason: 'end_turn',
        }),
      ),
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
