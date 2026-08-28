import { analyzeLeadContext } from './analyze.js';
import { ChatProRemoteApi } from './api-client.js';
import { loadLocalConfig } from './config.js';
import { logWorkerError } from './diagnostics.js';

async function main() {
  const leadId = Number(process.argv[2] ?? 91);
  const config = loadLocalConfig();
  const api = new ChatProRemoteApi(config.apiBaseUrl, config.internalApiSecret);
  const context = await api.fetchLeadContext(leadId);
  const result = await analyzeLeadContext(context, config);

  console.info('[chatpro-local] Claude analysis with local audio', {
    leadId,
    analysisMode: result.analysisMode,
    analyzedMessageCount: result.analyzedMessageCount,
    stage: result.evaluation.stage,
    dealLikelihood: result.evaluation.dealLikelihood,
    summary: result.evaluation.summary,
  });
}

try {
  await main();
} catch (error) {
  logWorkerError('análise com áudio local', error);
  process.exit(1);
}
