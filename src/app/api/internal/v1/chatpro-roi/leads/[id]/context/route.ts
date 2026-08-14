import { NextResponse } from 'next/server';
import { resolveChatProLeadAnalysisContext } from '@/lib/chatpro-roi-context';
import { authorizeInternalApi } from '@/lib/internal-api-auth';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

/** Returns lead CRM data and ChatPro messages for Claude (campaign leads only). */
export async function GET(request: Request, context: RouteContext) {
  const auth = authorizeInternalApi(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: idRaw } = await context.params;
  const leadId = Number(idRaw);
  if (!Number.isInteger(leadId) || leadId <= 0) {
    return NextResponse.json({ error: 'invalid_lead_id' }, { status: 400 });
  }

  const resolved = await resolveChatProLeadAnalysisContext(leadId);
  if (!resolved.ok) {
    const status = resolved.reason === 'not_campaign_lead' || resolved.reason === 'roi_journey_frozen'
      ? 403
      : 404;
    return NextResponse.json({ error: resolved.reason }, { status });
  }

  const analysisContext = resolved.context;

  return NextResponse.json({
    lead: analysisContext.lead,
    messages: analysisContext.messages.map((message) => ({
      ...message,
      eventAt: message.eventAt?.toISOString() ?? null,
    })),
    messageCount: analysisContext.messages.length,
    lastMessageId: analysisContext.messages.at(-1)?.id ?? null,
    priorEvaluation: analysisContext.priorEvaluation
      ? {
          ...analysisContext.priorEvaluation,
          evaluatedAt:
            analysisContext.priorEvaluation.evaluatedAt instanceof Date
              ? analysisContext.priorEvaluation.evaluatedAt.toISOString()
              : analysisContext.priorEvaluation.evaluatedAt,
        }
      : null,
  });
}
