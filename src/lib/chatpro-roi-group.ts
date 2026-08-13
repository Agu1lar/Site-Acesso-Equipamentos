import type { ChatProRoiDashboardEvaluation } from '@/lib/chatpro-roi-dashboard-types';

export type ChatProRoiLeadEvaluationGroup = {
  leadId: number;
  latest: ChatProRoiDashboardEvaluation;
  previous: ChatProRoiDashboardEvaluation[];
};

/**
 * Groups evaluations by lead: newest first as latest, older ones as history.
 */
export function groupChatProRoiEvaluationsByLead(
  evaluations: ChatProRoiDashboardEvaluation[],
  leadLimit: number,
): ChatProRoiLeadEvaluationGroup[] {
  const byLead = new Map<number, ChatProRoiDashboardEvaluation[]>();

  for (const row of evaluations) {
    const existing = byLead.get(row.leadId);
    if (existing) {
      existing.push(row);
    } else {
      byLead.set(row.leadId, [row]);
    }
  }

  const groups: ChatProRoiLeadEvaluationGroup[] = [];

  for (const rows of byLead.values()) {
    const sorted = [...rows].sort(
      (a, b) => b.evaluatedAt.getTime() - a.evaluatedAt.getTime() || b.id - a.id,
    );
    const latest = sorted[0];
    if (!latest) {
      continue;
    }
    groups.push({
      leadId: latest.leadId,
      latest,
      previous: sorted.slice(1),
    });
  }

  groups.sort(
    (a, b) =>
      b.latest.evaluatedAt.getTime() - a.latest.evaluatedAt.getTime()
      || b.latest.id - a.latest.id,
  );

  return groups.slice(0, leadLimit);
}
