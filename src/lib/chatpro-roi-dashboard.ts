import 'server-only';

import { count, desc, sql } from 'drizzle-orm';
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
import { sanitizeChatProRoiEvaluationProse, sanitizeChatProRoiProse } from '@/lib/chatpro-roi-prose';
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
  page: number;
  pageSize: number;
  totalLeadGroups: number;
  totalPages: number;
  schemaIncomplete: boolean;
};

const emptySummary: ChatProRoiDashboardSummary = {
  pendingOutboxEvents: 0,
  pendingEvaluations: 0,
  totalMessages: 0,
  totalEvaluations: 0,
  closedWonSignals: 0,
  leadGroups: [],
  page: 1,
  pageSize: 30,
  totalLeadGroups: 0,
  totalPages: 1,
  schemaIncomplete: true,
};

function parseEvaluationResult(raw: unknown): ChatProRoiEvaluation | null {
  const parsed = ChatProRoiEvaluationSchema.safeParse(raw);
  return parsed.success ? sanitizeChatProRoiEvaluationProse(parsed.data) : null;
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
    divertedToPhone: result?.divertedToPhone ?? null,
    contractDetected: result?.contractDetected ?? false,
    estimatedMonthlyValueBrl: result?.estimatedMonthlyValueBrl ?? null,
    summary: sanitizeChatProRoiProse(result?.summary ?? ''),
  };
}

/**
 * Loads ChatPro ROI metrics and recent evaluations for the dashboard page.
 */
export async function getChatProRoiDashboardSummary(options?: {
  limit?: number;
  page?: number;
}): Promise<ChatProRoiDashboardSummary> {
  const leadLimit = Math.min(Math.max(options?.limit ?? 30, 1), 100);
  const page = Math.max(options?.page ?? 1, 1);

  try {
    const [
      pendingOutboxEvents,
      pendingEvaluations,
      leadPageRows,
      leadTotalRows,
      messageCountRows,
      evaluationCountRows,
    ] = await Promise.all([
      countPendingChatProOutboxEvents(),
      countPendingChatProRoiEvaluations(),
      db
        .select({
          leadId: chatproLeadEvaluationsSchema.leadId,
          latestEvaluatedAt: sql<Date>`max(${chatproLeadEvaluationsSchema.evaluatedAt})`,
        })
        .from(chatproLeadEvaluationsSchema)
        .groupBy(chatproLeadEvaluationsSchema.leadId)
        .orderBy(
          desc(sql`max(${chatproLeadEvaluationsSchema.evaluatedAt})`),
          desc(chatproLeadEvaluationsSchema.leadId),
        )
        .limit(leadLimit)
        .offset((page - 1) * leadLimit),
      db
        .select({ value: sql<number>`count(distinct ${chatproLeadEvaluationsSchema.leadId})` })
        .from(chatproLeadEvaluationsSchema),
      db.select({ value: count() }).from(chatproMessagesSchema),
      db.select({ value: count() }).from(chatproLeadEvaluationsSchema),
    ]);

    const totalLeadGroups = Number(leadTotalRows[0]?.value ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalLeadGroups / leadLimit));
    const pageLeadIds = leadPageRows.map((row) => row.leadId);
    const evaluationRows = pageLeadIds.length > 0
      ? await listRecentChatProRoiEvaluations(pageLeadIds)
      : [];
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
      page: Math.min(page, totalPages),
      pageSize: leadLimit,
      totalLeadGroups,
      totalPages,
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
