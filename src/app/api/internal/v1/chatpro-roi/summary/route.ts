import { NextResponse } from 'next/server';
import { countPendingChatProOutboxEvents } from '@/lib/chatpro-outbox';
import {
  countPendingChatProRoiEvaluations,
  listRecentChatProRoiEvaluations,
} from '@/lib/chatpro-roi-worker';
import { authorizeInternalApi } from '@/lib/internal-api-auth';

export const runtime = 'nodejs';

/** Read-only summary for the local ChatPro ROI worker (no dashboard UI). */
export async function GET(request: Request) {
  const auth = authorizeInternalApi(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const limitRaw = searchParams.get('limit');
  const limit = limitRaw ? Math.min(Math.max(Number(limitRaw), 1), 200) : 50;

  const [pendingOutbox, pendingEvaluations, evaluations] = await Promise.all([
    countPendingChatProOutboxEvents(),
    countPendingChatProRoiEvaluations(),
    listRecentChatProRoiEvaluations(undefined, limit),
  ]);

  const closedWon = evaluations.filter(
    (row) => (row.result as { stage?: string }).stage === 'closed_won',
  ).length;

  return NextResponse.json({
    pendingOutboxEvents: pendingOutbox,
    pendingEvaluations,
    recentEvaluations: evaluations.length,
    closedWonSignals: closedWon,
    evaluations,
  });
}
