import { ChatProRemoteApi } from './api-client.js';
import { loadLocalConfig } from './config.js';
import { consumeReadyLeadGroups } from './consumer.js';
import { logWorkerError } from './diagnostics.js';
import { pollRemoteOutbox } from './poll.js';
import { LocalQueue, WorkerAlreadyRunningError } from './queue.js';

const config = loadLocalConfig();
const api = new ChatProRemoteApi(config.apiBaseUrl, config.internalApiSecret);
const queue = new LocalQueue(config.sqlitePath);

if (config.localWhisperMode !== 'off') {
  console.info('[chatpro-local] local audio transcription enabled', {
    mode: config.localWhisperMode,
    model: config.localWhisperMode === 'transformers' ? config.localWhisperModel : config.whisperModelPath,
  });
}

try {
  queue.acquireInstanceLock();
} catch (error) {
  const context = error instanceof WorkerAlreadyRunningError
    ? { pidExistente: error.existingPid, iniciadoEm: error.existingStartedAt }
    : {};
  logWorkerError('inicialização', error, context);
  queue.close();
  process.exit(1);
}

let polling = false;
let consuming = false;
let renewingDashboardNetwork = false;
let consumeBlockedReason: string | null = null;

function retryContext(intervalMs: number) {
  return {
    novaTentativaEm: `${Math.max(1, Math.round(intervalMs / 60_000))} min`,
    proximaTentativa: new Date(Date.now() + intervalMs).toISOString(),
  };
}

async function renewDashboardNetwork() {
  if (renewingDashboardNetwork) {
    return;
  }
  renewingDashboardNetwork = true;
  try {
    const consumerId = queue.getOrCreateConsumerId();
    const result = await api.renewDashboardNetwork({
      deviceId: consumerId,
      label: `chatpro-local ${consumerId}`,
      ttlHours: 36,
    });
    console.log('[chatpro-local] rede do painel renovada', {
      ok: result.ok,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    logWorkerError('heartbeat da rede do painel', error, retryContext(config.dashboardNetworkHeartbeatMs));
  } finally {
    renewingDashboardNetwork = false;
  }
}

async function runPollCycle() {
  if (polling) {
    return;
  }
  polling = true;
  try {
    const result = await pollRemoteOutbox(api, queue, config.debounceMs);
    if (result.fetched > 0) {
      console.log('[chatpro-local] poll', result);
    }
  } catch (error) {
    logWorkerError('poll da outbox', error, retryContext(config.pollIntervalMs));
  } finally {
    polling = false;
  }
}

async function runConsumeCycle() {
  if (consuming || consumeBlockedReason) {
    return;
  }
  consuming = true;
  try {
    const result = await consumeReadyLeadGroups(queue, config, api);
    if (result.blocked) {
      consumeBlockedReason = result.blocked;
      logWorkerError('consumo pausado até reiniciar', new Error(consumeBlockedReason));
    }
    if (result.processed > 0) {
      console.log('[chatpro-local] consume', result);
    }
  } catch (error) {
    logWorkerError('consumo da fila', error, retryContext(config.consumeIntervalMs));
  } finally {
    consuming = false;
  }
}

console.log('[chatpro-local] started', {
  apiBaseUrl: config.apiBaseUrl,
  sqlitePath: config.sqlitePath,
  consumerId: queue.getOrCreateConsumerId(),
  pollIntervalMs: config.pollIntervalMs,
  consumeIntervalMs: config.consumeIntervalMs,
  dashboardNetworkHeartbeatMs: config.dashboardNetworkHeartbeatMs,
  debounceMs: config.debounceMs,
  anthropicModel: config.anthropicModel,
  anthropicConfigured: Boolean(config.anthropicApiKey),
  singleInstanceLock: true,
});

function shutdown(signal: string) {
  console.log('[chatpro-local] stopping', { signal });
  queue.close();
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

await renewDashboardNetwork();
await runPollCycle();
await runConsumeCycle();

setInterval(renewDashboardNetwork, config.dashboardNetworkHeartbeatMs);
setInterval(runPollCycle, config.pollIntervalMs);
setInterval(runConsumeCycle, config.consumeIntervalMs);
