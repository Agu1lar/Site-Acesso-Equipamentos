import { and, asc, count, eq, lte, sql } from 'drizzle-orm';
import { APP_TIMEZONE } from '@/lib/app-datetime';
import { scoreLeadIntent } from '@/lib/lead-intent-score';
import { currentWeekRange } from '@/lib/leads-date-presets';
import { db } from '@/libs/DB';
import { leadsSchema } from '@/models/Schema';
import type { LeadWithIntent } from '@/lib/leads-admin';

/** Hours a lead can stay "new" before the stale alert appears. */
export const STALE_LEAD_HOURS = 24;

const leadActivityOrder = sql`coalesce(${leadsSchema.lastActivityAt}, ${leadsSchema.createdAt})`;

function buildCurrentWeekActivityWhere() {
  const weekRange = currentWeekRange();
  return and(
    sql`(${leadActivityOrder} at time zone ${APP_TIMEZONE})::date >= ${weekRange.dateFrom}::date`,
    sql`(${leadActivityOrder} at time zone ${APP_TIMEZONE})::date <= ${weekRange.dateTo}::date`,
  );
}

export type StaleLeadsSummary = {
  leads: LeadWithIntent[];
  total: number;
  thresholdHours: number;
};

/**
 * Returns how many whole hours have passed since the lead's last activity.
 */
export function hoursSinceLeadActivity(
  lead: Pick<LeadWithIntent, 'createdAt' | 'lastActivityAt'>,
  now = Date.now(),
) {
  const reference = lead.lastActivityAt ?? lead.createdAt;
  return Math.floor((now - reference.getTime()) / (60 * 60 * 1000));
}

/**
 * Lists new leads older than the stale threshold without contact.
 */
export async function listStaleNewLeads(limit = 10): Promise<StaleLeadsSummary> {
  const cutoff = new Date(Date.now() - STALE_LEAD_HOURS * 60 * 60 * 1000);
  const where = and(
    eq(leadsSchema.status, 'new'),
    lte(leadActivityOrder, cutoff),
    buildCurrentWeekActivityWhere(),
  );

  const [rows, countRow] = await Promise.all([
    db
      .select()
      .from(leadsSchema)
      .where(where)
      .orderBy(asc(leadActivityOrder))
      .limit(limit),
    db.select({ count: count() }).from(leadsSchema).where(where),
  ]);

  return {
    leads: rows.map((lead) => ({
      ...lead,
      ...scoreLeadIntent(lead),
    })),
    total: countRow[0]?.count ?? 0,
    thresholdHours: STALE_LEAD_HOURS,
  };
}
