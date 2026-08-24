type EvaluationStageRow = {
  leadId: number;
  result: unknown;
};

/**
 * Counts leads whose latest evaluation is won from rows ordered newest first.
 * @param evaluations Evaluation history ordered by evaluatedAt descending.
 * @returns Number of distinct leads currently classified as won.
 */
export function countLatestClosedWonSignals(evaluations: EvaluationStageRow[]) {
  const seenLeadIds = new Set<number>();
  let closedWon = 0;

  for (const evaluation of evaluations) {
    if (seenLeadIds.has(evaluation.leadId)) {
      continue;
    }
    seenLeadIds.add(evaluation.leadId);

    const { result } = evaluation;
    if (
      typeof result === 'object'
      && result !== null
      && 'stage' in result
      && result.stage === 'closed_won'
    ) {
      closedWon += 1;
    }
  }

  return closedWon;
}
