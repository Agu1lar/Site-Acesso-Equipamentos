import { NextResponse } from 'next/server';
import {
  ackChatProOutboxEvents,
  claimChatProOutboxEvents,
  listPendingChatProOutboxEvents,
} from '@/lib/chatpro-outbox';
import { authorizeInternalApi } from '@/lib/internal-api-auth';
import { logger } from '@/libs/Logger';
import { ChatProOutboxAckSchema } from '@/validations/chatpro-outbox';

export const runtime = 'nodejs';

/**
 * Pull undelivered ChatPro events for the local ROI consumer.
 * Pass consumerId to claim a lease (preferred). Without it, returns a read-only peek.
 */
export async function GET(request: Request) {
  const auth = authorizeInternalApi(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const sinceRaw = searchParams.get('since');
  const limitRaw = searchParams.get('limit');
  const consumerId = searchParams.get('consumerId')?.trim() ?? '';
  const since = sinceRaw ? Math.max(Number(sinceRaw), 0) : 0;
  const limit = limitRaw ? Number(limitRaw) : 50;

  if (sinceRaw && Number.isNaN(since)) {
    return NextResponse.json({ error: 'invalid_since' }, { status: 400 });
  }
  if (limitRaw && Number.isNaN(limit)) {
    return NextResponse.json({ error: 'invalid_limit' }, { status: 400 });
  }

  try {
    const events = consumerId
      ? await claimChatProOutboxEvents({ consumerId, since, limit })
      : await listPendingChatProOutboxEvents(since, limit);
    const nextSince = events.at(-1)?.outboxId ?? since;

    return NextResponse.json({
      since,
      nextSince,
      count: events.length,
      claimed: Boolean(consumerId),
      events,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('ChatPro ROI events fetch failed', { message });
    return NextResponse.json({ error: 'fetch_events_failed', message }, { status: 500 });
  }
}

/** Acknowledges outbox rows after the local consumer finished Claude analysis. */
export async function POST(request: Request) {
  const auth = authorizeInternalApi(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = ChatProOutboxAckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const result = await ackChatProOutboxEvents(parsed.data.outboxIds);
  return NextResponse.json(result);
}
