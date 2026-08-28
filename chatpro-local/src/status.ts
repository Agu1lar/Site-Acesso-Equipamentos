import { ChatProRemoteApi } from './api-client.js';
import { loadLocalConfig } from './config.js';
import { logWorkerError } from './diagnostics.js';

type SummaryResponse = {
  pendingOutboxEvents: number;
  pendingEvaluations: number;
  totalMessages: number;
  totalEvaluations: number;
  claimedWhatsAppTokens: number;
  unclaimedWhatsAppTokens: number;
  recentEvaluations: number;
  closedWonSignals: number;
  evaluations: {
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
  }[];
};

/**
 * Prints a compact ROI pipeline status from production.
 */
async function main() {
  const config = loadLocalConfig();
  const api = new ChatProRemoteApi(config.apiBaseUrl, config.internalApiSecret);

  const events = await api.fetchEvents(0, 20);
  const summary = await api.fetchSummary<SummaryResponse>();

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

try {
  await main();
} catch (error) {
  logWorkerError('consulta de status', error);
  process.exit(1);
}
