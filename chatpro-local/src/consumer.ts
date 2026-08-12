import type { ChatProRemoteApi } from './api-client.js';
import { analyzeLeadContext } from './analyze.js';
import type { LocalConfig } from './config.js';
import type { LocalQueue, QueuedJob } from './queue.js';

const RETRY_DELAY_MS = 5 * 60 * 1000;

async function ackJobsOutbox(api: ChatProRemoteApi, jobs: QueuedJob[]) {
  const outboxIds = jobs.map((job) => job.outboxId);
  if (outboxIds.length === 0) {
    return;
  }
  await api.ackEvents(outboxIds);
}

/**
 * Processes debounced lead groups with Claude and posts evaluations to Neon.
 * @param queue SQLite queue with pending jobs.
 * @param config Local environment including Anthropic credentials.
 * @param api Remote internal API client.
 */
export async function consumeReadyLeadGroups(
  queue: LocalQueue,
  config: LocalConfig,
  api: ChatProRemoteApi,
) {
  const groups = queue.listReadyLeadGroups();
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let acked = 0;

  for (const group of groups) {
    const jobs = queue.listPendingJobsForGroup(group.lead_id, group.phone_key);
    if (jobs.length === 0) {
      queue.clearLeadDebounce(group.group_key);
      continue;
    }

    if (!group.lead_id) {
      console.warn('[chatpro-local] skip — no lead_id for phone', group.phone_key);
      await ackJobsOutbox(api, jobs);
      queue.markJobsDone(jobs.map((job) => job.id));
      queue.clearLeadDebounce(group.group_key);
      acked += jobs.length;
      skipped += 1;
      continue;
    }

    if (!config.anthropicApiKey) {
      console.warn('[chatpro-local] skip — ANTHROPIC_API_KEY not set', { leadId: group.lead_id });
      skipped += 1;
      continue;
    }

    try {
      const context = await api.fetchLeadContext(group.lead_id);
      if (context.messageCount === 0) {
        console.warn('[chatpro-local] skip — no messages in Neon', { leadId: group.lead_id });
        await ackJobsOutbox(api, jobs);
        queue.markJobsDone(jobs.map((job) => job.id));
        queue.clearLeadDebounce(group.group_key);
        acked += jobs.length;
        skipped += 1;
        continue;
      }

      const { evaluation, analysisMode, analyzedMessageCount } = await analyzeLeadContext(
        context,
        config,
      );

      const submitResult = await api.submitEvaluation({
        leadId: group.lead_id,
        messageCount: context.messageCount,
        lastMessageId: context.lastMessageId,
        model: config.anthropicModel,
        trigger: 'local_consumer',
        result: evaluation,
      });

      console.log('[chatpro-local] evaluation saved', {
        leadId: group.lead_id,
        evaluationId: submitResult.evaluationId,
        analysisMode,
        analyzedMessageCount,
        totalMessages: context.messageCount,
        stage: evaluation.stage,
        dealLikelihood: evaluation.dealLikelihood,
        contractDetected: evaluation.contractDetected,
      });

      await ackJobsOutbox(api, jobs);
      queue.markJobsDone(jobs.map((job) => job.id));
      queue.clearLeadDebounce(group.group_key);
      acked += jobs.length;
      processed += 1;
    } catch (error) {
      failed += 1;
      const reason = error instanceof Error ? error.message : String(error);
      if (reason.includes('fetch_lead_context_failed:403')) {
        console.warn('[chatpro-local] skip — not a campaign lead', { leadId: group.lead_id });
        await ackJobsOutbox(api, jobs);
        queue.markJobsDone(jobs.map((job) => job.id));
        queue.clearLeadDebounce(group.group_key);
        acked += jobs.length;
        skipped += 1;
        continue;
      }
      console.error('[chatpro-local] analysis failed', { leadId: group.lead_id, reason });
      for (const job of jobs) {
        queue.incrementJobAttempts(job.id);
      }
      queue.rescheduleLeadDebounce(group.group_key, RETRY_DELAY_MS);
    }
  }

  return { processed, skipped, failed, acked };
}
