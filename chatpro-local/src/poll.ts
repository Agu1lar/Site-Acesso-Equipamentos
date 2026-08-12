import type { ChatProRemoteApi } from './api-client.js';
import type { LocalQueue } from './queue.js';

/** Pulls remote outbox events and enqueues them locally with idempotency. */
export async function pollRemoteOutbox(
  api: ChatProRemoteApi,
  queue: LocalQueue,
  debounceMs: number,
) {
  let since = 0;
  let total = 0;

  for (;;) {
    const page = await api.fetchEvents(since, 50);
    if (page.events.length === 0) {
      break;
    }

    for (const event of page.events) {
      queue.enqueueRemoteEvent(event, debounceMs);
      total += 1;
    }

    since = page.nextSince;
    if (page.count < 50) {
      break;
    }
  }

  return { fetched: total, cursor: since };
}
