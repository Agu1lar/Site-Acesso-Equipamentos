import 'server-only';

import { and, desc, eq, gte, ne, or, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { leadsSchema } from '@/models/Schema';

/** Only match leads created/active in this window (avoids stale phone reuse). */
export const CHATPRO_LEAD_MATCH_WINDOW_DAYS = 45;

/**
 * Finds the newest eligible lead for a ChatPro phone key.
 * @param phoneKey Normalized phone suffix from ChatPro.
 */
export async function findLeadIdForChatProPhone(phoneKey: string) {
  const since = new Date();
  since.setDate(since.getDate() - CHATPRO_LEAD_MATCH_WINDOW_DAYS);

  const keyLen = phoneKey.length;

  const matches = await db
    .select({ id: leadsSchema.id })
    .from(leadsSchema)
    .where(
      and(
        ne(leadsSchema.leadKind, 'cookie_consent'),
        or(gte(leadsSchema.createdAt, since), gte(leadsSchema.lastActivityAt, since)),
        sql`right(regexp_replace(coalesce(${leadsSchema.phone}, ''), '\\D', '', 'g'), ${keyLen}) = ${phoneKey}`,
      ),
    )
    .orderBy(desc(sql`coalesce(${leadsSchema.lastActivityAt}, ${leadsSchema.createdAt})`))
    .limit(1);

  return matches[0]?.id ?? null;
}

/**
 * Loads a lead snapshot for ROI eligibility checks.
 * @param leadId Lead primary key.
 */
export async function loadCampaignLeadSnapshot(leadId: number) {
  const rows = await db
    .select({
      id: leadsSchema.id,
      status: leadsSchema.status,
      gclid: leadsSchema.gclid,
      utmSource: leadsSchema.utmSource,
      utmMedium: leadsSchema.utmMedium,
      utmCampaign: leadsSchema.utmCampaign,
      whatsappRepliedAt: leadsSchema.whatsappRepliedAt,
      lastActivityAt: leadsSchema.lastActivityAt,
      createdAt: leadsSchema.createdAt,
      name: leadsSchema.name,
      equipmentName: leadsSchema.equipmentName,
      city: leadsSchema.city,
      message: leadsSchema.message,
    })
    .from(leadsSchema)
    .where(eq(leadsSchema.id, leadId))
    .limit(1);

  return rows[0] ?? null;
}
