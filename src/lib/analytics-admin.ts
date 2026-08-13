import 'server-only';

import { and, count, desc, eq, gte, lte, ne, sql } from 'drizzle-orm';

import {
  getExecutiveSummary,
} from '@/lib/analytics-executive';
import { sumAnalyticsDailyForPeriod } from '@/lib/analytics-daily';
import {
  buildConversionFunnel,
  buildLeadReplyFunnel,
  summarizeQuoteAbandon,
} from '@/lib/analytics-funnel';
import type { LeadReplyFunnelCounts } from '@/lib/analytics-funnel';
import { isInternalAnalyticsPath } from '@/lib/analytics-internal-paths';
import { runAnalyticsDashboardStep, parseAnalyticsDashboardFailure } from '@/lib/analytics-dashboard-errors';
import { isAnalyticsSchemaMissingError, withAnalyticsSchema } from '@/lib/analytics-schema';
import {
  formatDevice,
  formatEquipmentAnalyticsLabel,
  formatSitePath,
  formatTrafficSource,
  formatWhatsAppOrigin,
  formatPhoneOrigin,
} from '@/lib/analytics-display-labels';
import {
  getCampaignPerformanceReport,
  mergeCampaignPerformanceComparison,
} from '@/lib/campaign-analytics';
import { mergeEquipmentConversionRows } from '@/lib/equipment-conversion-analytics';
import { resolveAnalyticsPeriod, resolveComparisonPeriod } from '@/lib/analytics-period';
import type {
  AnalyticsDashboardFilters,
  AnalyticsDashboardProbeResult,
  AnalyticsDashboardProbeStep,
  OperationalDashboard,
} from '@/lib/analytics-admin-types';
import { db } from '@/libs/DB';
import { analyticsEventsSchema, leadsSchema, pageEngagementEventsSchema } from '@/models/Schema';

export type {
  AnalyticsDashboardFilters,
  AnalyticsDashboardProbeResult,
  AnalyticsDashboardProbeStep,
  OperationalDashboard,
  PageEngagementRow,
} from '@/lib/analytics-admin-types';

export { percentChange } from '@/lib/analytics-percent';

type CountRow = { label: string; count: number };

function humanizeCountRows(
  rows: CountRow[],
  formatLabel: (label: string) => string,
): CountRow[] {
  return rows.map((row) => ({
    ...row,
    label: formatLabel(row.label ?? '—'),
  }));
}

async function countEvents(
  eventType: string,
  from: Date,
  to: Date,
) {
  const [row] = await db
    .select({ count: count() })
    .from(analyticsEventsSchema)
    .where(
      and(
        eq(analyticsEventsSchema.eventType, eventType),
        gte(analyticsEventsSchema.createdAt, from),
        lte(analyticsEventsSchema.createdAt, to),
      ),
    );

  return row?.count ?? 0;
}

/**
 * WhatsApp clicks where the visitor had accepted analytics cookies (Ads-eligible).
 */
async function countWhatsAppWithAnalyticsConsent(from: Date, to: Date) {
  const [row] = await db
    .select({ count: count() })
    .from(analyticsEventsSchema)
    .where(
      and(
        eq(analyticsEventsSchema.eventType, 'whatsapp_click'),
        eq(analyticsEventsSchema.analyticsConsent, true),
        gte(analyticsEventsSchema.createdAt, from),
        lte(analyticsEventsSchema.createdAt, to),
      ),
    );

  return row?.count ?? 0;
}

async function whatsappByOrigin(from: Date, to: Date) {
  return clicksByOrigin('whatsapp_click', from, to);
}

async function phoneByOrigin(from: Date, to: Date) {
  return clicksByOrigin('phone_click', from, to);
}

async function clicksByOrigin(eventType: string, from: Date, to: Date) {
  const rows = await db
    .select({
      label: analyticsEventsSchema.origin,
      count: count(),
    })
    .from(analyticsEventsSchema)
    .where(
      and(
        eq(analyticsEventsSchema.eventType, eventType),
        gte(analyticsEventsSchema.createdAt, from),
        lte(analyticsEventsSchema.createdAt, to),
      ),
    )
    .groupBy(analyticsEventsSchema.origin)
    .orderBy(desc(count()));

  return rows
    .filter((row) => row.label)
    .map((row) => ({ label: row.label!, count: row.count }));
}

async function trafficBySourceSimple(from: Date, to: Date) {
  const leadRows = await db
    .select({
      label: sql<string>`coalesce(${leadsSchema.utmSource}, 'direto')`,
      count: count(),
    })
    .from(leadsSchema)
    .where(and(gte(leadsSchema.createdAt, from), lte(leadsSchema.createdAt, to)))
    .groupBy(sql`coalesce(${leadsSchema.utmSource}, 'direto')`);

  const eventRows = await db
    .select({
      label: sql<string>`coalesce(${analyticsEventsSchema.utmSource}, 'direto')`,
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
    .groupBy(sql`coalesce(${analyticsEventsSchema.utmSource}, 'direto')`);

  const merged = new Map<string, number>();

  for (const row of [...leadRows, ...eventRows]) {
    merged.set(row.label, (merged.get(row.label) ?? 0) + row.count);
  }

  return [...merged.entries()]
    .map(([label, countValue]) => ({ label, count: countValue }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

async function topEquipment(
  eventType: 'whatsapp_click' | 'quote_submit',
  from: Date,
  to: Date,
) {
  const rows = await db
    .select({
      label: sql<string>`coalesce(${analyticsEventsSchema.equipmentName}, ${analyticsEventsSchema.equipmentSlug}, '—')`,
      count: count(),
    })
    .from(analyticsEventsSchema)
    .where(
      and(
        eq(analyticsEventsSchema.eventType, eventType),
        gte(analyticsEventsSchema.createdAt, from),
        lte(analyticsEventsSchema.createdAt, to),
      ),
    )
    .groupBy(
      sql`coalesce(${analyticsEventsSchema.equipmentName}, ${analyticsEventsSchema.equipmentSlug}, '—')`,
    )
    .orderBy(desc(count()))
    .limit(8);

  return rows.map((row) => ({ label: row.label, count: row.count }));
}

async function topEquipmentLeads(from: Date, to: Date) {
  const rows = await db
    .select({
      label: sql<string>`coalesce(${leadsSchema.equipmentName}, ${leadsSchema.equipmentSlug}, '—')`,
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
    .groupBy(sql`coalesce(${leadsSchema.equipmentName}, ${leadsSchema.equipmentSlug}, '—')`)
    .orderBy(desc(count()))
    .limit(8);

  return rows.map((row) => ({ label: row.label, count: row.count }));
}

/**
 * Leads grouped by first-touch landing path (query string stripped).
 * Does not mix page-view / WhatsApp event counts — those inflated the old chart.
 */
async function landingPagesSimple(from: Date, to: Date) {
  const landingPathSql = sql<string>`coalesce(
    nullif(split_part(${leadsSchema.landingPage}, '?', 1), ''),
    '—'
  )`;

  const leadRows = await db
    .select({
      label: landingPathSql,
      count: count(),
    })
    .from(leadsSchema)
    .where(
      and(
        gte(leadsSchema.createdAt, from),
        lte(leadsSchema.createdAt, to),
        sql`nullif(trim(${leadsSchema.landingPage}), '') is not null`,
      ),
    )
    .groupBy(landingPathSql)
    .orderBy(desc(count()));

  return leadRows
    .map((row) => ({ label: row.label, count: row.count }))
    .filter((row) => !isInternalAnalyticsPath(row.label))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

async function deviceSplit(from: Date, to: Date) {
  const rows = await db
    .select({
      label: sql<string>`coalesce(${analyticsEventsSchema.device}, 'desconhecido')`,
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
    .groupBy(analyticsEventsSchema.device)
    .orderBy(desc(count()));

  return rows.map((row) => ({ label: row.label, count: row.count }));
}

async function topTermsByEvent(eventType: string, from: Date, to: Date, limit = 8) {
  const rows = await db
    .select({
      label: sql<string>`coalesce(${analyticsEventsSchema.equipmentName}, '—')`,
      count: count(),
    })
    .from(analyticsEventsSchema)
    .where(
      and(
        eq(analyticsEventsSchema.eventType, eventType),
        gte(analyticsEventsSchema.createdAt, from),
        lte(analyticsEventsSchema.createdAt, to),
        sql`${analyticsEventsSchema.equipmentName} is not null`,
      ),
    )
    .groupBy(analyticsEventsSchema.equipmentName)
    .orderBy(desc(count()))
    .limit(limit);

  return rows.map((row) => ({ label: row.label, count: row.count }));
}

type SlugMetricRow = { slug: string; name: string; count: number };

async function equipmentEventCountsBySlug(
  eventType: 'equipment_view' | 'whatsapp_click',
  from: Date,
  to: Date,
): Promise<SlugMetricRow[]> {
  const slugExpr = sql<string>`coalesce(nullif(trim(${analyticsEventsSchema.equipmentSlug}), ''), '—')`;
  const nameExpr = sql<string>`max(coalesce(nullif(trim(${analyticsEventsSchema.equipmentName}), ''), nullif(trim(${analyticsEventsSchema.equipmentSlug}), ''), '—'))`;

  const rows = await db
    .select({
      slug: slugExpr,
      name: nameExpr,
      count: count(),
    })
    .from(analyticsEventsSchema)
    .where(
      and(
        eq(analyticsEventsSchema.eventType, eventType),
        gte(analyticsEventsSchema.createdAt, from),
        lte(analyticsEventsSchema.createdAt, to),
      ),
    )
    .groupBy(slugExpr)
    .orderBy(desc(count()));

  return rows
    .filter((row) => row.slug !== '—')
    .map((row) => ({ slug: row.slug, name: row.name, count: row.count }));
}

async function equipmentLeadCountsBySlug(from: Date, to: Date): Promise<SlugMetricRow[]> {
  const slugExpr = sql<string>`coalesce(nullif(trim(${leadsSchema.equipmentSlug}), ''), '—')`;
  const nameExpr = sql<string>`max(coalesce(nullif(trim(${leadsSchema.equipmentName}), ''), nullif(trim(${leadsSchema.equipmentSlug}), ''), '—'))`;

  const rows = await db
    .select({
      slug: slugExpr,
      name: nameExpr,
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
    .groupBy(slugExpr)
    .orderBy(desc(count()));

  return rows
    .filter((row) => row.slug !== '—')
    .map((row) => ({ slug: row.slug, name: row.name, count: row.count }));
}

async function loadEquipmentConversion(from: Date, to: Date) {
  const [pageViews, whatsapp, leads] = await Promise.all([
    equipmentEventCountsBySlug('equipment_view', from, to),
    equipmentEventCountsBySlug('whatsapp_click', from, to),
    equipmentLeadCountsBySlug(from, to),
  ]);

  return mergeEquipmentConversionRows({ pageViews, whatsapp, leads, limit: 15 });
}

async function loadCampaignPerformance(
  from: Date,
  to: Date,
  compareFrom: Date,
  compareTo: Date,
) {
  const [current, previous] = await Promise.all([
    getCampaignPerformanceReport(from, to),
    getCampaignPerformanceReport(compareFrom, compareTo),
  ]);

  return {
    campaigns: mergeCampaignPerformanceComparison(current.campaigns, previous.campaigns),
    dailyLeads: current.dailyLeads,
  };
}

async function topEquipmentViews(from: Date, to: Date) {
  const rows = await db
    .select({
      label: sql<string>`coalesce(${analyticsEventsSchema.equipmentName}, ${analyticsEventsSchema.equipmentSlug}, '—')`,
      count: count(),
    })
    .from(analyticsEventsSchema)
    .where(
      and(
        eq(analyticsEventsSchema.eventType, 'equipment_view'),
        gte(analyticsEventsSchema.createdAt, from),
        lte(analyticsEventsSchema.createdAt, to),
      ),
    )
    .groupBy(
      sql`coalesce(${analyticsEventsSchema.equipmentName}, ${analyticsEventsSchema.equipmentSlug}, '—')`,
    )
    .orderBy(desc(count()))
    .limit(8);

  return rows.map((row) => ({ label: row.label, count: row.count }));
}

async function scrollDepthBreakdown(from: Date, to: Date) {
  const rows = await db
    .select({
      label: analyticsEventsSchema.origin,
      count: count(),
    })
    .from(analyticsEventsSchema)
    .where(
      and(
        eq(analyticsEventsSchema.eventType, 'scroll_depth'),
        gte(analyticsEventsSchema.createdAt, from),
        lte(analyticsEventsSchema.createdAt, to),
      ),
    )
    .groupBy(analyticsEventsSchema.origin)
    .orderBy(desc(count()));

  return rows
    .filter((row) => row.label)
    .map((row) => ({ label: row.label!, count: row.count }));
}

async function topCategoryFilters(from: Date, to: Date) {
  const rows = await db
    .select({
      label: sql<string>`coalesce(${analyticsEventsSchema.equipmentName}, ${analyticsEventsSchema.equipmentSlug}, '—')`,
      count: count(),
    })
    .from(analyticsEventsSchema)
    .where(
      and(
        eq(analyticsEventsSchema.eventType, 'category_filter'),
        gte(analyticsEventsSchema.createdAt, from),
        lte(analyticsEventsSchema.createdAt, to),
      ),
    )
    .groupBy(
      sql`coalesce(${analyticsEventsSchema.equipmentName}, ${analyticsEventsSchema.equipmentSlug}, '—')`,
    )
    .orderBy(desc(count()))
    .limit(8);

  return rows.map((row) => ({ label: row.label, count: row.count }));
}

function emptyEngagementSummary() {
  return { views: 0, totalActiveSeconds: 0, uniqueSessions: 0 };
}

const EMPTY_DAILY_SUM = {
  pageViews: 0,
  uniqueSessions: 0,
  whatsappClicks: 0,
  quoteSubmits: 0,
};

async function pageEngagementSummary(from: Date, to: Date) {
  return withAnalyticsSchema(emptyEngagementSummary(), () =>
    pageEngagementSummaryQuery(from, to),
  );
}

async function pageEngagementSummaryQuery(from: Date, to: Date) {
  const [row] = await db
    .select({
      views: count(),
      totalActiveSeconds: sql<number>`coalesce(sum(${pageEngagementEventsSchema.activeSeconds}), 0)`,
      uniqueSessions: sql<number>`count(distinct ${pageEngagementEventsSchema.sessionId})`,
    })
    .from(pageEngagementEventsSchema)
    .where(
      and(
        gte(pageEngagementEventsSchema.createdAt, from),
        lte(pageEngagementEventsSchema.createdAt, to),
      ),
    );

  return {
    views: row?.views ?? 0,
    totalActiveSeconds: Number(row?.totalActiveSeconds ?? 0),
    uniqueSessions: Number(row?.uniqueSessions ?? 0),
  };
}

async function topPagesByEngagement(from: Date, to: Date) {
  return withAnalyticsSchema([], () => topPagesByEngagementQuery(from, to));
}

async function topPagesByEngagementQuery(from: Date, to: Date) {
  const rows = await db
    .select({
      pathname: pageEngagementEventsSchema.pathname,
      views: count(),
      totalActiveSeconds: sql<number>`coalesce(sum(${pageEngagementEventsSchema.activeSeconds}), 0)`,
    })
    .from(pageEngagementEventsSchema)
    .where(
      and(
        gte(pageEngagementEventsSchema.createdAt, from),
        lte(pageEngagementEventsSchema.createdAt, to),
      ),
    )
    .groupBy(pageEngagementEventsSchema.pathname)
    .orderBy(desc(count()))
    .limit(12);

  return rows.map((row) => {
    const views = row.views;
    const totalActiveSeconds = Number(row.totalActiveSeconds);
    return {
      pathname: row.pathname,
      views,
      totalActiveSeconds,
      avgActiveSeconds: views > 0 ? Math.round(totalActiveSeconds / views) : 0,
    };
  });
}

async function countCookieConsentLeads(from: Date, to: Date) {
  return withAnalyticsSchema(0, async () => {
    const [row] = await db
      .select({ count: count() })
      .from(leadsSchema)
      .where(
        and(
          eq(leadsSchema.leadKind, 'cookie_consent'),
          gte(leadsSchema.createdAt, from),
          lte(leadsSchema.createdAt, to),
        ),
      );

    return row?.count ?? 0;
  });
}

const EMPTY_LEAD_REPLY_FUNNEL: LeadReplyFunnelCounts = {
  leads: 0,
  whatsappReplied: 0,
  won: 0,
};

/** Quote leads cohort: total → ChatPro replied → won. */
async function countLeadReplyFunnel(from: Date, to: Date): Promise<LeadReplyFunnelCounts> {
  return withAnalyticsSchema(EMPTY_LEAD_REPLY_FUNNEL, async () => {
    const [row] = await db
      .select({
        leads: count(),
        whatsappReplied: sql<number>`count(*) filter (where ${leadsSchema.whatsappRepliedAt} is not null)`,
        won: sql<number>`count(*) filter (where ${leadsSchema.status} = 'won')`,
      })
      .from(leadsSchema)
      .where(
        and(
          ne(leadsSchema.leadKind, 'cookie_consent'),
          gte(leadsSchema.createdAt, from),
          lte(leadsSchema.createdAt, to),
        ),
      );

    return {
      leads: row?.leads ?? 0,
      whatsappReplied: Number(row?.whatsappReplied ?? 0),
      won: Number(row?.won ?? 0),
    };
  });
}

/**
 * Loads operational dashboard metrics from Neon conversion tables.
 */
export async function getOperationalDashboard(
  filters: AnalyticsDashboardFilters = {},
): Promise<OperationalDashboard> {
  try {
    return await loadOperationalDashboard(filters);
  } catch (error) {
    if (!isAnalyticsSchemaMissingError(error)) {
      throw error;
    }

    return buildEmptyOperationalDashboard(filters, true);
  }
}

function buildEmptyOperationalDashboard(
  filters: AnalyticsDashboardFilters,
  schemaIncomplete: boolean,
): OperationalDashboard {
  const period = resolveAnalyticsPeriod(filters);
  const comparison = resolveComparisonPeriod(period, filters);

  return {
    period: { dateFrom: period.dateFrom, dateTo: period.dateTo },
    comparisonPeriod: { dateFrom: comparison.dateFrom, dateTo: comparison.dateTo },
    comparisonMode: comparison.comparisonMode,
    previousPeriod: { dateFrom: comparison.dateFrom, dateTo: comparison.dateTo },
    pageViews: 0,
    uniqueSessions: 0,
    pageViewsPrevious: 0,
    uniqueSessionsPrevious: 0,
    totalActiveSeconds: 0,
    totalActiveSecondsPrevious: 0,
    whatsappClicks: 0,
    whatsappClicksWithConsent: 0,
    quoteSubmits: 0,
    cookieConsentLeads: 0,
    whatsappClicksPrevious: 0,
    quoteSubmitsPrevious: 0,
    phoneClicks: 0,
    phoneClicksPrevious: 0,
    whatsappByOrigin: [],
    phoneByOrigin: [],
    trafficBySource: [],
    campaignPerformance: [],
    campaignDailyLeads: [],
    topEquipmentWhatsapp: [],
    topEquipmentLeads: [],
    topPages: [],
    equipmentConversion: [],
    landingPages: [],
    deviceSplit: [],
    conversionFunnel: buildConversionFunnel({
      visits: 0,
      equipmentViews: 0,
      addToQuote: 0,
      quoteSubmits: 0,
      whatsappClicks: 0,
    }),
    leadReplyFunnel: buildLeadReplyFunnel({
      leads: 0,
      whatsappReplied: 0,
      won: 0,
    }),
    quoteAbandon: summarizeQuoteAbandon({
      addToQuote: 0,
      quoteSubmits: 0,
      quoteAbandons: 0,
    }),
    topSearchTerms: [],
    scrollDepth: [],
    topEquipmentViews: [],
    topCategoryFilters: [],
    executive: {
      dailySeries: [],
      leadsByCity: [],
      topQuotedEquipment: [],
      topCategories: [],
    },
    posthogHint: Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY),
    schemaIncomplete,
  };
}

async function loadOperationalDashboard(
  filters: AnalyticsDashboardFilters = {},
): Promise<OperationalDashboard> {
  const period = resolveAnalyticsPeriod(filters);
  const comparison = resolveComparisonPeriod(period, filters);

  const [
    dailyCurrent,
    dailyPrevious,
    engagementCurrent,
    engagementPrevious,
    whatsappClicks,
    whatsappClicksWithConsent,
    quoteSubmits,
    cookieConsentLeads,
    whatsappClicksPrevious,
    quoteSubmitsPrevious,
    phoneClicks,
    phoneClicksPrevious,
    whatsappByOriginRows,
    phoneByOriginRows,
    trafficBySource,
    topEquipmentWhatsapp,
    topEquipmentLeadsRows,
    topPagesRows,
    landingPages,
    deviceSplitRows,
    equipmentViewsCount,
    addToQuoteCount,
    quoteAbandonCount,
    topSearchTermsRows,
    scrollDepthRows,
    topEquipmentViewsRows,
    topCategoryFiltersRows,
    executiveSummary,
    leadReplyFunnelCounts,
    campaignPerformanceResult,
    equipmentConversionRows,
  ] = await Promise.all([
    runAnalyticsDashboardStep('daily_current', 'Agregados diários (período)', () =>
      withAnalyticsSchema(EMPTY_DAILY_SUM, () => sumAnalyticsDailyForPeriod(period.dateFrom, period.dateTo)),
    ),
    runAnalyticsDashboardStep('daily_previous', 'Agregados diários (período anterior)', () =>
      withAnalyticsSchema(EMPTY_DAILY_SUM, () =>
        sumAnalyticsDailyForPeriod(comparison.dateFrom, comparison.dateTo),
      ),
    ),
    runAnalyticsDashboardStep('engagement_current', 'Tempo ativo por página (período)', () =>
      pageEngagementSummary(period.from, period.to),
    ),
    runAnalyticsDashboardStep('engagement_previous', 'Tempo ativo por página (período anterior)', () =>
      pageEngagementSummary(comparison.from, comparison.to),
    ),
    runAnalyticsDashboardStep('whatsapp_current', 'Cliques WhatsApp (período)', () =>
      withAnalyticsSchema(0, () => countEvents('whatsapp_click', period.from, period.to)),
    ),
    runAnalyticsDashboardStep('whatsapp_consent_current', 'WhatsApp com cookie analytics', () =>
      withAnalyticsSchema(0, () => countWhatsAppWithAnalyticsConsent(period.from, period.to)),
    ),
    runAnalyticsDashboardStep('quote_submits_current', 'Leads de orçamento (período)', () =>
      withAnalyticsSchema(0, () => countEvents('quote_submit', period.from, period.to)),
    ),
    runAnalyticsDashboardStep('cookie_consent_leads', 'Leads Google (cookies)', () =>
      countCookieConsentLeads(period.from, period.to),
    ),
    runAnalyticsDashboardStep('whatsapp_previous', 'Cliques WhatsApp (período anterior)', () =>
      withAnalyticsSchema(0, () => countEvents('whatsapp_click', comparison.from, comparison.to)),
    ),
    runAnalyticsDashboardStep('quote_submits_previous', 'Leads de orçamento (período anterior)', () =>
      withAnalyticsSchema(0, () => countEvents('quote_submit', comparison.from, comparison.to)),
    ),
    runAnalyticsDashboardStep('phone_current', 'Cliques ligar (período)', () =>
      withAnalyticsSchema(0, () => countEvents('phone_click', period.from, period.to)),
    ),
    runAnalyticsDashboardStep('phone_previous', 'Cliques ligar (período anterior)', () =>
      withAnalyticsSchema(0, () => countEvents('phone_click', comparison.from, comparison.to)),
    ),
    runAnalyticsDashboardStep('whatsapp_by_origin', 'WhatsApp por origem', () =>
      withAnalyticsSchema([], () => whatsappByOrigin(period.from, period.to)),
    ),
    runAnalyticsDashboardStep('phone_by_origin', 'Ligar por origem', () =>
      withAnalyticsSchema([], () => phoneByOrigin(period.from, period.to)),
    ),
    runAnalyticsDashboardStep('traffic_by_source', 'Tráfego por fonte UTM', () =>
      withAnalyticsSchema([], () => trafficBySourceSimple(period.from, period.to)),
    ),
    runAnalyticsDashboardStep('top_equipment_whatsapp', 'Equipamentos (WhatsApp)', () =>
      withAnalyticsSchema([], () => topEquipment('whatsapp_click', period.from, period.to)),
    ),
    runAnalyticsDashboardStep('top_equipment_leads', 'Equipamentos (leads)', () =>
      withAnalyticsSchema([], () => topEquipmentLeads(period.from, period.to)),
    ),
    runAnalyticsDashboardStep('top_pages', 'Páginas mais acessadas', () =>
      topPagesByEngagement(period.from, period.to),
    ),
    runAnalyticsDashboardStep('landing_pages', 'Leads por página de entrada', () =>
      withAnalyticsSchema([], () => landingPagesSimple(period.from, period.to)),
    ),
    runAnalyticsDashboardStep('device_split', 'Dispositivos', () =>
      withAnalyticsSchema([], () => deviceSplit(period.from, period.to)),
    ),
    runAnalyticsDashboardStep('equipment_views', 'Visualizações de ficha', () =>
      withAnalyticsSchema(0, () => countEvents('equipment_view', period.from, period.to)),
    ),
    runAnalyticsDashboardStep('add_to_quote', 'Itens no carrinho', () =>
      withAnalyticsSchema(0, () => countEvents('add_to_quote', period.from, period.to)),
    ),
    runAnalyticsDashboardStep('quote_abandon', 'Abandono de orçamento', () =>
      withAnalyticsSchema(0, () => countEvents('quote_abandon', period.from, period.to)),
    ),
    runAnalyticsDashboardStep('top_search_terms', 'Termos de busca', () =>
      withAnalyticsSchema([], () => topTermsByEvent('search', period.from, period.to)),
    ),
    runAnalyticsDashboardStep('scroll_depth', 'Profundidade de rolagem', () =>
      withAnalyticsSchema([], () => scrollDepthBreakdown(period.from, period.to)),
    ),
    runAnalyticsDashboardStep('top_equipment_views', 'Equipamentos visualizados', () =>
      withAnalyticsSchema([], () => topEquipmentViews(period.from, period.to)),
    ),
    runAnalyticsDashboardStep('top_category_filters', 'Filtros de categoria', () =>
      withAnalyticsSchema([], () => topCategoryFilters(period.from, period.to)),
    ),
    runAnalyticsDashboardStep('executive_summary', 'Resumo executivo', () =>
      withAnalyticsSchema(
        {
          dailySeries: [],
          leadsByCity: [],
          topQuotedEquipment: [],
          topCategories: [],
        },
        () => getExecutiveSummary(period.from, period.to),
      ),
    ),
    runAnalyticsDashboardStep('lead_reply_funnel', 'Funil lead → respondeu WhatsApp → ganho', () =>
      countLeadReplyFunnel(period.from, period.to),
    ),
    runAnalyticsDashboardStep('campaign_performance', 'Performance por campanha UTM', () =>
      loadCampaignPerformance(period.from, period.to, comparison.from, comparison.to),
    ),
    runAnalyticsDashboardStep('equipment_conversion', 'Conversão por equipamento', () =>
      withAnalyticsSchema([], () => loadEquipmentConversion(period.from, period.to)),
    ),
  ]);

  const pageViews = engagementCurrent.views || dailyCurrent.pageViews;
  const pageViewsPrevious = engagementPrevious.views || dailyPrevious.pageViews;
  const uniqueSessions = engagementCurrent.uniqueSessions || dailyCurrent.uniqueSessions;
  const uniqueSessionsPrevious =
    engagementPrevious.uniqueSessions || dailyPrevious.uniqueSessions;

  return {
    period: { dateFrom: period.dateFrom, dateTo: period.dateTo },
    comparisonPeriod: { dateFrom: comparison.dateFrom, dateTo: comparison.dateTo },
    comparisonMode: comparison.comparisonMode,
    previousPeriod: { dateFrom: comparison.dateFrom, dateTo: comparison.dateTo },
    pageViews,
    uniqueSessions,
    pageViewsPrevious,
    uniqueSessionsPrevious,
    totalActiveSeconds: engagementCurrent.totalActiveSeconds,
    totalActiveSecondsPrevious: engagementPrevious.totalActiveSeconds,
    whatsappClicks,
    whatsappClicksWithConsent,
    quoteSubmits,
    cookieConsentLeads,
    whatsappClicksPrevious,
    quoteSubmitsPrevious,
    phoneClicks,
    phoneClicksPrevious,
    whatsappByOrigin: humanizeCountRows(whatsappByOriginRows, formatWhatsAppOrigin),
    phoneByOrigin: humanizeCountRows(phoneByOriginRows, formatPhoneOrigin),
    trafficBySource: humanizeCountRows(trafficBySource, formatTrafficSource),
    campaignPerformance: campaignPerformanceResult.campaigns,
    campaignDailyLeads: campaignPerformanceResult.dailyLeads,
    topEquipmentWhatsapp: humanizeCountRows(topEquipmentWhatsapp, (label) =>
      formatEquipmentAnalyticsLabel(label, 'whatsapp'),
    ),
    topEquipmentLeads: humanizeCountRows(topEquipmentLeadsRows, (label) =>
      formatEquipmentAnalyticsLabel(label, 'lead'),
    ),
    topPages: topPagesRows.map((row) => {
      const formatted = formatSitePath(row.pathname);
      return {
        ...row,
        pathname: formatted,
        pathnameDetail: formatted !== row.pathname ? row.pathname : undefined,
      };
    }),
    equipmentConversion: equipmentConversionRows,
    landingPages: humanizeCountRows(landingPages, formatSitePath),
    deviceSplit: humanizeCountRows(deviceSplitRows, formatDevice),
    conversionFunnel: buildConversionFunnel({
      visits: pageViews,
      equipmentViews: equipmentViewsCount,
      addToQuote: addToQuoteCount,
      quoteSubmits,
      whatsappClicks,
    }),
    leadReplyFunnel: buildLeadReplyFunnel(leadReplyFunnelCounts),
    quoteAbandon: summarizeQuoteAbandon({
      addToQuote: addToQuoteCount,
      quoteSubmits,
      quoteAbandons: quoteAbandonCount,
    }),
    topSearchTerms: topSearchTermsRows,
    scrollDepth: humanizeCountRows(scrollDepthRows, (label) =>
      label.replace(/^scroll_/u, '').concat('%'),
    ),
    topEquipmentViews: topEquipmentViewsRows,
    topCategoryFilters: topCategoryFiltersRows,
    executive: executiveSummary,
    posthogHint: Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY),
    schemaIncomplete: false,
  };
}

/**
 * Runs each analytics dashboard query in order and reports the first failing step.
 */
export async function probeAnalyticsDashboard(
  filters: AnalyticsDashboardFilters = {},
): Promise<AnalyticsDashboardProbeResult> {
  const period = resolveAnalyticsPeriod(filters);
  const steps: AnalyticsDashboardProbeStep[] = [];

  const definitions: Array<{ id: string; label: string; run: () => Promise<unknown> }> = [
    {
      id: 'daily_current',
      label: 'Tabela analytics_daily (período)',
      run: () => sumAnalyticsDailyForPeriod(period.dateFrom, period.dateTo),
    },
    {
      id: 'engagement_current',
      label: 'Tabela page_engagement_events (período)',
      run: () => pageEngagementSummaryQuery(period.from, period.to),
    },
    {
      id: 'whatsapp_current',
      label: 'Tabela analytics_events — WhatsApp',
      run: () => countEvents('whatsapp_click', period.from, period.to),
    },
    {
      id: 'cookie_consent_leads',
      label: 'Coluna leads.lead_kind — Google cookies',
      run: () => countCookieConsentLeads(period.from, period.to),
    },
    {
      id: 'lead_reply_funnel',
      label: 'Funil lead → respondeu WhatsApp → ganho',
      run: () => countLeadReplyFunnel(period.from, period.to),
    },
    {
      id: 'traffic_by_source',
      label: 'UTM em leads + analytics_events',
      run: () => trafficBySourceSimple(period.from, period.to),
    },
    {
      id: 'landing_pages',
      label: 'Leads por página de entrada (landing_page)',
      run: () => landingPagesSimple(period.from, period.to),
    },
    {
      id: 'full_dashboard',
      label: 'Dashboard completo (getOperationalDashboard)',
      run: () => getOperationalDashboard(filters),
    },
  ];

  for (const definition of definitions) {
    const started = Date.now();
    try {
      await definition.run();
      steps.push({
        id: definition.id,
        label: definition.label,
        status: 'ok',
        durationMs: Date.now() - started,
      });
    } catch (error) {
      const failure = parseAnalyticsDashboardFailure(error);
      steps.push({
        id: definition.id,
        label: definition.label,
        status: 'error',
        durationMs: Date.now() - started,
        error: failure.message,
        cause: failure.cause,
      });
      return { ok: false, failedStepId: definition.id, steps };
    }
  }

  return { ok: true, steps };
}
