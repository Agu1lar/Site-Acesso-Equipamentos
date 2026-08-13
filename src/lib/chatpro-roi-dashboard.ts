import 'server-only';

import { count } from 'drizzle-orm';
import { countPendingChatProOutboxEvents } from '@/lib/chatpro-outbox';
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

export type ChatProRoiDashboardEvaluation = {
  id: number;
  leadId: number;
  leadName: string;
  leadStatus: string;
  utmCampaign: string | null;
  evaluatedAt: Date;
  messageCount: number;
  trigger: string;
  stage: ChatProRoiEvaluation['stage'];
  dealLikelihood: number;
  followUpPriority: ChatProRoiEvaluation['followUpPriority'];
  suggestedStatus: ChatProRoiEvaluation['suggestedStatus'];
  contractDetected: boolean;
  estimatedMonthlyValueBrl: number | null;
  summary: string;
};

export type ChatProRoiDashboardSummary = {
  pendingOutboxEvents: number;
  pendingEvaluations: number;
  totalMessages: number;
  totalEvaluations: number;
  closedWonSignals: number;
  evaluations: ChatProRoiDashboardEvaluation[];
  schemaIncomplete: boolean;
};

const emptySummary: ChatProRoiDashboardSummary = {
  pendingOutboxEvents: 0,
  pendingEvaluations: 0,
  totalMessages: 0,
  totalEvaluations: 0,
  closedWonSignals: 0,
  evaluations: [],
  schemaIncomplete: true,
};

function parseEvaluationResult(raw: unknown): ChatProRoiEvaluation | null {
  const parsed = ChatProRoiEvaluationSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function mapEvaluationRow(row: Awaited<ReturnType<typeof listRecentChatProRoiEvaluations>>[number]) {
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
  const limit = Math.min(Math.max(options?.limit ?? 30, 1), 100);

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
      listRecentChatProRoiEvaluations(undefined, limit),
      db.select({ value: count() }).from(chatproMessagesSchema),
      db.select({ value: count() }).from(chatproLeadEvaluationsSchema),
    ]);

    const evaluations = evaluationRows.map(mapEvaluationRow);
    const closedWonSignals = evaluations.filter((row) => row.stage === 'closed_won').length;

    return {
      pendingOutboxEvents,
      pendingEvaluations,
      totalMessages: Number(messageCountRows[0]?.value ?? 0),
      totalEvaluations: Number(evaluationCountRows[0]?.value ?? 0),
      closedWonSignals,
      evaluations,
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
