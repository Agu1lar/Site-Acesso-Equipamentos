import { describe, expect, it } from 'vitest';
import { ChatProRoiEvaluationSchema } from '@/validations/chatpro-roi';

const baseEvaluation = {
  stage: 'inquiry',
  intentScore: 40,
  dealLikelihood: 30,
  estimatedMonthlyValueBrl: null,
  contractDetected: false,
  contractConsistent: null,
  contractNotes: null,
  equipmentMentioned: ['plataforma'],
  summary: 'Cliente pediu orçamento de plataforma elevatória para obra em Contagem.',
  suggestedStatus: 'contacted',
  roiNotes: 'Acompanhar retorno do comercial.',
  followUpPriority: 'medium',
};

describe('ChatProRoiEvaluationSchema', () => {
  it('accepts null detectedContactName and detectedEmail', () => {
    const parsed = ChatProRoiEvaluationSchema.parse({
      ...baseEvaluation,
      detectedContactName: null,
      detectedEmail: null,
    });

    expect(parsed.detectedContactName).toBeNull();
    expect(parsed.detectedEmail).toBeNull();
  });

  it('accepts omitted detected contact fields as null', () => {
    const parsed = ChatProRoiEvaluationSchema.parse(baseEvaluation);

    expect(parsed.detectedContactName).toBeNull();
    expect(parsed.detectedEmail).toBeNull();
  });

  it('keeps a valid detected email and contact name', () => {
    const parsed = ChatProRoiEvaluationSchema.parse({
      ...baseEvaluation,
      detectedContactName: 'João Silva',
      detectedEmail: 'joao@empresa.com',
    });

    expect(parsed.detectedContactName).toBe('João Silva');
    expect(parsed.detectedEmail).toBe('joao@empresa.com');
  });

  it('rejects an invalid detected email', () => {
    const result = ChatProRoiEvaluationSchema.safeParse({
      ...baseEvaluation,
      detectedContactName: 'Ana',
      detectedEmail: 'nao-e-email',
    });

    expect(result.success).toBe(false);
  });
});
