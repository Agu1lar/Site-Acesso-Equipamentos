import { NextResponse } from 'next/server';
import { loadCampaignLeadSnapshot } from '@/lib/chatpro-lead-find';
import { isLeadEligibleForClaudeAnalysis } from '@/lib/chatpro-roi-context';
import { saveChatProRoiEvaluation } from '@/lib/chatpro-roi-evaluation-save';
import { leadHasCampaignAttribution } from '@/lib/chatpro-roi-eligibility';
import { applyChatProRoiLeadContactEnrichment } from '@/lib/chatpro-roi-lead-enrichment-apply';
import { loadLastRoiEvaluationStage } from '@/lib/chatpro-roi-last-evaluation';
import { authorizeInternalApi } from '@/lib/internal-api-auth';
import { ChatProRoiEvaluationSubmitSchema } from '@/validations/chatpro-outbox';
import { ChatProRoiEvaluationSchema } from '@/validations/chatpro-roi';

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
  const lastEvaluationStage = await loadLastRoiEvaluationStage(parsed.data.leadId);
  if (!isLeadEligibleForClaudeAnalysis(snapshot, lastEvaluationStage)) {
    return NextResponse.json(
      { error: leadHasCampaignAttribution(snapshot) ? 'roi_journey_frozen' : 'not_campaign_lead' },
      { status: 403 },
    );
  }

  const evaluationParsed = ChatProRoiEvaluationSchema.safeParse(parsed.data.result);
  if (!evaluationParsed.success) {
    return NextResponse.json({ error: 'invalid_evaluation' }, { status: 400 });
  }

  const saved = await saveChatProRoiEvaluation({
    leadId: parsed.data.leadId,
    messageCount: parsed.data.messageCount,
    lastMessageId: parsed.data.lastMessageId,
    model: parsed.data.model,
    trigger: parsed.data.trigger,
    result: evaluationParsed.data,
  });

  const enrichment = saved.duplicate
    ? { updated: false }
    : await applyChatProRoiLeadContactEnrichment(
        parsed.data.leadId,
        evaluationParsed.data,
      );

  return NextResponse.json({
    ok: true,
    evaluationId: saved.evaluationId,
    duplicate: saved.duplicate,
    contactEnriched: enrichment.updated,
  });
}
