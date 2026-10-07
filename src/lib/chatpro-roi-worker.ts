import 'server-only';

import { and, asc, desc, eq, inArray, isNotNull, ne, or, sql } from 'drizzle-orm';
import { evaluateChatProLeadWithClaude } from '@/lib/chatpro-roi-ai';
import { loadCampaignLeadSnapshot } from '@/lib/chatpro-lead-find';
import { saveChatProRoiEvaluation } from '@/lib/chatpro-roi-evaluation-save';
import {
  leadHasCampaignAttribution,
  shouldEvaluateLeadForRoi,
} from '@/lib/chatpro-roi-eligibility';
import { applyChatProRoiLeadContactEnrichment } from '@/lib/chatpro-roi-lead-enrichment-apply';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import {
  chatproLeadEvaluationsSchema,
  chatproMessagesSchema,
  leadsSchema,
} from '@/models/Schema';
import {
  ChatProRoiEvaluationSchema,
  type ChatProRoiEvaluation,
} from '@/validations/chatpro-roi';

export type ChatProRoiWorkerRunResult = {
  scanned: number;
  evaluated: number;
  skipped: number;
  errors: number;
  items: Array<{
    leadId: number;
    status: 'evaluated' | 'skipped' | 'error';
    reason?: string;
    evaluation?: ChatProRoiEvaluation;
  }>;
};

type WorkerOptions = {
  leadId?: number;
  dryRun?: boolean;
  limit?: number;
  /** Allow re-analysis of a single lead even without new messages (manual only). */
  force?: boolean;
};

async function loadLastEvaluation(leadId: number) {
  const rows = await db
    .select({
      id: chatproLeadEvaluationsSchema.id,
      evaluatedAt: chatproLeadEvaluationsSchema.evaluatedAt,
      lastMessageId: chatproLeadEvaluationsSchema.lastMessageId,
      messageCount: chatproLeadEvaluationsSchema.messageCount,
      result: chatproLeadEvaluationsSchema.result,
    })
    .from(chatproLeadEvaluationsSchema)
    .where(eq(chatproLeadEvaluationsSchema.leadId, leadId))
    .orderBy(desc(chatproLeadEvaluationsSchema.evaluatedAt))
    .limit(1);

  return rows[0] ?? null;
}

async function loadLeadMessages(leadId: number) {
  return db
    .select({
      id: chatproMessagesSchema.id,
      fromMe: chatproMessagesSchema.fromMe,
      messageText: chatproMessagesSchema.messageText,
      mediaType: chatproMessagesSchema.mediaType,
      mediaFilename: chatproMessagesSchema.mediaFilename,
      mediaMimetype: chatproMessagesSchema.mediaMimetype,
      mediaUrl: chatproMessagesSchema.mediaUrl,
      eventAt: chatproMessagesSchema.eventAt,
    })
    .from(chatproMessagesSchema)
    .where(eq(chatproMessagesSchema.leadId, leadId))
    .orderBy(asc(chatproMessagesSchema.eventAt), asc(chatproMessagesSchema.id));
}

async function findCandidateLeadIds(options: WorkerOptions) {
  if (options.leadId) {
    return [options.leadId];
  }

  const sortAt = sql`coalesce(${leadsSchema.lastActivityAt}, ${leadsSchema.createdAt})`;

  const rows = await db
    .select({
      id: leadsSchema.id,
      sortAt: sortAt.as('sort_at'),
    })
    .from(leadsSchema)
    .leftJoin(chatproMessagesSchema, eq(chatproMessagesSchema.leadId, leadsSchema.id))
    .where(
      and(
        ne(leadsSchema.leadKind, 'cookie_consent'),
        or(
          isNotNull(leadsSchema.gclid),
          isNotNull(leadsSchema.gbraid),
          isNotNull(leadsSchema.wbraid),
          sql`lower(coalesce(${leadsSchema.utmMedium}, '')) in ('cpc', 'ppc', 'paid')`,
        ),
        or(isNotNull(leadsSchema.whatsappRepliedAt), isNotNull(chatproMessagesSchema.id)),
      ),
    )
    .groupBy(leadsSchema.id, sortAt)
    .orderBy(desc(sortAt))
    .limit(options.limit ?? 50);

  return rows.map((row) => row.id);
}

/**
 * Daily local worker: evaluates campaign leads with new ChatPro messages via Claude.
 * @param options Optional single-lead run, dry-run, or batch limit.
 */
export async function runChatProRoiWorker(options: WorkerOptions = {}): Promise<ChatProRoiWorkerRunResult> {
  const result: ChatProRoiWorkerRunResult = {
    scanned: 0,
    evaluated: 0,
    skipped: 0,
    errors: 0,
    items: [],
  };

  const candidateIds = await findCandidateLeadIds(options);

  for (const leadId of candidateIds) {
    result.scanned += 1;

    try {
      const lead = await loadCampaignLeadSnapshot(leadId);
      if (!lead) {
        result.skipped += 1;
        result.items.push({ leadId, status: 'skipped', reason: 'lead_not_found' });
        continue;
      }

      const messages = await loadLeadMessages(leadId);
      const lastEval = await loadLastEvaluation(leadId);
      const lastMessageId = messages.at(-1)?.id ?? null;
      const hasNewMessages =
        !lastEval
        || messages.length > lastEval.messageCount
        || (lastMessageId !== null && lastMessageId !== lastEval.lastMessageId);
      const force = Boolean(options.force && options.leadId);

      if (!leadHasCampaignAttribution(lead)) {
        result.skipped += 1;
        result.items.push({ leadId, status: 'skipped', reason: 'no_campaign_attribution' });
        continue;
      }

      const lastEvalStage = lastEval
        ? (() => {
            const parsed = ChatProRoiEvaluationSchema.safeParse(lastEval.result);
            return parsed.success ? parsed.data.stage : null;
          })()
        : null;

      if (
        !shouldEvaluateLeadForRoi(
          lead,
          messages.length,
          hasNewMessages || force,
          {},
          lastEvalStage,
        )
      ) {
        result.skipped += 1;
        result.items.push({ leadId, status: 'skipped', reason: 'not_eligible' });
        continue;
      }

      if (!hasNewMessages && !force) {
        result.skipped += 1;
        result.items.push({ leadId, status: 'skipped', reason: 'no_new_messages' });
        continue;
      }

      if (messages.length === 0) {
        result.skipped += 1;
        result.items.push({ leadId, status: 'skipped', reason: 'no_messages' });
        continue;
      }

      if (options.dryRun) {
        result.skipped += 1;
        result.items.push({ leadId, status: 'skipped', reason: 'dry_run' });
        continue;
      }

      const evaluation = await evaluateChatProLeadWithClaude(
        lead,
        messages,
        lastEval
          ? (() => {
              const parsed = ChatProRoiEvaluationSchema.safeParse(lastEval.result);
              if (!parsed.success) {
                return null;
              }
              return {
                lastMessageId: lastEval.lastMessageId,
                messageCount: lastEval.messageCount,
                evaluatedAt: lastEval.evaluatedAt,
                result: parsed.data,
              };
            })()
          : null,
      );

      const saved = await saveChatProRoiEvaluation({
        leadId,
        messageCount: messages.length,
        lastMessageId,
        model: Env.ANTHROPIC_MODEL,
        trigger: options.leadId ? 'manual' : 'daily_worker',
        result: evaluation,
      });

      if (!saved.duplicate) {
        await applyChatProRoiLeadContactEnrichment(leadId, evaluation);
      }

      result.evaluated += 1;
      result.items.push({ leadId, status: 'evaluated', evaluation });

      logger.info('ChatPro ROI evaluation saved', {
        leadId,
        evaluationId: saved.evaluationId,
        duplicate: saved.duplicate,
        stage: evaluation.stage,
        dealLikelihood: evaluation.dealLikelihood,
      });
    } catch (error) {
      result.errors += 1;
      const reason = error instanceof Error ? error.message : 'unknown_error';
      result.items.push({ leadId, status: 'error', reason });
      logger.error('ChatPro ROI worker failed for lead', { leadId, reason });
    }
  }

  return result;
}

/**
 * Returns recent ROI evaluations for internal reporting APIs.
 * @param leadIds Optional filter by lead ids.
 * @param limit Max rows.
 */
export async function listRecentChatProRoiEvaluations(leadIds?: number[], limit?: number) {
  const baseQuery = db
    .select({
      id: chatproLeadEvaluationsSchema.id,
      leadId: chatproLeadEvaluationsSchema.leadId,
      evaluatedAt: chatproLeadEvaluationsSchema.evaluatedAt,
      messageCount: chatproLeadEvaluationsSchema.messageCount,
      model: chatproLeadEvaluationsSchema.model,
      trigger: chatproLeadEvaluationsSchema.trigger,
      result: chatproLeadEvaluationsSchema.result,
      leadName: leadsSchema.name,
      leadStatus: leadsSchema.status,
      utmCampaign: leadsSchema.utmCampaign,
      gclid: leadsSchema.gclid,
    })
    .from(chatproLeadEvaluationsSchema)
    .innerJoin(leadsSchema, eq(chatproLeadEvaluationsSchema.leadId, leadsSchema.id))
    .$dynamic();

  if (leadIds && leadIds.length > 0) {
    const query = baseQuery
      .where(inArray(chatproLeadEvaluationsSchema.leadId, leadIds))
      .orderBy(desc(chatproLeadEvaluationsSchema.evaluatedAt));

    return limit === undefined ? query : query.limit(limit);
  }

  const query = baseQuery.orderBy(desc(chatproLeadEvaluationsSchema.evaluatedAt));

  return limit === undefined ? query : query.limit(limit);
}

/**
 * Returns only the newest ROI evaluation for each requested lead.
 * @param leadIds Lead ids included in the result.
 * @returns Latest evaluation rows joined with their leads.
 */
export async function listLatestChatProRoiEvaluations(leadIds: number[]) {
  if (leadIds.length === 0) {
    return [];
  }

  return db
    .selectDistinctOn([chatproLeadEvaluationsSchema.leadId], {
      id: chatproLeadEvaluationsSchema.id,
      leadId: chatproLeadEvaluationsSchema.leadId,
      evaluatedAt: chatproLeadEvaluationsSchema.evaluatedAt,
      messageCount: chatproLeadEvaluationsSchema.messageCount,
      model: chatproLeadEvaluationsSchema.model,
      trigger: chatproLeadEvaluationsSchema.trigger,
      result: chatproLeadEvaluationsSchema.result,
      leadName: leadsSchema.name,
      leadStatus: leadsSchema.status,
      utmCampaign: leadsSchema.utmCampaign,
      gclid: leadsSchema.gclid,
    })
    .from(chatproLeadEvaluationsSchema)
    .innerJoin(leadsSchema, eq(chatproLeadEvaluationsSchema.leadId, leadsSchema.id))
    .where(inArray(chatproLeadEvaluationsSchema.leadId, leadIds))
    .orderBy(
      chatproLeadEvaluationsSchema.leadId,
      desc(chatproLeadEvaluationsSchema.evaluatedAt),
      desc(chatproLeadEvaluationsSchema.id),
    );
}

/**
 * Leads with campaign attribution that have new ChatPro messages since last evaluation.
 * @returns Number of leads waiting for a new evaluation.
 */
export async function countPendingChatProRoiEvaluations() {
  const result = await db.execute(sql`
    WITH message_state AS (
      SELECT
        lead_id,
        count(*)::integer AS message_count,
        max(id)::integer AS last_message_id
      FROM chatpro_messages
      WHERE lead_id IS NOT NULL
      GROUP BY lead_id
    ),
    latest_evaluation AS (
      SELECT DISTINCT ON (lead_id)
        lead_id,
        last_message_id,
        result->>'stage' AS stage
      FROM chatpro_lead_evaluations
      ORDER BY lead_id, evaluated_at DESC, id DESC
    )
    SELECT count(*)::integer AS value
    FROM leads AS lead
    INNER JOIN message_state AS messages ON messages.lead_id = lead.id
    LEFT JOIN latest_evaluation AS evaluation ON evaluation.lead_id = lead.id
    WHERE lead.lead_kind <> 'cookie_consent'
      AND (
        lead.gclid IS NOT NULL
        OR lead.gbraid IS NOT NULL
        OR lead.wbraid IS NOT NULL
        OR lower(coalesce(lead.utm_medium, '')) IN ('cpc', 'ppc', 'paid')
      )
      AND coalesce(evaluation.stage, '') NOT IN ('closed_won', 'closed_lost')
      AND (
        evaluation.lead_id IS NULL
        OR messages.last_message_id IS DISTINCT FROM evaluation.last_message_id
      )
  `);

  const [row] = result.rows;
  if (!row || typeof row !== 'object' || !('value' in row)) {
    return 0;
  }
  return Number(row.value);
}
