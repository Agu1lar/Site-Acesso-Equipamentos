import { and, eq, gt, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAcessoChatSignature } from '@/lib/acesso-chat-webhook';
import { buildChatTrafficAttribution } from '@/lib/chat-traffic-attribution';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { whatsappAttributionTokensSchema as tokens } from '@/models/Schema';

export const runtime = 'nodejs';
const QuerySchema = z.object({ account_id: z.literal(3), ref: z.string().regex(/^[A-Z0-9]{8}$/), phone_key: z.string().regex(/^\d{10,13}$/) });

/** Supplies visit evidence to the signed Acesso Chat integration without exposing click IDs. */
export async function POST(request: Request) {
  const secret = Env.CHATWOOT_WEBHOOK_SECRET;
  if (!secret) { return NextResponse.json({ error: 'not_configured' }, { status: 503 }); }
  const body = await request.text();
  if (!verifyAcessoChatSignature({ body, secret, timestamp: request.headers.get('x-chatwoot-timestamp'), signature: request.headers.get('x-chatwoot-signature') })) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  let json: unknown;
  try { json = JSON.parse(body); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }
  const parsed = QuerySchema.safeParse(json);
  if (!parsed.success) { return NextResponse.json({ error: 'invalid_query' }, { status: 422 }); }
  const [row] = await db.select().from(tokens).where(and(eq(tokens.token, parsed.data.ref), or(gt(tokens.expiresAt, new Date()), eq(tokens.phoneKey, parsed.data.phone_key)))).limit(1);
  if (!row || (row.phoneKey && row.phoneKey !== parsed.data.phone_key)) {
    return NextResponse.json({ attribution: null });
  }
  return NextResponse.json({ attribution: { ...buildChatTrafficAttribution(row), ref: row.token } });
}
