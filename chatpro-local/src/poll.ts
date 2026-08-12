import type { ChatProRemoteApi } from './api-client.js';
import type { LocalQueue } from './queue.js';

/** Pulls remote outbox events and enqueues them locally with idempotency. */
export async function pollRemoteOutbox(
  api: ChatProRemoteApi,
  queue: LocalQueue,
  debounceMs: number,
) {
  let since = queue.getPollSince();
  let total = 0;
  const ackIds: number[] = [];

  for (;;) {
    const page = await api.fetchEvents(since, 50);
    if (page.events.length === 0) {
      break;
    }

    for (const event of page.events) {
      queue.enqueueRemoteEvent(event, debounceMs);
      ackIds.push(event.outboxId);
      total += 1;
    }

    since = page.nextSince;
    queue.setPollSince(since);

    if (page.count < 50) {
      break;
    }
  }

  if (ackIds.length > 0) {
    await api.ackEvents(ackIds);
  }

  return { fetched: total, acked: ackIds.length, cursor: since };
}
