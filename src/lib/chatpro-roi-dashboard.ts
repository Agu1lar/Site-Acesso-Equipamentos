import 'server-only';

import { count } from 'drizzle-orm';
import { countPendingChatProOutboxEvents } from '@/lib/chatpro-outbox';
import type { ChatProRoiDashboardEvaluation } from '@/lib/chatpro-roi-dashboard-types';
import {
  groupChatProRoiEvaluationsByLead,
  type ChatProRoiLeadEvaluationGroup,
} from '@/lib/chatpro-roi-group';
import {
  countPendingChatProRoiEvaluations,
  listRecentChatProRoiEvaluations,
} from '@/lib/chatpro-roi-worker';
import {
  ChatProRoiEvaluationSchema,
  type ChatProRoiEvaluation,
} from '@/validations/chatpro-roi';
import { db } from '@/libs/DB';
import {
  chatproLeadEvaluationsSchema,
  chatproMessagesSchema,
} from '@/models/Schema';

export type { ChatProRoiDashboardEvaluation } from '@/lib/chatpro-roi-dashboard-types';
export type { ChatProRoiLeadEvaluationGroup } from '@/lib/chatpro-roi-group';
export { groupChatProRoiEvaluationsByLead } from '@/lib/chatpro-roi-group';

export type ChatProRoiDashboardSummary = {
  pendingOutboxEvents: number;
  pendingEvaluations: number;
  totalMessages: number;
  totalEvaluations: number;
  closedWonSignals: number;
  leadGroups: ChatProRoiLeadEvaluationGroup[];
  schemaIncomplete: boolean;
};

const emptySummary: ChatProRoiDashboardSummary = {
  pendingOutboxEvents: 0,
  pendingEvaluations: 0,
  totalMessages: 0,
  totalEvaluations: 0,
  closedWonSignals: 0,
  leadGroups: [],
  schemaIncomplete: true,
};

function parseEvaluationResult(raw: unknown): ChatProRoiEvaluation | null {
  const parsed = ChatProRoiEvaluationSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function mapEvaluationRow(row: Awaited<ReturnType<typeof listRecentChatProRoiEvaluations>>[number]): ChatProRoiDashboardEvaluation {
  const result = parseEvaluationResult(row.result);

  return {
    id: row.id,
    leadId: row.leadId,
    leadName: row.leadName,
    leadStatus: row.leadStatus,
    utmCampaign: row.utmCampaign,
    evaluatedAt: row.evaluatedAt,
    messageCount: row.messageCount,
    trigger: row.trigger,
    stage: result?.stage ?? 'unknown',
    dealLikelihood: result?.dealLikelihood ?? 0,
    followUpPriority: result?.followUpPriority ?? 'low',
    suggestedStatus: result?.suggestedStatus ?? null,
    contractDetected: result?.contractDetected ?? false,
    estimatedMonthlyValueBrl: result?.estimatedMonthlyValueBrl ?? null,
    summary: result?.summary ?? '',
  };
}

/**
 * Loads ChatPro ROI metrics and recent evaluations for the dashboard page.
 */
export async function getChatProRoiDashboardSummary(options?: {
  limit?: number;
}): Promise<ChatProRoiDashboardSummary> {
  const leadLimit = Math.min(Math.max(options?.limit ?? 30, 1), 100);
  const fetchLimit = Math.min(leadLimit * 5, 200);

  try {
    const [
      pendingOutboxEvents,
      pendingEvaluations,
      evaluationRows,
      messageCountRows,
      evaluationCountRows,
    ] = await Promise.all([
      countPendingChatProOutboxEvents(),
      countPendingChatProRoiEvaluations(),
      listRecentChatProRoiEvaluations(undefined, fetchLimit),
      db.select({ value: count() }).from(chatproMessagesSchema),
      db.select({ value: count() }).from(chatproLeadEvaluationsSchema),
    ]);

    const evaluations = evaluationRows.map(mapEvaluationRow);
    const leadGroups = groupChatProRoiEvaluationsByLead(evaluations, leadLimit);
    const closedWonSignals = leadGroups.filter(
      (group) => group.latest.stage === 'closed_won',
    ).length;

    return {
      pendingOutboxEvents,
      pendingEvaluations,
      totalMessages: Number(messageCountRows[0]?.value ?? 0),
      totalEvaluations: Number(evaluationCountRows[0]?.value ?? 0),
      closedWonSignals,
      leadGroups,
      schemaIncomplete: false,
    };
  } catch {
    return emptySummary;
  }
}

/**
 * Loads evaluations for a single lead (lead detail panel).
 */
export async function listChatProRoiEvaluationsForLead(leadId: number, limit = 5) {
  try {
    const rows = await listRecentChatProRoiEvaluations([leadId], limit);
    return rows.map(mapEvaluationRow);
  } catch {
    return [];
  }
}
