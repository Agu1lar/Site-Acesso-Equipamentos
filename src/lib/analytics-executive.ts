import 'server-only';

import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { EquipmentCategory } from '@/types/equipment';
import { CATEGORY_LABELS, isEquipmentCategory } from '@/types/equipment';
import type { DailyConversionRow, ExecutiveSummary } from '@/lib/analytics-executive-types';
import { db } from '@/libs/DB';
import { analyticsEventsSchema, leadsSchema, pageEngagementEventsSchema } from '@/models/Schema';
import { QuoteCartItemSchema } from '@/validations/quote';

export type { DailyConversionRow, ExecutiveSummary } from '@/lib/analytics-executive-types';

const eventDaySql = (column: typeof analyticsEventsSchema.createdAt) =>
  sql<string>`to_char((${column} at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD')`;

const engagementDaySql = sql<string>`to_char((${pageEngagementEventsSchema.createdAt} at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD')`;

const leadDaySql = sql<string>`to_char((${leadsSchema.createdAt} at time zone 'America/Sao_Paulo'), 'YYYY-MM-DD')`;

function categoryLabelFromSlug(slug: string) {
  if (isEquipmentCategory(slug)) {
    return CATEGORY_LABELS[slug as EquipmentCategory];
  }

  return slug.replace(/-/g, ' ');
}

/**
 * Daily visits, WhatsApp and quote leads for executive charts.
 */
export async function getDailyConversionSeries(from: Date, to: Date) {
  const [pageRows, whatsappRows, leadRows] = await Promise.all([
    db
      .select({
        date: engagementDaySql,
        count: count(),
      })
      .from(pageEngagementEventsSchema)
      .where(
        and(
          gte(pageEngagementEventsSchema.createdAt, from),
          lte(pageEngagementEventsSchema.createdAt, to),
        ),
      )
      .groupBy(engagementDaySql)
      .orderBy(engagementDaySql),
    db
      .select({
        date: eventDaySql(analyticsEventsSchema.createdAt),
        count: count(),
      })
      .from(analyticsEventsSchema)
      .where(
        and(
          eq(analyticsEventsSchema.eventType, 'whatsapp_click'),
          gte(analyticsEventsSchema.createdAt, from),
          lte(analyticsEventsSchema.createdAt, to),
        ),
      )
      .groupBy(eventDaySql(analyticsEventsSchema.createdAt))
      .orderBy(eventDaySql(analyticsEventsSchema.createdAt)),
    db
      .select({
        date: leadDaySql,
        count: count(),
      })
      .from(leadsSchema)
      .where(
        and(
          eq(leadsSchema.leadKind, 'quote'),
          gte(leadsSchema.createdAt, from),
          lte(leadsSchema.createdAt, to),
        ),
      )
      .groupBy(leadDaySql)
      .orderBy(leadDaySql),
  ]);

  const merged = new Map<string, DailyConversionRow>();

  for (const row of pageRows) {
    merged.set(row.date, {
      date: row.date,
      pageViews: row.count,
      whatsappClicks: 0,
      quoteSubmits: 0,
    });
  }

  for (const row of whatsappRows) {
    const current = merged.get(row.date) ?? {
      date: row.date,
      pageViews: 0,
      whatsappClicks: 0,
      quoteSubmits: 0,
    };
    current.whatsappClicks = row.count;
    merged.set(row.date, current);
  }

  for (const row of leadRows) {
    const current = merged.get(row.date) ?? {
      date: row.date,
      pageViews: 0,
      whatsappClicks: 0,
      quoteSubmits: 0,
    };
    current.quoteSubmits = row.count;
    merged.set(row.date, current);
  }

  return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Lead count grouped by city (form) with geo fallback from analytics consent.
 */
export async function getLeadsByCity(from: Date, to: Date, limit = 12) {
  const cityLabel = sql<string>`coalesce(nullif(trim(${leadsSchema.city}), ''), nullif(trim(${leadsSchema.geoCity}), ''), '—')`;

  const rows = await db
    .select({
      label: cityLabel,
      count: count(),
    })
    .from(leadsSchema)
    .where(and(gte(leadsSchema.createdAt, from), lte(leadsSchema.createdAt, to)))
    .groupBy(cityLabel)
    .orderBy(desc(count()))
    .limit(limit);

  return rows.map((row) => ({ label: row.label, count: row.count }));
}

/**
 * Top equipment slugs quoted from cart items and single-equipment leads.
 */
export async function getTopQuotedEquipment(from: Date, to: Date, limit = 10) {
  const rows = await db
    .select({
      itemsJson: leadsSchema.itemsJson,
      equipmentSlug: leadsSchema.equipmentSlug,
      equipmentName: leadsSchema.equipmentName,
    })
    .from(leadsSchema)
    .where(
      and(
        eq(leadsSchema.leadKind, 'quote'),
        gte(leadsSchema.createdAt, from),
        lte(leadsSchema.createdAt, to),
      ),
    );

  const totals = new Map<string, { label: string; count: number }>();

  for (const row of rows) {
    if (row.itemsJson) {
      try {
        const parsed = JSON.parse(row.itemsJson) as unknown;
        const items = Array.isArray(parsed) ? parsed : [];
        for (const item of items) {
          const validated = QuoteCartItemSchema.safeParse(item);
          if (!validated.success) {
            continue;
          }
          const key = validated.data.slug;
          const existing = totals.get(key);
          totals.set(key, {
            label: validated.data.name,
            count: (existing?.count ?? 0) + validated.data.quantity,
          });
        }
        continue;
      } catch {
        // fall through to single equipment fields
      }
    }

    if (row.equipmentSlug) {
      const firstSlug = row.equipmentSlug.split(',')[0]?.trim();
      if (!firstSlug) {
        continue;
      }
      const existing = totals.get(firstSlug);
      totals.set(firstSlug, {
        label: row.equipmentName?.split(',')[0]?.trim() ?? firstSlug,
        count: (existing?.count ?? 0) + 1,
      });
    }
  }

  return [...totals.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Category page views from engagement paths (/categorias/{slug}).
 */
export async function getTopCategoriesByEngagement(from: Date, to: Date, limit = 8) {
  const categorySlugSql = sql<string>`substring(${pageEngagementEventsSchema.pathname} from 'categorias/([^/?]+)')`;

  const rows = await db
    .select({
      slug: categorySlugSql,
      count: count(),
    })
    .from(pageEngagementEventsSchema)
    .where(
      and(
        gte(pageEngagementEventsSchema.createdAt, from),
        lte(pageEngagementEventsSchema.createdAt, to),
        sql`${pageEngagementEventsSchema.pathname} like '%/categorias/%'`,
      ),
    )
    .groupBy(categorySlugSql)
    .orderBy(desc(count()))
    .limit(limit);

  return rows
    .filter((row) => row.slug)
    .map((row) => ({
      label: categoryLabelFromSlug(row.slug!),
      count: row.count,
    }));
}

export async function getExecutiveSummary(from: Date, to: Date): Promise<ExecutiveSummary> {
  const [dailySeries, leadsByCity, topQuotedEquipment, topCategories] = await Promise.all([
    getDailyConversionSeries(from, to),
    getLeadsByCity(from, to),
    getTopQuotedEquipment(from, to),
    getTopCategoriesByEngagement(from, to),
  ]);

  return {
    dailySeries,
    leadsByCity,
    topQuotedEquipment,
    topCategories,
  };
}
