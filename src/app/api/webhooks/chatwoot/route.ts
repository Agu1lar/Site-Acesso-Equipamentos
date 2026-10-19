import { NextResponse } from 'next/server';
import { parseAcessoChatWebhook, verifyAcessoChatSignature } from '@/lib/acesso-chat-webhook';
import { applyChatProReplyToLead } from '@/lib/chatpro-lead-match';
import { persistChatProMessage } from '@/lib/chatpro-messages';
import { isChatProClientReply } from '@/lib/chatpro-webhook';
import { claimWhatsAppAttributionFromMessage } from '@/lib/whatsapp-attribution-token';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';

export const runtime = 'nodejs';

/** Receives signed live events from Acesso Chat, keeping the existing site lead history. */
export async function POST(request: Request) {
  const secret = Env.CHATWOOT_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 });
  }
  const body = await request.text();
  if (
    !verifyAcessoChatSignature({
      body,
      secret,
      timestamp: request.headers.get('x-chatwoot-timestamp'),
      signature: request.headers.get('x-chatwoot-signature'),
    })
  ) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const event = parseAcessoChatWebhook(payload);
  if (!event) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  try {
    const bridgeLeadId =
      isChatProClientReply(event) && event.phoneKey
        ? await claimWhatsAppAttributionFromMessage(event.phoneKey, event.messagePreview)
        : null;
    const message = await persistChatProMessage(event, payload);
    const match = await applyChatProReplyToLead(event);
    return NextResponse.json({ bridgeLeadId, message, ...match });
  } catch (error) {
    logger.error('Acesso Chat webhook: processamento falhou', {
      message: error instanceof Error ? error.message : String(error),
      externalId: event.externalId,
    });
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'acesso-chat-webhook',
    configured: Boolean(Env.CHATWOOT_WEBHOOK_SECRET),
  });
}
