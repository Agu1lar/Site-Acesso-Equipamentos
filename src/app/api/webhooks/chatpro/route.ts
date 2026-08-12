import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { applyChatProReplyToLead } from '@/lib/chatpro-lead-match';
import { persistChatProMessage } from '@/lib/chatpro-messages';
import { parseChatProWebhookPayload } from '@/lib/chatpro-webhook';
import { claimWhatsAppAttributionFromMessage } from '@/lib/whatsapp-attribution-token';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';

export const runtime = 'nodejs';

function readConfiguredSecret() {
  return Env.CHATPRO_WEBHOOK_SECRET?.trim() || null;
}

function extractProvidedSecret(request: Request) {
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('token')?.trim();
  if (queryToken) {
    return queryToken;
  }

  const headerSecret =
    request.headers.get('x-chatpro-secret')?.trim()
    || request.headers.get('x-webhook-secret')?.trim();
  if (headerSecret) {
    return headerSecret;
  }

  const auth = request.headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }

  return null;
}

function secretsMatch(expected: string, provided: string) {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * ChatPro → site webhook.
 * Configure in ChatPro: https://acessoequipamentos.com.br/api/webhooks/chatpro?token=SEU_SECRETO
 */
export async function POST(request: Request) {
  const expected = readConfiguredSecret();
  if (!expected) {
    logger.warn('ChatPro webhook recebido sem CHATPRO_WEBHOOK_SECRET configurado');
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 });
  }

  const provided = extractProvidedSecret(request);
  if (!provided || !secretsMatch(expected, provided)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const event = parseChatProWebhookPayload(payload);
  if (!event) {
    return NextResponse.json({ ok: true, ignored: true, reason: 'unrecognized_payload' });
  }

  try {
    let bridgeLeadId: number | null = null;
    if (event.phoneKey && !event.fromMe) {
      bridgeLeadId = await claimWhatsAppAttributionFromMessage(
        event.phoneKey,
        event.messagePreview,
      );
    }

    const persistResult = await persistChatProMessage(event, payload);
    const matchResult = await applyChatProReplyToLead(event);
    return NextResponse.json({
      event: event.event,
      bridgeLeadId,
      message: persistResult,
      ...matchResult,
    });
  } catch (error) {
    logger.error('ChatPro webhook falhou ao atualizar lead', {
      message: error instanceof Error ? error.message : String(error),
      event: event.event,
      phoneKey: event.phoneKey,
    });
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
  }
}

/** ChatPro sometimes probes with GET — confirm the route exists. */
export async function GET() {
  const configured = Boolean(readConfiguredSecret());
  return NextResponse.json({
    ok: true,
    service: 'chatpro-webhook',
    configured,
  });
}
