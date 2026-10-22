import 'server-only';

import { and, count, eq, gte, lte, sql } from 'drizzle-orm';
import { brasiliaDayEndUtc, brasiliaDayStartUtc, formatDateTimeBrasilia } from '@/lib/app-datetime';
import { fetchGoogleAdsDailySpend, isGoogleAdsApiConfigured } from '@/lib/google-ads-spend';
import { listBrasiliaDates, roasRatio } from '@/lib/roas-panel';
import type { RoasDay } from '@/lib/roas-panel';
import { db } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { closedProposalsSchema, roasSpendDaysSchema } from '@/models/Schema';

export type RoasPanel = {
  days: RoasDay[];
  proposals: number;
  closedBrl: number;
  spendBrl: number | null;
  roas: number | null;
  updatedAt: string | null;
  schemaReady: boolean;
};

function money(value: string | number | null | undefined) {
  const amount = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

/**
 * Stores Google Ads spend for each day in the range.
 * @param dateFrom Inclusive YYYY-MM-DD start.
 * @param dateTo Inclusive YYYY-MM-DD end.
 * @returns How many days were saved.
 */
export async function syncRoasSpend(dateFrom: string, dateTo: string) {
  const rows = await fetchGoogleAdsDailySpend({ dateFrom, dateTo });
  const byDate = new Map(rows.map((row) => [row.date, row.spendBrl]));
  const fetchedAt = new Date();
  for (const date of listBrasiliaDates(dateFrom, dateTo)) {
    const spendBrl = (byDate.get(date) ?? 0).toFixed(2);
    await db
      .insert(roasSpendDaysSchema)
      .values({
        spendDate: date,
        spendBrl,
        fetchedAt,
      })
      .onConflictDoUpdate({
        target: roasSpendDaysSchema.spendDate,
        set: {
          spendBrl,
          fetchedAt,
        },
      });
  }
  return listBrasiliaDates(dateFrom, dateTo).length;
}

/**
 * Loads closed traffic value and stored spend for the panel range.
 * @param range Inclusive Brasília dates.
 * @returns Daily rows and the period totals.
 */
export async function loadRoasPanel(range: { dateFrom: string; dateTo: string }): Promise<RoasPanel> {
  const fromUtc = brasiliaDayStartUtc(range.dateFrom);
  const toUtc = brasiliaDayEndUtc(range.dateTo);
  const dayExpr = sql<string>`to_char((${closedProposalsSchema.approvedAt} at time zone 'utc') at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`;

  let closedRows: { day: string; proposals: number; valor: string }[] = [];
  let spendRows: { spendDate: string; spendBrl: string; fetchedAt: Date }[] = [];
  try {
    closedRows = await db
      .select({
        day: dayExpr,
        proposals: count(),
        valor: sql<string>`coalesce(sum(${closedProposalsSchema.valorTotal}), 0)`,
      })
      .from(closedProposalsSchema)
      .where(
        and(
          eq(closedProposalsSchema.traffic, true),
          gte(closedProposalsSchema.approvedAt, fromUtc),
          lte(closedProposalsSchema.approvedAt, toUtc),
        ),
      )
      .groupBy(dayExpr);
    spendRows = await db
      .select({
        spendDate: roasSpendDaysSchema.spendDate,
        spendBrl: roasSpendDaysSchema.spendBrl,
        fetchedAt: roasSpendDaysSchema.fetchedAt,
      })
      .from(roasSpendDaysSchema)
      .where(and(gte(roasSpendDaysSchema.spendDate, range.dateFrom), lte(roasSpendDaysSchema.spendDate, range.dateTo)));
  } catch (error) {
    logger.warn('ROAS panel schema is not ready', {
      message: error instanceof Error ? error.message : 'query_failed',
    });
    return {
      days: [],
      proposals: 0,
      closedBrl: 0,
      spendBrl: null,
      roas: null,
      updatedAt: null,
      schemaReady: false,
    };
  }

  const dates = listBrasiliaDates(range.dateFrom, range.dateTo);
  const missingSpend = dates.some((date) => !spendRows.some((row) => row.spendDate === date));
  if (missingSpend && isGoogleAdsApiConfigured() && dates.length <= 31) {
    try {
      await syncRoasSpend(range.dateFrom, range.dateTo);
      spendRows = await db
        .select({
          spendDate: roasSpendDaysSchema.spendDate,
          spendBrl: roasSpendDaysSchema.spendBrl,
          fetchedAt: roasSpendDaysSchema.fetchedAt,
        })
        .from(roasSpendDaysSchema)
        .where(and(gte(roasSpendDaysSchema.spendDate, range.dateFrom), lte(roasSpendDaysSchema.spendDate, range.dateTo)));
    } catch (error) {
      logger.warn('ROAS spend refresh failed', {
        message: error instanceof Error ? error.message : 'spend_failed',
      });
    }
  }

  const closedByDay = new Map(closedRows.map((row) => [row.day, row]));
  const spendByDay = new Map(spendRows.map((row) => [row.spendDate, row]));
  const days = dates.map((date) => {
    const closed = closedByDay.get(date);
    const spend = spendByDay.get(date);
    return {
      date,
      proposals: Number(closed?.proposals ?? 0),
      closedBrl: money(closed?.valor),
      spendBrl: spend ? money(spend.spendBrl) : null,
    };
  });
  const proposals = days.reduce((sum, day) => sum + day.proposals, 0);
  const closedBrl = Number(days.reduce((sum, day) => sum + day.closedBrl, 0).toFixed(2));
  const knownSpend = days.filter((day) => day.spendBrl !== null);
  const spendBrl = knownSpend.length === 0
    ? null
    : Number(knownSpend.reduce((sum, day) => sum + (day.spendBrl ?? 0), 0).toFixed(2));
  const latest = spendRows.reduce<Date | null>((current, row) => {
    if (!current || row.fetchedAt > current) {
      return row.fetchedAt;
    }
    return current;
  }, null);

  return {
    days,
    proposals,
    closedBrl,
    spendBrl,
    roas: roasRatio(closedBrl, spendBrl),
    updatedAt: latest ? formatDateTimeBrasilia(latest) : null,
    schemaReady: true,
  };
}
