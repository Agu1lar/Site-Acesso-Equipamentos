import { NextResponse } from 'next/server';
import * as z from 'zod';
import { renewDashboardTrustedNetwork } from '@/lib/dashboard-trusted-networks';
import { authorizeInternalApi } from '@/lib/internal-api-auth';

export const runtime = 'nodejs';

const DashboardNetworkHeartbeatSchema = z.object({
  deviceId: z.string().min(3).max(120),
  label: z.string().min(1).max(160),
  ttlHours: z.number().int().min(1).max(168).optional(),
});

/** Renews the dashboard network allowlist from a trusted local device. */
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

  const parsed = DashboardNetworkHeartbeatSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const renewed = await renewDashboardTrustedNetwork({
      deviceId: parsed.data.deviceId,
      label: parsed.data.label,
      ttlHours: parsed.data.ttlHours,
      headers: request.headers,
    });

    return NextResponse.json({
      ok: true,
      ipAddress: renewed.ipAddress,
      expiresAt: renewed.expiresAt.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'heartbeat_failed' },
      { status: 500 },
    );
  }
}
