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
  if (consuming) {
    return;
  }
  consuming = true;
  try {
    const result = await consumeReadyLeadGroups(queue, config, api);
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
  debounceMs: config.debounceMs,
  anthropicModel: config.anthropicModel,
  anthropicConfigured: Boolean(config.anthropicApiKey),
});

await runPollCycle();
await runConsumeCycle();

setInterval(runPollCycle, config.pollIntervalMs);
setInterval(runConsumeCycle, Math.min(config.pollIntervalMs, 30_000));
