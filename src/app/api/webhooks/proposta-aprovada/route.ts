import { NextResponse } from 'next/server';
import * as z from 'zod';
import { verifyAcessoChatSignature } from '@/lib/acesso-chat-webhook';
import { recordClosedProposal } from '@/lib/closed-proposal-store';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';

export const runtime = 'nodejs';

const bodySchema = z.object({
  proposalId: z.uuid(),
  numero: z.string().trim().min(1).max(40),
  approvedAt: z.iso.datetime({ offset: true }),
  valorTotal: z.number().finite().min(0),
  companyName: z.string().max(200),
  phones: z.array(z.string()).max(30),
  contactNames: z.array(z.string()).max(30),
  attendance: z
    .array(
      z.object({
        phoneKey: z.string(),
        name: z.string().max(200),
        phoneMatched: z.boolean(),
      }),
    )
    .max(8),
});

/**
 * Receives a signed approved-proposal event and records its traffic match.
 * @param request Signed webhook request.
 * @returns Match kind, or an error status when the request is rejected.
 */
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

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const recorded = await recordClosedProposal({
      proposalId: parsed.data.proposalId,
      numero: parsed.data.numero,
      approvedAt: new Date(parsed.data.approvedAt),
      valorTotal: parsed.data.valorTotal,
      companyName: parsed.data.companyName,
      phones: parsed.data.phones,
      contactNames: parsed.data.contactNames,
      attendance: parsed.data.attendance,
    });
    logger.info('Closed proposal recorded', {
      proposalId: parsed.data.proposalId,
      match: recorded.match,
    });
    return NextResponse.json({ ok: true, match: recorded.match });
  } catch {
    logger.error('Closed proposal webhook failed', { proposalId: parsed.data.proposalId });
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
  }
}

/**
 * Reports whether the approved-proposal webhook secret is configured.
 * @returns Service name and whether the webhook secret is set.
 */
export function GET() {
  return NextResponse.json({
    service: 'proposta-aprovada',
    configured: Boolean(Env.CHATWOOT_WEBHOOK_SECRET),
  });
}
