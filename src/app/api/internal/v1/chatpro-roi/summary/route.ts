import { NextResponse } from 'next/server';
import { count, isNull, sql } from 'drizzle-orm';
import { countPendingChatProOutboxEvents } from '@/lib/chatpro-outbox';
import {
  countPendingChatProRoiEvaluations,
  listRecentChatProRoiEvaluations,
} from '@/lib/chatpro-roi-worker';
import { countLatestClosedWonSignals } from '@/lib/chatpro-roi-summary';
import { authorizeInternalApi } from '@/lib/internal-api-auth';
import { db } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import {
  chatproLeadEvaluationsSchema,
  chatproMessagesSchema,
  whatsappAttributionTokensSchema,
} from '@/models/Schema';

export const runtime = 'nodejs';

/** Read-only summary for the local ChatPro ROI worker (no dashboard UI). */
export async function GET(request: Request) {
  const auth = authorizeInternalApi(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const limitRaw = searchParams.get('limit');
  const limit = limitRaw ? Math.min(Math.max(Number(limitRaw), 1), 50) : 20;

  try {
    const [
      pendingOutbox,
      pendingEvaluations,
      evaluations,
      messageCountRows,
      claimedTokenRows,
      unclaimedTokenRows,
      evaluationCountRows,
    ] = await Promise.all([
      countPendingChatProOutboxEvents(),
      countPendingChatProRoiEvaluations(),
      listRecentChatProRoiEvaluations(undefined, limit),
      db.select({ value: count() }).from(chatproMessagesSchema),
      db
        .select({ value: count() })
        .from(whatsappAttributionTokensSchema)
        .where(sql`${whatsappAttributionTokensSchema.claimedAt} is not null`),
      db
        .select({ value: count() })
        .from(whatsappAttributionTokensSchema)
        .where(isNull(whatsappAttributionTokensSchema.claimedAt)),
      db.select({ value: count() }).from(chatproLeadEvaluationsSchema),
    ]);

    const closedWon = countLatestClosedWonSignals(evaluations);

    return NextResponse.json({
      pendingOutboxEvents: pendingOutbox,
      pendingEvaluations,
      totalMessages: Number(messageCountRows[0]?.value ?? 0),
      totalEvaluations: Number(evaluationCountRows[0]?.value ?? 0),
      claimedWhatsAppTokens: Number(claimedTokenRows[0]?.value ?? 0),
      unclaimedWhatsAppTokens: Number(unclaimedTokenRows[0]?.value ?? 0),
      recentEvaluations: evaluations.length,
      closedWonSignals: closedWon,
      evaluations: evaluations.map((row) => ({
        id: row.id,
        leadId: row.leadId,
        leadName: row.leadName,
        leadStatus: row.leadStatus,
        utmCampaign: row.utmCampaign,
        evaluatedAt: row.evaluatedAt,
        messageCount: row.messageCount,
        trigger: row.trigger,
        stage: (row.result as { stage?: string }).stage ?? null,
        dealLikelihood: (row.result as { dealLikelihood?: number }).dealLikelihood ?? null,
        contractDetected: (row.result as { contractDetected?: boolean }).contractDetected ?? null,
      })),
    });
  } catch (error) {
    logger.error('ChatPro ROI summary failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: 'summary_failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
