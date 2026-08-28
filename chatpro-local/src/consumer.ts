import type { ChatProRemoteApi } from './api-client.js';
import { analyzeLeadContext } from './analyze.js';
import type { LocalConfig } from './config.js';
import { logWorkerError, logWorkerWarning, RemoteApiError } from './diagnostics.js';
import type { LocalQueue, QueuedJob } from './queue.js';

const RETRY_DELAY_MS = 5 * 60 * 1000;

async function ackJobsOutbox(api: ChatProRemoteApi, jobs: QueuedJob[]) {
  const outboxIds = jobs.map((job) => job.outboxId);
  if (outboxIds.length === 0) {
    return;
  }
  const result = await api.ackEvents(outboxIds);
  if (result.acked !== new Set(outboxIds).size) {
    throw new Error(`ack_events_incomplete:${result.acked}/${new Set(outboxIds).size}`);
  }
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
      queue.reconcileLeadDebounce(group.group_key);
      continue;
    }

    if (!group.lead_id) {
      logWorkerWarning('lead ignorado', 'Evento sem lead_id; mensagens serão confirmadas sem análise.', {
        phoneKey: group.phone_key,
      });
      await ackJobsOutbox(api, jobs);
      queue.markJobsDone(jobs.map((job) => job.id));
      queue.reconcileLeadDebounce(group.group_key);
      acked += jobs.length;
      skipped += 1;
      continue;
    }

    if (!config.anthropicApiKey) {
      logWorkerError('consumo pausado até reiniciar', new Error('anthropic_not_configured'));
      return { processed, skipped, failed, acked, blocked: 'anthropic_not_configured' };
    }

    try {
      const context = await api.fetchLeadContext(group.lead_id);
      if (context.messageCount === 0) {
        logWorkerWarning('lead ignorado', 'O lead não possui mensagens persistidas para análise.', {
          leadId: group.lead_id,
        });
        await ackJobsOutbox(api, jobs);
        queue.markJobsDone(jobs.map((job) => job.id));
        queue.reconcileLeadDebounce(group.group_key);
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

      if (!submitResult.ok) {
        throw new Error('submit_evaluation_rejected');
      }

      console.log('[chatpro-local] evaluation saved', {
        leadId: group.lead_id,
        evaluationId: submitResult.evaluationId,
        duplicate: Boolean(submitResult.duplicate),
        analysisMode,
        analyzedMessageCount,
        totalMessages: context.messageCount,
        stage: evaluation.stage,
        dealLikelihood: evaluation.dealLikelihood,
        contractDetected: evaluation.contractDetected,
      });

      await ackJobsOutbox(api, jobs);
      queue.markJobsDone(jobs.map((job) => job.id));
      queue.reconcileLeadDebounce(group.group_key);
      acked += jobs.length;
      processed += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (reason === 'anthropic_auth_invalid') {
        logWorkerError('consumo pausado até reiniciar', error, { leadId: group.lead_id });
        return { processed, skipped, failed, acked, blocked: reason };
      }
      if (
        error instanceof RemoteApiError
        && error.details.operation === 'fetch_lead_context'
        && error.details.status === 403
      ) {
        logWorkerWarning('lead ignorado', 'O servidor informou que o lead não é elegível para ROI.', {
          leadId: group.lead_id,
          http: 403,
        });
        await ackJobsOutbox(api, jobs);
        queue.markJobsDone(jobs.map((job) => job.id));
        queue.reconcileLeadDebounce(group.group_key);
        acked += jobs.length;
        skipped += 1;
        continue;
      }
      failed += 1;
      logWorkerError('análise do lead', error, {
        leadId: group.lead_id,
        tentativasAnteriores: Math.max(...jobs.map(job => job.attempts), 0),
        novaTentativaEm: `${RETRY_DELAY_MS / 60_000} min`,
      });
      for (const job of jobs) {
        queue.incrementJobAttempts(job.id);
      }
      queue.rescheduleLeadDebounce(group.group_key, RETRY_DELAY_MS);
    }
  }

  return { processed, skipped, failed, acked, blocked: null };
}
