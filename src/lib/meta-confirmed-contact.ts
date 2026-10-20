import 'server-only';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import * as z from 'zod';
import { buildMetaConfirmedContactPayload } from '@/lib/meta-confirmed-contact-payload';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { whatsappAttributionTokensSchema as tokens } from '@/models/Schema';

const responseSchema = z.object({ events_received: z.number().optional() });

/** Sends only confirmed, consented site leads; retries retain the same Meta event id. */
export async function uploadMetaConfirmedContact(input: { leadId: number; phone: string; repliedAt: Date }) {
  if (!Env.META_CONVERSIONS_ACCESS_TOKEN || !Env.NEXT_PUBLIC_META_PIXEL_ID) { return { uploaded: false, reason: 'not_configured' }; }
  const rows = await db.select().from(tokens)
    .where(and(eq(tokens.leadId, input.leadId), isNotNull(tokens.metaContext)))
    .orderBy(desc(tokens.claimedAt));
  if (rows.some(row => row.metaContactSentAt)) { return { uploaded: false, reason: 'duplicate' }; }
  const row = rows.find(token => token.metaContext?.consent === true && token.claimedAt && token.createdAt <= input.repliedAt);
  if (!row?.metaContext) { return { uploaded: false, reason: 'no_consented_site_reference' }; }
  const event = buildMetaConfirmedContactPayload({ ...input, context: row.metaContext });
  if (!event) { return { uploaded: false, reason: 'invalid_or_expired_event' }; }
  const response = await fetch(`https://graph.facebook.com/${Env.META_GRAPH_API_VERSION}/${Env.NEXT_PUBLIC_META_PIXEL_ID}/events`, {
    method: 'POST',
    headers: { authorization: `Bearer ${Env.META_CONVERSIONS_ACCESS_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ data: [event] }),
    signal: AbortSignal.timeout(10_000),
  });
  const result = responseSchema.safeParse(await response.json());
  if (!response.ok || !result.success || result.data.events_received !== 1) {
    // Do not log request headers, customer identifiers or Meta's echoed payload.
    throw new Error(`meta_confirmed_contact_upload_failed_http_${response.status}`);
  }
  await db.update(tokens).set({ metaContactSentAt: new Date() }).where(eq(tokens.leadId, input.leadId));
  return { uploaded: true };
}
