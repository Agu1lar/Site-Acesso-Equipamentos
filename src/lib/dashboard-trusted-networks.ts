import 'server-only';

import { and, eq, gt, sql } from 'drizzle-orm';
import {
  isDashboardNetworkAllowed,
  resolveDashboardClientIp,
} from '@/lib/dashboard-network-access';
import { db } from '@/libs/DB';
import { dashboardTrustedNetworksSchema } from '@/models/Schema';

const DEFAULT_TRUSTED_NETWORK_TTL_HOURS = 36;

async function ensureDashboardTrustedNetworksSchema() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "dashboard_trusted_networks" (
      "id" serial PRIMARY KEY NOT NULL,
      "device_id" varchar(120) NOT NULL,
      "label" varchar(160) NOT NULL,
      "ip_address" varchar(80) NOT NULL,
      "last_seen_at" timestamp DEFAULT now() NOT NULL,
      "expires_at" timestamp NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "dashboard_trusted_networks_device_uidx"
      ON "dashboard_trusted_networks" ("device_id");
  `);
}

/**
 * Registers or renews the public IP seen from a trusted local device.
 * @param options Device id, label, incoming headers and optional TTL.
 * @returns The detected IP and expiration.
 */
export async function renewDashboardTrustedNetwork(options: {
  deviceId: string;
  label: string;
  headers: Headers;
  ttlHours?: number;
}) {
  await ensureDashboardTrustedNetworksSchema();
  const ipAddress = resolveDashboardClientIp(options.headers);
  if (!ipAddress) {
    throw new Error('client_ip_not_detected');
  }

  const now = new Date();
  const ttlHours = Math.min(Math.max(options.ttlHours ?? DEFAULT_TRUSTED_NETWORK_TTL_HOURS, 1), 168);
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
  const deviceId = options.deviceId.trim().slice(0, 120);
  const label = options.label.trim().slice(0, 160) || deviceId;

  await db
    .insert(dashboardTrustedNetworksSchema)
    .values({
      deviceId,
      label,
      ipAddress,
      lastSeenAt: now,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: dashboardTrustedNetworksSchema.deviceId,
      set: {
        label,
        ipAddress,
        lastSeenAt: now,
        expiresAt,
      },
    });

  return { ipAddress, expiresAt };
}

/** Returns true when a dashboard request comes from a static or heartbeat-trusted IP. */
export async function isDashboardTrustedNetworkRequest(headers: Headers) {
  if (isDashboardNetworkAllowed(headers)) {
    return true;
  }

  const clientIp = resolveDashboardClientIp(headers);
  if (!clientIp) {
    return false;
  }

  try {
    const now = new Date();
    const rows = await db
      .select({ id: dashboardTrustedNetworksSchema.id })
      .from(dashboardTrustedNetworksSchema)
      .where(
        and(
          eq(dashboardTrustedNetworksSchema.ipAddress, clientIp),
          gt(dashboardTrustedNetworksSchema.expiresAt, now),
        ),
      )
      .limit(1);

    return Boolean(rows[0]);
  } catch {
    return false;
  }
}
