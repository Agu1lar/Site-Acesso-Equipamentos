import 'server-only';

import { and, count, desc, eq, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { APP_TIMEZONE, formatDateTimeBrasiliaExport } from '@/lib/app-datetime';
import {
  GOOGLE_ADS_NO_UTM_KEY,
  NO_CAMPAIGN_KEY,
} from '@/lib/campaign-analytics';
import type { InferSelectModel } from 'drizzle-orm';
import { countContactOrders, normalizeLeadEmail, normalizeLeadPhone, sortRelatedLeads } from '@/lib/lead-contact';
import { formatLeadCartItems } from '@/lib/lead-cart';
import type { LeadStatus } from '@/lib/lead-status';
import { scoreLeadIntent } from '@/lib/lead-intent-score';
import { currentWeekRange } from '@/lib/leads-date-presets';
import { db } from '@/libs/DB';
import { leadsSchema } from '@/models/Schema';

export { formatLeadCartItems, parseLeadCartItems } from '@/lib/lead-cart';

export type LeadRecord = InferSelectModel<typeof leadsSchema>;

const leadActivityOrder = sql`coalesce(${leadsSchema.lastActivityAt}, ${leadsSchema.createdAt})`;

/** Max rows shown in the commercial queue card (scrollable). */
export const COMMERCIAL_QUEUE_MAX = 12;

/** Max rows on the weekly operational table before linking to consulta. */
export const WEEK_LEADS_DISPLAY_MAX = 20;

export type LeadListFilters = {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  city?: string;
  origin?: string;
  campaignKey?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type LeadListSearchParams = {
  dateFrom?: string | null;
  dateTo?: string | null;
  status?: string | null;
  city?: string | null;
  origin?: string | null;
  campaignKey?: string | null;
  q?: string | null;
  page?: string | null;
};

/** Parses lead list filters from URL or export query params. */
export function parseLeadListFiltersFromSearchParams(
  params: LeadListSearchParams,
): LeadListFilters {
  const page = params.page ? Number.parseInt(params.page, 10) : undefined;
  return {
    dateFrom: params.dateFrom ?? undefined,
    dateTo: params.dateTo ?? undefined,
    status: params.status ?? undefined,
    city: params.city ?? undefined,
    origin: params.origin ?? undefined,
    campaignKey: params.campaignKey ?? undefined,
    q: params.q ?? undefined,
    page: page !== undefined && !Number.isNaN(page) ? page : undefined,
  };
}

const DEFAULT_PAGE_SIZE = 25;

type LeadCsvRow = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  city: string;
  geoCity: string;
  geoRegion: string;
  rentalPeriod: string;
  equipmentName: string;
  items: string;
  origin: string;
  leadKind: string;
  status: string;
  message: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  gclid: string;
  referrer: string;
  landingPage: string;
  internalNotes: string;
};

type CsvColumn = {
  key: keyof LeadCsvRow;
  header: string;
};

const CSV_COLUMNS: CsvColumn[] = [
  { key: 'id', header: 'ID' },
  { key: 'createdAt', header: 'Data' },
  { key: 'name', header: 'Nome' },
  { key: 'email', header: 'E-mail' },
  { key: 'phone', header: 'Telefone' },
  { key: 'company', header: 'Empresa' },
  { key: 'city', header: 'Cidade' },
  { key: 'geoCity', header: 'Cidade (geo)' },
  { key: 'geoRegion', header: 'Estado (geo)' },
  { key: 'rentalPeriod', header: 'Período' },
  { key: 'equipmentName', header: 'Equipamento' },
  { key: 'items', header: 'Itens do carrinho' },
  { key: 'origin', header: 'Origem' },
  { key: 'leadKind', header: 'Tipo' },
  { key: 'status', header: 'Status' },
  { key: 'message', header: 'Mensagem' },
  { key: 'utmSource', header: 'UTM source' },
  { key: 'utmMedium', header: 'UTM medium' },
  { key: 'utmCampaign', header: 'UTM campaign' },
  { key: 'utmContent', header: 'UTM content' },
  { key: 'utmTerm', header: 'UTM term' },
  { key: 'gclid', header: 'gclid' },
  { key: 'referrer', header: 'Referrer' },
  { key: 'landingPage', header: 'Landing page' },
  { key: 'internalNotes', header: 'Notas internas' },
];

function buildWhere(filters: LeadListFilters) {
  const conditions = [];

  if (filters.status?.trim()) {
    conditions.push(eq(leadsSchema.status, filters.status.trim()));
  }
  if (filters.city?.trim()) {
    conditions.push(ilike(leadsSchema.city, `%${filters.city.trim()}%`));
  }
  if (filters.origin?.trim()) {
    conditions.push(ilike(leadsSchema.origin, `%${filters.origin.trim()}%`));
  }
  if (filters.campaignKey?.trim()) {
    const campaignKey = filters.campaignKey.trim();
    if (campaignKey === NO_CAMPAIGN_KEY) {
      conditions.push(
        or(isNull(leadsSchema.utmCampaign), eq(leadsSchema.utmCampaign, ''))!,
      );
    } else if (campaignKey === GOOGLE_ADS_NO_UTM_KEY) {
      conditions.push(
        and(
          or(isNull(leadsSchema.utmCampaign), eq(leadsSchema.utmCampaign, ''))!,
          sql`nullif(trim(${leadsSchema.gclid}), '') is not null`,
        )!,
      );
    } else {
      conditions.push(eq(leadsSchema.utmCampaign, campaignKey));
    }
  }
  if (filters.dateFrom?.trim()) {
    const dateFrom = filters.dateFrom.trim();
    if (/^\d{4}-\d{2}-\d{2}$/u.test(dateFrom)) {
      conditions.push(
        sql`(${leadsSchema.createdAt} at time zone ${APP_TIMEZONE})::date >= ${dateFrom}::date`,
      );
    }
  }
  if (filters.dateTo?.trim()) {
    const dateTo = filters.dateTo.trim();
    if (/^\d{4}-\d{2}-\d{2}$/u.test(dateTo)) {
      conditions.push(
        sql`(${leadsSchema.createdAt} at time zone ${APP_TIMEZONE})::date <= ${dateTo}::date`,
      );
    }
  }
  if (filters.q?.trim()) {
    const term = `%${filters.q.trim()}%`;
    conditions.push(
      or(
        ilike(leadsSchema.name, term),
        ilike(leadsSchema.email, term),
        ilike(leadsSchema.phone, term),
        ilike(leadsSchema.equipmentName, term),
        ilike(leadsSchema.company, term),
      ),
    );
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

function buildActivityDateWhere(dateFrom: string, dateTo: string) {
  const from = dateFrom.trim();
  const to = dateTo.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(from) || !/^\d{4}-\d{2}-\d{2}$/u.test(to)) {
    return undefined;
  }

  return and(
    sql`(${leadActivityOrder} at time zone ${APP_TIMEZONE})::date >= ${from}::date`,
    sql`(${leadActivityOrder} at time zone ${APP_TIMEZONE})::date <= ${to}::date`,
  );
}

function excludeArchivedWhere(extra?: ReturnType<typeof and>) {
  const notArchived = ne(leadsSchema.status, 'archived');
  return extra ? and(notArchived, extra) : notArchived;
}

function applyRecencyBoost(lead: LeadRecord) {
  const scored = scoreLeadIntent(lead);
  const activityAt = lead.lastActivityAt ?? lead.createdAt;
  const hours = (Date.now() - activityAt.getTime()) / 3_600_000;
  const bonus = hours <= 6 ? 3 : hours <= 24 ? 2 : hours <= 48 ? 1 : 0;
  const score = scored.score + bonus;

  if (score >= 8) {
    return { ...lead, score, tier: 'hot' as const };
  }
  if (score >= 5) {
    return { ...lead, score, tier: 'warm' as const };
  }
  return { ...lead, score, tier: 'cold' as const };
}

export type CommercialQueueResult = {
  leads: LeadWithIntent[];
  total: number;
  weekRange: ReturnType<typeof currentWeekRange>;
};

export type WeekOperationalLeadsResult = {
  leads: LeadRecord[];
  total: number;
  weekRange: ReturnType<typeof currentWeekRange>;
};

export type LeadWithIntent = LeadRecord & ReturnType<typeof scoreLeadIntent>;

/**
 * Returns new leads from the current week, sorted by commercial intent.
 */
export async function listCommercialQueue(limit = COMMERCIAL_QUEUE_MAX): Promise<CommercialQueueResult> {
  const weekRange = currentWeekRange();
  const activityWhere = buildActivityDateWhere(weekRange.dateFrom, weekRange.dateTo);
  const where = and(eq(leadsSchema.status, 'new'), activityWhere);

  const [rows, countRow] = await Promise.all([
    db
      .select()
      .from(leadsSchema)
      .where(where)
      .orderBy(desc(leadActivityOrder))
      .limit(Math.max(limit * 3, 40)),
    db.select({ count: count() }).from(leadsSchema).where(where),
  ]);

  const leads = rows
    .map((lead) => applyRecencyBoost(lead))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.lastActivityAt ?? b.createdAt).getTime() - (a.lastActivityAt ?? a.createdAt).getTime(),
    )
    .slice(0, limit);

  return {
    leads,
    total: countRow[0]?.count ?? 0,
    weekRange,
  };
}

/**
 * Lists all leads with activity in the current week for the operational view.
 */
export async function listWeekOperationalLeads(
  limit = WEEK_LEADS_DISPLAY_MAX,
): Promise<WeekOperationalLeadsResult> {
  const weekRange = currentWeekRange();
  const activityWhere = buildActivityDateWhere(weekRange.dateFrom, weekRange.dateTo);
  const where = excludeArchivedWhere(activityWhere);

  const [rows, countRow] = await Promise.all([
    db
      .select()
      .from(leadsSchema)
      .where(where)
      .orderBy(desc(leadActivityOrder))
      .limit(limit),
    db.select({ count: count() }).from(leadsSchema).where(where),
  ]);

  return {
    leads: rows,
    total: countRow[0]?.count ?? 0,
    weekRange,
  };
}

/**
 * Counts quote leads created this week that opened WhatsApp from the form.
 * Complements the click counter (which uses analytics_events).
 */
export async function countWeekWhatsAppOpenedLeads() {
  const weekRange = currentWeekRange();
  const [row] = await db
    .select({ count: count() })
    .from(leadsSchema)
    .where(
      and(
        eq(leadsSchema.whatsappOpened, true),
        ne(leadsSchema.status, 'archived'),
        sql`(${leadsSchema.createdAt} at time zone ${APP_TIMEZONE})::date >= ${weekRange.dateFrom}::date`,
        sql`(${leadsSchema.createdAt} at time zone ${APP_TIMEZONE})::date <= ${weekRange.dateTo}::date`,
      ),
    );

  return row?.count ?? 0;
}

/**
 * Lists leads for the admin panel with optional filters and pagination.
 *
 * @param filters - Date, status, city, origin, search and page options.
 * @returns Paginated lead rows and totals.
 */
export async function listLeads(filters: LeadListFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;
  const where = buildWhere(filters);

  const [rows, countRow] = await Promise.all([
    db
      .select()
      .from(leadsSchema)
      .where(where)
      .orderBy(desc(leadActivityOrder))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(leadsSchema)
      .where(where),
  ]);

  const total = countRow[0]?.count ?? 0;

  return {
    leads: rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Fetches a single lead by id.
 *
 * @param id - Lead primary key.
 * @returns The lead row when found.
 */
export async function getLeadById(id: number) {
  const [lead] = await db.select().from(leadsSchema).where(eq(leadsSchema.id, id)).limit(1);
  return lead;
}

/**
 * Lists other leads that share email or phone with the reference row.
 */
export async function listRelatedLeads(reference: LeadRecord) {
  const email = normalizeLeadEmail(reference.email);
  const phoneDigits = normalizeLeadPhone(reference.phone);
  const matchConditions = [eq(leadsSchema.email, email)];

  if (phoneDigits) {
    matchConditions.push(sql`regexp_replace(${leadsSchema.phone}, '\\D', '', 'g') = ${phoneDigits}`);
  }

  const rows = await db
    .select()
    .from(leadsSchema)
    .where(or(...matchConditions))
    .orderBy(desc(leadActivityOrder));

  return sortRelatedLeads(rows);
}

/**
 * Maps lead id → count of rows for the same contact (email or phone).
 */
export async function buildContactOrderCounts(leads: LeadRecord[]) {
  const counts = new Map<number, number>();
  if (leads.length === 0) {
    return counts;
  }

  const emails = [...new Set(leads.map((row) => normalizeLeadEmail(row.email)))];
  const phones = [
    ...new Set(
      leads.map((row) => normalizeLeadPhone(row.phone)).filter((value): value is string => Boolean(value)),
    ),
  ];

  const matchConditions = [inArray(leadsSchema.email, emails)];
  if (phones.length > 0) {
    matchConditions.push(
      sql`regexp_replace(${leadsSchema.phone}, '\\D', '', 'g') in (${sql.join(
        phones.map((phone) => sql`${phone}`),
        sql`, `,
      )})`,
    );
  }

  const pool = await db
    .select()
    .from(leadsSchema)
    .where(or(...matchConditions));

  for (const lead of leads) {
    counts.set(lead.id, countContactOrders(lead, pool));
  }

  return counts;
}

/**
 * Updates lead status by id.
 *
 * @param id - Lead primary key.
 * @param status - New status value.
 * @returns Updated lead row when found.
 */
export async function updateLeadStatus(id: number, status: LeadStatus) {
  const now = new Date();
  const [lead] = await db
    .update(leadsSchema)
    .set({ status, lastActivityAt: now })
    .where(eq(leadsSchema.id, id))
    .returning();

  return lead;
}

/**
 * Updates internal notes for a lead.
 *
 * @param id - Lead primary key.
 * @param internalNotes - Team-only notes (empty string clears).
 * @returns Updated lead row when found.
 */
export async function updateLeadInternalNotes(id: number, internalNotes: string) {
  const now = new Date();
  const [lead] = await db
    .update(leadsSchema)
    .set({
      internalNotes: internalNotes.trim() || null,
      lastActivityAt: now,
    })
    .where(eq(leadsSchema.id, id))
    .returning();

  return lead;
}

function escapeCsvCell(value: string) {
  if (/[",\n\r]/u.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function leadToCsvRow(lead: LeadRecord): LeadCsvRow {
  return {
    id: String(lead.id),
    createdAt: formatDateTimeBrasiliaExport(lead.createdAt),
    name: lead.name,
    email: lead.email,
    phone: lead.phone ?? '',
    company: lead.company ?? '',
    city: lead.city ?? '',
    geoCity: lead.geoCity ?? '',
    geoRegion: lead.geoRegion ?? '',
    rentalPeriod: lead.rentalPeriod ?? '',
    equipmentName: lead.equipmentName ?? '',
    items: formatLeadCartItems(lead.itemsJson),
    origin: lead.origin,
    leadKind: lead.leadKind,
    status: lead.status,
    message: lead.message ?? '',
    utmSource: lead.utmSource ?? '',
    utmMedium: lead.utmMedium ?? '',
    utmCampaign: lead.utmCampaign ?? '',
    utmContent: lead.utmContent ?? '',
    utmTerm: lead.utmTerm ?? '',
    gclid: lead.gclid ?? '',
    referrer: lead.referrer ?? '',
    landingPage: lead.landingPage ?? '',
    internalNotes: lead.internalNotes ?? '',
  };
}

/**
 * Builds UTF-8 CSV with BOM for Excel.
 *
 * @param leads - Lead rows to serialize.
 * @returns CSV string with header row.
 */
export function buildLeadsCsv(leads: LeadRecord[]) {
  const header = CSV_COLUMNS.map((col) => escapeCsvCell(col.header)).join(',');
  const rows = leads.map((lead) => {
    const row = leadToCsvRow(lead);
    return CSV_COLUMNS.map((col) => escapeCsvCell(row[col.key] ?? '')).join(',');
  });
  return `\uFEFF${[header, ...rows].join('\r\n')}`;
}

/**
 * Loads all leads matching filters for export (capped).
 *
 * @param filters - Same filters as the list view.
 * @param maxRows - Maximum rows returned.
 * @returns Lead rows ordered by newest first.
 */
export async function listLeadsForExport(filters: LeadListFilters, maxRows = 5000) {
  const where = buildWhere(filters);
  return await db
    .select()
    .from(leadsSchema)
    .where(where)
    .orderBy(desc(leadsSchema.createdAt))
    .limit(maxRows);
}

export { buildLeadsFilterQuery } from '@/lib/leads-filter-query';
