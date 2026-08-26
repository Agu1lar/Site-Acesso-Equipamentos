import { describe, expect, it } from 'vitest';
import {
  sanitizeChatProRoiEvaluationProse,
  sanitizeChatProRoiProse,
} from '@/lib/chatpro-roi-prose';

describe('sanitizeChatProRoiProse', () => {
  it('replaces stage and CRM tokens with Portuguese labels', () => {
    const input =
      'Falta envio formal para avançar para proposal_sent. Estágio inicial de inquiry; marcar como quoted. Depois closed_won.';

    expect(sanitizeChatProRoiProse(input)).toBe(
      'Falta envio formal para avançar para proposta enviada. Estágio inicial de consulta; marcar como orçamento enviado. Depois ganho.',
    );
  });

  it('replaces tracking and schema jargon', () => {
    expect(
      sanitizeChatProRoiProse('Lead com gclid e utm_campaign. Ver suggestedStatus e dealLikelihood.'),
    ).toBe(
      'Lead com clique pago do Google e campanha. Ver status sugerido e chance de fechamento.',
    );
  });

  it('sanitizes evaluation free-text fields together', () => {
    const result = sanitizeChatProRoiEvaluationProse({
      summary: 'Avançou de inquiry para negotiation.',
      roiNotes: 'Priorizar proposal_sent.',
      contractNotes: 'Sem closed_won ainda.',
    });

    expect(result).toEqual({
      summary: 'Avançou de consulta para negociação.',
      roiNotes: 'Priorizar proposta enviada.',
      contractNotes: 'Sem ganho ainda.',
    });
  });
});
