/**
 * Replaces internal ChatPro ROI enum/token jargon in free-text fields with
 * Portuguese labels so summaries stay readable for commercial users.
 */

/** Longer tokens first so `proposal_sent` wins over partial matches. */
const ROI_PROSE_TOKEN_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bproposal_sent\b/giu, 'proposta enviada'],
  [/\bcontract_sent\b/giu, 'contrato enviado'],
  [/\bclosed_won\b/giu, 'ganho'],
  [/\bclosed_lost\b/giu, 'perdido'],
  [/\bfollowUpPriority\b/giu, 'prioridade de follow-up'],
  [/\bdealLikelihood\b/giu, 'chance de fechamento'],
  [/\bestimatedMonthlyValueBrl\b/giu, 'valor mensal estimado'],
  [/\bdetectedContactName\b/giu, 'nome do contato'],
  [/\bdetectedEmail\b/giu, 'e-mail detectado'],
  [/\bsuggestedStatus\b/giu, 'status sugerido'],
  [/\bmessageCount\b/giu, 'quantidade de mensagens'],
  [/\butmCampaign\b/giu, 'campanha'],
  [/\butm_source\b/giu, 'origem da campanha'],
  [/\butm_medium\b/giu, 'mídia da campanha'],
  [/\butm_campaign\b/giu, 'campanha'],
  [/\butm_content\b/giu, 'conteúdo da campanha'],
  [/\butm_term\b/giu, 'termo da campanha'],
  [/\bgclid\b/giu, 'clique pago do Google'],
  [/\bgbraid\b/giu, 'clique pago do Google'],
  [/\bwbraid\b/giu, 'clique pago do Google'],
  [/\binquiry\b/giu, 'consulta'],
  [/\bnegotiation\b/giu, 'negociação'],
  [/\bstalled\b/giu, 'parado'],
  [/\bunknown\b/giu, 'indefinido'],
  [/\bcontacted\b/giu, 'em contato'],
  [/\bquoted\b/giu, 'orçamento enviado'],
  [/\bqualified\b/giu, 'orçamento enviado'],
  [/\bwon\b/giu, 'ganho'],
  [/\blost\b/giu, 'perdido'],
];

/**
 * Rewrites known ROI jargon tokens inside a free-text string.
 */
export function sanitizeChatProRoiProse(text: string | null | undefined) {
  if (!text) {
    return text ?? '';
  }

  let next = text;
  for (const [pattern, replacement] of ROI_PROSE_TOKEN_REPLACEMENTS) {
    next = next.replace(pattern, replacement);
  }
  return next.replaceAll(/\s{2,}/gu, ' ').trim();
}

type RoiTextFields = {
  summary: string;
  roiNotes: string;
  contractNotes: string | null;
};

/**
 * Sanitizes the free-text fields of a ChatPro ROI evaluation payload.
 */
export function sanitizeChatProRoiEvaluationProse<T extends RoiTextFields>(evaluation: T): T {
  return {
    ...evaluation,
    summary: sanitizeChatProRoiProse(evaluation.summary),
    roiNotes: sanitizeChatProRoiProse(evaluation.roiNotes),
    contractNotes: evaluation.contractNotes
      ? sanitizeChatProRoiProse(evaluation.contractNotes)
      : evaluation.contractNotes,
  };
}
