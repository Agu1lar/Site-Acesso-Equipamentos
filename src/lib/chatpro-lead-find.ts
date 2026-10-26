import 'server-only';

import { and, desc, eq, gte, ne, or, sql } from 'drizzle-orm';
import { subscriberKey } from '@/lib/lead-contact';
import { db } from '@/libs/DB';
import { leadsSchema } from '@/models/Schema';

/** Only match leads created/active in this window (avoids stale phone reuse). */
export const CHATPRO_LEAD_MATCH_WINDOW_DAYS = 45;

/**
 * Finds the newest eligible lead for a ChatPro phone key.
 * A mobile with and without the extra 9 is the same lead. Two leads on those 8 digits stay unmatched.
 * @param phoneKey Normalized phone suffix from ChatPro.
 */
export async function findLeadMatchForChatProPhone(phoneKey: string) {
  const tail = subscriberKey(phoneKey);
  if (tail) {
    const matches = await leadIdsForPhoneSuffix(tail, 8, 2);
    if (matches.length > 1) {
      return { leadId: null, ambiguous: true };
    }
    if (matches[0]) {
      return { leadId: matches[0], ambiguous: false };
    }
  }

  const exact = await leadIdsForPhoneSuffix(phoneKey, phoneKey.length, 1);
  return { leadId: exact[0] ?? null, ambiguous: false };
}

/**
 * Finds one lead for a phone, or nothing when the 8 local digits match more than one lead.
 * @param phoneKey Normalized phone suffix from ChatPro.
 */
export async function findLeadIdForChatProPhone(phoneKey: string) {
  const match = await findLeadMatchForChatProPhone(phoneKey);
  return match.ambiguous ? null : match.leadId;
}

async function leadIdsForPhoneSuffix(phoneKey: string, keyLen: number, limit: number) {
  const since = new Date();
  since.setDate(since.getDate() - CHATPRO_LEAD_MATCH_WINDOW_DAYS);

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
    .limit(limit);

  return matches.map(row => row.id);
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
      gbraid: leadsSchema.gbraid,
      wbraid: leadsSchema.wbraid,
      utmSource: leadsSchema.utmSource,
      utmMedium: leadsSchema.utmMedium,
      utmCampaign: leadsSchema.utmCampaign,
      utmContent: leadsSchema.utmContent,
      utmTerm: leadsSchema.utmTerm,
      referrer: leadsSchema.referrer,
      landingPage: leadsSchema.landingPage,
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
