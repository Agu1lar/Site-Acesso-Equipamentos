import { ChatProRemoteApi } from './api-client.js';
import { loadLocalConfig } from './config.js';
import { consumeReadyLeadGroups } from './consumer.js';
import { pollRemoteOutbox } from './poll.js';
import { LocalQueue } from './queue.js';

const config = loadLocalConfig();
const api = new ChatProRemoteApi(config.apiBaseUrl, config.internalApiSecret);
const queue = new LocalQueue(config.sqlitePath);

let polling = false;
let consuming = false;
let renewingDashboardNetwork = false;
let consumeBlockedReason: string | null = null;

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
    console.log('[chatpro-local] dashboard network renewed', result);
  } catch (error) {
    console.error('[chatpro-local] dashboard network heartbeat failed', error);
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
    console.error('[chatpro-local] poll failed', error);
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
      console.error('[chatpro-local] consumption disabled until restart', {
        reason: consumeBlockedReason,
      });
    }
    if (result.processed > 0) {
      console.log('[chatpro-local] consume', result);
    }
  } catch (error) {
    console.error('[chatpro-local] consume failed', error);
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
