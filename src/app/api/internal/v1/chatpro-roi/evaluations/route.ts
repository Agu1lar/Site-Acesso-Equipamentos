import { NextResponse } from 'next/server';
import { loadCampaignLeadSnapshot } from '@/lib/chatpro-lead-find';
import { isLeadEligibleForClaudeAnalysis } from '@/lib/chatpro-roi-context';
import { authorizeInternalApi } from '@/lib/internal-api-auth';
import { db } from '@/libs/DB';
import { chatproLeadEvaluationsSchema } from '@/models/Schema';
import { ChatProRoiEvaluationSubmitSchema } from '@/validations/chatpro-outbox';

export const runtime = 'nodejs';

/** Stores a Claude ROI evaluation (campaign leads only). */
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

  const parsed = ChatProRoiEvaluationSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const snapshot = await loadCampaignLeadSnapshot(parsed.data.leadId);
  if (!snapshot) {
    return NextResponse.json({ error: 'lead_not_found' }, { status: 404 });
  }
  if (!isLeadEligibleForClaudeAnalysis(snapshot)) {
    return NextResponse.json({ error: 'not_campaign_lead' }, { status: 403 });
  }

  const inserted = await db
    .insert(chatproLeadEvaluationsSchema)
    .values({
      leadId: parsed.data.leadId,
      messageCount: parsed.data.messageCount,
      lastMessageId: parsed.data.lastMessageId,
      model: parsed.data.model,
      trigger: parsed.data.trigger,
      result: parsed.data.result,
    })
    .returning({ id: chatproLeadEvaluationsSchema.id });

  return NextResponse.json({ ok: true, evaluationId: inserted[0]?.id });
}
