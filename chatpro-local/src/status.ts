import { ChatProRemoteApi } from './api-client.js';
import { loadLocalConfig } from './config.js';

type SummaryResponse = {
  pendingOutboxEvents: number;
  pendingEvaluations: number;
  totalMessages: number;
  totalEvaluations: number;
  claimedWhatsAppTokens: number;
  unclaimedWhatsAppTokens: number;
  recentEvaluations: number;
  closedWonSignals: number;
  evaluations: Array<{
    id: number;
    leadId: number;
    leadName: string;
    leadStatus: string;
    utmCampaign: string | null;
    evaluatedAt: string;
    messageCount: number;
    trigger: string;
    stage: string | null;
    dealLikelihood: number | null;
    contractDetected: boolean | null;
  }>;
};

/**
 * Prints a compact ROI pipeline status from production.
 */
async function main() {
  const config = loadLocalConfig();
  const api = new ChatProRemoteApi(config.apiBaseUrl, config.internalApiSecret);

  const events = await api.fetchEvents(0, 20);
  const summaryResponse = await fetch(
    new URL('/api/internal/v1/chatpro-roi/summary?limit=10', config.apiBaseUrl),
    {
      headers: {
        authorization: `Bearer ${config.internalApiSecret}`,
      },
      signal: AbortSignal.timeout(60_000),
    },
  );

  if (!summaryResponse.ok) {
    const body = await summaryResponse.text();
    throw new Error(`summary_failed:${summaryResponse.status} ${body}`);
  }

  const summary = (await summaryResponse.json()) as SummaryResponse;

  console.log('[chatpro-local] status');
  console.log(`  api: ${config.apiBaseUrl}`);
  console.log(`  pendingOutbox: ${summary.pendingOutboxEvents} (poll sample: ${events.count})`);
  console.log(`  pendingEvaluations: ${summary.pendingEvaluations}`);
  console.log(`  totalMessages: ${summary.totalMessages}`);
  console.log(`  totalEvaluations: ${summary.totalEvaluations}`);
  console.log(`  whatsappTokens claimed/unclaimed: ${summary.claimedWhatsAppTokens}/${summary.unclaimedWhatsAppTokens}`);
  console.log(`  closedWonSignals (recent page): ${summary.closedWonSignals}`);

  if (summary.evaluations.length === 0) {
    console.log('  recentEvaluations: (none yet)');
    return;
  }

  console.log('  recentEvaluations:');
  for (const row of summary.evaluations) {
    console.log(
      `    #${row.id} lead=${row.leadId} ${row.leadName} stage=${row.stage ?? '—'} deal=${row.dealLikelihood ?? '—'} msgs=${row.messageCount} ${row.utmCampaign ?? ''}`,
    );
  }
}

main().catch((error) => {
  console.error('[chatpro-local] status failed', error instanceof Error ? error.message : error);
  process.exit(1);
});
