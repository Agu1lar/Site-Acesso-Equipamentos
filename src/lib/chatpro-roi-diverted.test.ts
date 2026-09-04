import { describe, expect, it } from 'vitest';
import {
  applyCommercialHandoffGuardrail,
  extractCommercialHandoffPhone,
  formatDivertedPhoneDisplay,
  formatRoiStageLabel,
} from '@/lib/chatpro-roi-diverted';
import type { ChatProRoiEvaluation } from '@/validations/chatpro-roi';

const baseEvaluation: ChatProRoiEvaluation = {
  stage: 'inquiry',
  intentScore: 40,
  dealLikelihood: 30,
  estimatedMonthlyValueBrl: null,
  contractDetected: false,
  contractConsistent: null,
  contractNotes: null,
  equipmentMentioned: ['plataforma'],
  summary: 'Cliente pediu orçamento de plataforma em Belo Horizonte.',
  suggestedStatus: 'contacted',
  detectedContactName: null,
  detectedEmail: null,
  divertedToPhone: null,
  roiNotes: 'Acompanhar retorno.',
  followUpPriority: 'medium',
};

function msg(id: number, fromMe: boolean, messageText: string) {
  return {
    id,
    fromMe,
    messageText,
    mediaType: null,
    mediaFilename: null,
    mediaMimetype: null,
    mediaUrl: null,
    eventAt: new Date('2026-09-01T20:00:00.000Z'),
  };
}

describe('formatDivertedPhoneDisplay', () => {
  it('formats an 11-digit mobile with ddd', () => {
    expect(formatDivertedPhoneDisplay('5531994700201')).toBe('(31) 99470-0201');
  });
});

describe('extractCommercialHandoffPhone', () => {
  it('reads a chama-no handoff', () => {
    expect(extractCommercialHandoffPhone('Pode chamar no (31) 99470-0201')).toBe('(31) 99470-0201');
  });

  it('reads a wa.me handoff', () => {
    expect(extractCommercialHandoffPhone('Segue o comercial: https://wa.me/5531994700201')).toBe(
      '(31) 99470-0201',
    );
  });

  it('ignores a phone without handoff wording', () => {
    expect(extractCommercialHandoffPhone('A sede fica no (31) 3376-3377')).toBeNull();
  });
});

describe('applyCommercialHandoffGuardrail', () => {
  it('marks a seller divert as diverted with the commercial number', () => {
    const result = applyCommercialHandoffGuardrail(baseEvaluation, [
      msg(1, false, 'Oi, quero plataforma em BH'),
      msg(2, true, 'Vou te desviar para o comercial. Chama no (31) 99470-0201'),
      msg(3, false, 'Ok, vou chamar'),
    ]);

    expect(result.stage).toBe('diverted');
    expect(result.divertedToPhone).toBe('(31) 99470-0201');
    expect(result.roiNotes).toContain('Desviado (31) 99470-0201');
  });

  it('keeps the conversation when the client continues on this chat', () => {
    const result = applyCommercialHandoffGuardrail(baseEvaluation, [
      msg(1, true, 'Chama no (31) 99470-0201'),
      msg(2, false, 'Na verdade preciso da tesoura 12m por 10 dias nesta obra'),
    ]);

    expect(result.stage).toBe('inquiry');
  });

  it('does not override a closed won deal', () => {
    const result = applyCommercialHandoffGuardrail(
      { ...baseEvaluation, stage: 'closed_won', suggestedStatus: 'won' },
      [msg(1, true, 'Chama no (31) 99470-0201')],
    );

    expect(result.stage).toBe('closed_won');
  });
});

describe('formatRoiStageLabel', () => {
  it('appends the diverted phone to the stage label', () => {
    const label = formatRoiStageLabel({
      stage: 'diverted',
      divertedToPhone: '(31) 99470-0201',
      stageLabels: {
        inquiry: 'Consulta',
        negotiation: 'Negociação',
        proposal_sent: 'Proposta enviada',
        contract_sent: 'Contrato enviado',
        closed_won: 'Ganho',
        closed_lost: 'Perdido',
        stalled: 'Parado',
        diverted: 'Desviado',
        unknown: 'Indefinido',
      },
      divertedWithPhone: (phone) => `Desviado ${phone}`,
    });

    expect(label).toBe('Desviado (31) 99470-0201');
  });
});
