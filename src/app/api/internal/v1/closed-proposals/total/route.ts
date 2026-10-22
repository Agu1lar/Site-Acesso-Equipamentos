import { NextResponse } from 'next/server';
import { trafficClosedTotal } from '@/lib/closed-proposal-store';
import { authorizeInternalApi } from '@/lib/internal-api-auth';

export const runtime = 'nodejs';

/**
 * Returns the paid-traffic total of approved proposals.
 * @param request Bearer-authenticated request.
 * @returns The traffic total, or an auth error.
 */
export async function GET(request: Request) {
  const auth = authorizeInternalApi(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json(await trafficClosedTotal());
}
