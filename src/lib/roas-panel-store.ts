import 'server-only';

import { and, count, eq, gte, lte, or, sql } from 'drizzle-orm';
import { brasiliaDayEndUtc, brasiliaDayStartUtc, formatDateTimeBrasilia } from '@/lib/app-datetime';
import { fetchGoogleAdsDailySpend, isGoogleAdsApiConfigured } from '@/lib/google-ads-spend';
import { emptyOrigin, fillOriginRows, listBrasiliaDates, roasRatio } from '@/lib/roas-panel';
import type { RoasDay, RoasOrigin, RoasOriginChannel } from '@/lib/roas-panel';
import { db } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { closedProposalsSchema, roasSpendDaysSchema } from '@/models/Schema';

export type RoasPanel = {
  days: RoasDay[];
  origins: RoasOrigin[];
  proposals: number;
  proposalBrl: number;
  closedBrl: number;
  spendBrl: number | null;
  roas: number | null;
  ltvProposals: number;
  ltvClosedBrl: number;
  ltvDays: { date: string; proposals: number; closedBrl: number }[];
  segments: {
    plataformas: number;
    guindastes: number;
    andaimes: number;
    ferramentas: number;
    pendingBrl: number;
  };
  sellers: { name: string; proposals: number; closedBrl: number; freightBrl: number }[];
  freightProposals: {
    numero: string;
    seller: string | null;
    closedBrl: number;
    freightBrl: number;
    proposalBrl: number;
  }[];
  unassignedProposals: number;
  unassignedBrl: number;
  updatedAt: string | null;
  schemaReady: boolean;
};

const emptySegments = {
  plataformas: 0,
  guindastes: 0,
  andaimes: 0,
  ferramentas: 0,
  pendingBrl: 0,
};

function money(value: string | number | null | undefined) {
  const amount = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

/** Platform-only deals credit rental (segment), not outsourced frete in valorTotal. */
const platformOnlySql = sql`${closedProposalsSchema.segmentPlataformas} is not null
  and coalesce(${closedProposalsSchema.segmentPlataformas}, 0) > 0
  and coalesce(${closedProposalsSchema.segmentGuindastes}, 0) = 0
  and coalesce(${closedProposalsSchema.segmentAndaimes}, 0) = 0
  and coalesce(${closedProposalsSchema.segmentFerramentas}, 0) = 0`;

const sellerCreditSql = sql`case
  when ${platformOnlySql}
  then ${closedProposalsSchema.segmentPlataformas}
  else ${closedProposalsSchema.valorTotal}
end`;

const sellerFreightSql = sql`case
  when ${platformOnlySql}
  then greatest(${closedProposalsSchema.valorTotal} - ${closedProposalsSchema.segmentPlataformas}, 0)
  else 0
end`;

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
 * @param channel Origin shown in the cards, the days, and the origin row.
 * @returns Daily rows and the period totals.
 */
export async function loadRoasPanel(
  range: { dateFrom: string; dateTo: string },
  channel: RoasOriginChannel = 'paid',
): Promise<RoasPanel> {
  const fromUtc = brasiliaDayStartUtc(range.dateFrom);
  const toUtc = brasiliaDayEndUtc(range.dateTo);
  const dayExpr = sql<string>`to_char((coalesce(${closedProposalsSchema.proposalCreatedAt}, ${closedProposalsSchema.approvedAt}) at time zone 'utc') at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`;

  let closedRows: { day: string; proposals: number; proposalValor: string; valor: string }[] = [];
  let proposalNumberRows: { day: string; numero: string; valor: string; closed: boolean }[] = [];
  let originRows: { channel: string | null; dealKind: string | null; proposals: number; proposalValor: string; closed: number; valor: string }[] = [];
  let spendRows: { spendDate: string; spendBrl: string; fetchedAt: Date }[] = [];
  let ltvRows: { day: string; proposals: number; valor: string }[] = [];
  let segmentRow: {
    plataformas: string;
    guindastes: string;
    andaimes: string;
    ferramentas: string;
    pending: string;
  } | undefined;
  let sellerRows: { seller: string | null; proposals: number; valor: string; frete: string }[] = [];
  let freightProposalRows: {
    numero: string;
    seller: string | null;
    proposalBrl: string;
    closedBrl: string;
    freightBrl: string;
  }[] = [];
  let paidContractClosed = '0';
  try {
    closedRows = await db
      .select({
        day: dayExpr,
        proposals: sql<number>`count(*) filter (where ${closedProposalsSchema.closed})`,
        proposalValor: sql<string>`coalesce(sum(${sellerCreditSql}), 0)`,
        valor: sql<string>`coalesce(sum(${sellerCreditSql}) filter (where ${closedProposalsSchema.closed}), 0)`,
      })
      .from(closedProposalsSchema)
      .where(
        and(
          eq(closedProposalsSchema.traffic, true),
          eq(closedProposalsSchema.channel, channel),
          eq(closedProposalsSchema.dealKind, 'contract'),
          gte(sql`coalesce(${closedProposalsSchema.proposalCreatedAt}, ${closedProposalsSchema.approvedAt})`, fromUtc),
          lte(sql`coalesce(${closedProposalsSchema.proposalCreatedAt}, ${closedProposalsSchema.approvedAt})`, toUtc),
        ),
      )
      .groupBy(dayExpr);
    proposalNumberRows = await db
      .select({
        day: dayExpr,
        numero: closedProposalsSchema.numero,
        valor: sql<string>`${sellerCreditSql}`,
        closed: closedProposalsSchema.closed,
      })
      .from(closedProposalsSchema)
      .where(
        and(
          eq(closedProposalsSchema.traffic, true),
          eq(closedProposalsSchema.channel, channel),
          eq(closedProposalsSchema.dealKind, 'contract'),
          gte(sql`coalesce(${closedProposalsSchema.proposalCreatedAt}, ${closedProposalsSchema.approvedAt})`, fromUtc),
          lte(sql`coalesce(${closedProposalsSchema.proposalCreatedAt}, ${closedProposalsSchema.approvedAt})`, toUtc),
        ),
      )
      .orderBy(closedProposalsSchema.numero);
    originRows = await db
      .select({
        channel: closedProposalsSchema.channel,
        dealKind: closedProposalsSchema.dealKind,
        proposals: count(),
        proposalValor: sql<string>`coalesce(sum(${sellerCreditSql}), 0)`,
        closed: sql<number>`count(*) filter (where ${closedProposalsSchema.closed})`,
        valor: sql<string>`coalesce(sum(${sellerCreditSql}) filter (where ${closedProposalsSchema.closed}), 0)`,
      })
      .from(closedProposalsSchema)
      .where(and(
        eq(closedProposalsSchema.traffic, true),
        or(
          and(
            eq(closedProposalsSchema.dealKind, 'ltv'),
            gte(closedProposalsSchema.approvedAt, fromUtc),
            lte(closedProposalsSchema.approvedAt, toUtc),
          ),
          and(
            sql`${closedProposalsSchema.dealKind} is distinct from 'ltv'`,
            gte(sql`coalesce(${closedProposalsSchema.proposalCreatedAt}, ${closedProposalsSchema.approvedAt})`, fromUtc),
            lte(sql`coalesce(${closedProposalsSchema.proposalCreatedAt}, ${closedProposalsSchema.approvedAt})`, toUtc),
          ),
        ),
      ))
      .groupBy(closedProposalsSchema.channel, closedProposalsSchema.dealKind);
    spendRows = await db
      .select({
        spendDate: roasSpendDaysSchema.spendDate,
        spendBrl: roasSpendDaysSchema.spendBrl,
        fetchedAt: roasSpendDaysSchema.fetchedAt,
      })
      .from(roasSpendDaysSchema)
      .where(and(gte(roasSpendDaysSchema.spendDate, range.dateFrom), lte(roasSpendDaysSchema.spendDate, range.dateTo)));
    const approvedDay = sql<string>`to_char((${closedProposalsSchema.approvedAt} at time zone 'utc') at time zone 'America/Sao_Paulo', 'YYYY-MM-DD')`;
    ltvRows = await db
      .select({
        day: approvedDay,
        proposals: count(),
        valor: sql<string>`coalesce(sum(${sellerCreditSql}), 0)`,
      })
      .from(closedProposalsSchema)
      .where(and(
        eq(closedProposalsSchema.traffic, true),
        eq(closedProposalsSchema.closed, true),
        eq(closedProposalsSchema.channel, channel),
        gte(closedProposalsSchema.approvedAt, fromUtc),
        lte(closedProposalsSchema.approvedAt, toUtc),
      ))
      .groupBy(approvedDay);
    const [segments] = await db
      .select({
        plataformas: sql<string>`coalesce(sum(${closedProposalsSchema.segmentPlataformas}), 0)`,
        guindastes: sql<string>`coalesce(sum(${closedProposalsSchema.segmentGuindastes}), 0)`,
        andaimes: sql<string>`coalesce(sum(${closedProposalsSchema.segmentAndaimes}), 0)`,
        ferramentas: sql<string>`coalesce(sum(${closedProposalsSchema.segmentFerramentas}), 0)`,
        pending: sql<string>`coalesce(sum(case
          when ${platformOnlySql} then 0
          when ${closedProposalsSchema.segmentPlataformas} is null then ${closedProposalsSchema.valorTotal}
          else greatest(${closedProposalsSchema.valorTotal} - coalesce(${closedProposalsSchema.segmentPlataformas}, 0) - coalesce(${closedProposalsSchema.segmentGuindastes}, 0) - coalesce(${closedProposalsSchema.segmentAndaimes}, 0) - coalesce(${closedProposalsSchema.segmentFerramentas}, 0), 0)
        end), 0)`,
      })
      .from(closedProposalsSchema)
      .where(and(
        eq(closedProposalsSchema.traffic, true),
        eq(closedProposalsSchema.closed, true),
        eq(closedProposalsSchema.channel, channel),
        gte(closedProposalsSchema.approvedAt, fromUtc),
        lte(closedProposalsSchema.approvedAt, toUtc),
      ));
    segmentRow = segments;
    sellerRows = await db
      .select({
        seller: closedProposalsSchema.seller,
        proposals: count(),
        valor: sql<string>`coalesce(sum(${sellerCreditSql}), 0)`,
        frete: sql<string>`coalesce(sum(${sellerFreightSql}), 0)`,
      })
      .from(closedProposalsSchema)
      .where(and(
        eq(closedProposalsSchema.traffic, true),
        eq(closedProposalsSchema.closed, true),
        eq(closedProposalsSchema.channel, channel),
        gte(closedProposalsSchema.approvedAt, fromUtc),
        lte(closedProposalsSchema.approvedAt, toUtc),
      ))
      .groupBy(closedProposalsSchema.seller);
    freightProposalRows = await db
      .select({
        numero: closedProposalsSchema.numero,
        seller: closedProposalsSchema.seller,
        proposalBrl: sql<string>`${closedProposalsSchema.valorTotal}`,
        closedBrl: sql<string>`${sellerCreditSql}`,
        freightBrl: sql<string>`${sellerFreightSql}`,
      })
      .from(closedProposalsSchema)
      .where(and(
        eq(closedProposalsSchema.traffic, true),
        eq(closedProposalsSchema.closed, true),
        eq(closedProposalsSchema.channel, channel),
        gte(closedProposalsSchema.approvedAt, fromUtc),
        lte(closedProposalsSchema.approvedAt, toUtc),
        sql`${sellerFreightSql} > 0`,
      ))
      .orderBy(sql`${sellerFreightSql} desc`, closedProposalsSchema.numero);
    if (channel !== 'paid') {
      const [paidClosed] = await db
        .select({
          valor: sql<string>`coalesce(sum(${sellerCreditSql}) filter (where ${closedProposalsSchema.closed}), 0)`,
        })
        .from(closedProposalsSchema)
        .where(and(
          eq(closedProposalsSchema.traffic, true),
          eq(closedProposalsSchema.channel, 'paid'),
          eq(closedProposalsSchema.dealKind, 'contract'),
          gte(sql`coalesce(${closedProposalsSchema.proposalCreatedAt}, ${closedProposalsSchema.approvedAt})`, fromUtc),
          lte(sql`coalesce(${closedProposalsSchema.proposalCreatedAt}, ${closedProposalsSchema.approvedAt})`, toUtc),
        ));
      paidContractClosed = paidClosed?.valor ?? '0';
    }
  } catch (error) {
    logger.warn('ROAS panel schema is not ready', {
      message: error instanceof Error ? error.message : 'query_failed',
    });
    return {
      days: [],
      origins: fillOriginRows([]),
      proposals: 0,
      proposalBrl: 0,
      closedBrl: 0,
      spendBrl: null,
      roas: null,
      ltvProposals: 0,
      ltvClosedBrl: 0,
      ltvDays: [],
      segments: emptySegments,
      sellers: [],
      freightProposals: [],
      unassignedProposals: 0,
      unassignedBrl: 0,
      updatedAt: null,
      schemaReady: false,
    };
  }

  const dates = listBrasiliaDates(range.dateFrom, range.dateTo);
  const missingSpend = dates.some((date) => !spendRows.some((row) => row.spendDate === date));
  if (missingSpend && isGoogleAdsApiConfigured()) {
    try {
      const spendDates = new Set(spendRows.map((row) => row.spendDate));
      for (let index = 0; index < dates.length; index += 31) {
        const slice = dates.slice(index, index + 31);
        const start = slice.at(0);
        const end = slice.at(-1);
        if (!start || !end) {
          continue;
        }
        let needsSpend = false;
        for (const date of slice) {
          if (!spendDates.has(date)) {
            needsSpend = true;
            break;
          }
        }
        if (!needsSpend) {
          continue;
        }
        await syncRoasSpend(start, end);
      }
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
  const proposalsByDay = new Map<string, { numero: string; valor: number; closed: boolean }[]>();
  for (const row of proposalNumberRows) {
    const list = proposalsByDay.get(row.day) ?? [];
    list.push({ numero: row.numero, valor: money(row.valor), closed: row.closed });
    proposalsByDay.set(row.day, list);
  }
  const days = dates.map((date) => {
    const closed = closedByDay.get(date);
    const spend = spendByDay.get(date);
    return {
      date,
      proposals: Number(closed?.proposals ?? 0),
      proposalBrl: money(closed?.proposalValor),
      closedBrl: money(closed?.valor),
      spendBrl: spend ? money(spend.spendBrl) : null,
      proposalsDetail: proposalsByDay.get(date) ?? [],
    };
  });
  const proposals = days.reduce((sum, day) => sum + day.proposals, 0);
  const proposalBrl = Number(days.reduce((sum, day) => sum + day.proposalBrl, 0).toFixed(2));
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

  const ltvDays = ltvRows
    .map((row) => ({
      date: row.day,
      proposals: Number(row.proposals ?? 0),
      closedBrl: money(row.valor),
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
  const ltvProposals = ltvDays.reduce((sum, day) => sum + day.proposals, 0);
  const ltvClosedBrl = Number(ltvDays.reduce((sum, day) => sum + day.closedBrl, 0).toFixed(2));

  return {
    days,
    origins: fillOriginRows([...originRows.reduce((grouped, row) => {
      if (row.channel !== 'paid' && row.channel !== 'organic' && row.channel !== 'direct' && row.channel !== 'referral') {
        return grouped;
      }
      const current = grouped.get(row.channel) ?? emptyOrigin(row.channel);
      if (row.dealKind === 'contract') {
        current.contracts = Number(row.proposals ?? 0);
        current.contractBrl = money(row.proposalValor);
        current.contractClosed = Number(row.closed ?? 0);
        current.contractClosedBrl = money(row.valor);
      }
      if (row.dealKind === 'ltv') {
        current.ltvCount = Number(row.proposals ?? 0);
        current.ltvBrl = money(row.proposalValor);
        current.ltvClosed = Number(row.closed ?? 0);
        current.ltvClosedBrl = money(row.valor);
      }
      grouped.set(row.channel, current);
      return grouped;
    }, new Map()).values()]),
    proposals,
    proposalBrl,
    closedBrl,
    spendBrl,
    roas: roasRatio(channel === 'paid' ? closedBrl : money(paidContractClosed), spendBrl),
    ltvProposals,
    ltvClosedBrl,
    ltvDays,
    segments: {
      plataformas: money(segmentRow?.plataformas),
      guindastes: money(segmentRow?.guindastes),
      andaimes: money(segmentRow?.andaimes),
      ferramentas: money(segmentRow?.ferramentas),
      pendingBrl: money(segmentRow?.pending),
    },
    sellers: sellerRows.flatMap((row) => {
      if (!row.seller) {
        return [];
      }
      return [{
        name: row.seller,
        proposals: Number(row.proposals ?? 0),
        closedBrl: money(row.valor),
        freightBrl: money(row.frete),
      }];
    }),
    freightProposals: freightProposalRows.map((row) => ({
      numero: row.numero,
      seller: row.seller,
      closedBrl: money(row.closedBrl),
      freightBrl: money(row.freightBrl),
      proposalBrl: money(row.proposalBrl),
    })),
    unassignedProposals: sellerRows.filter((row) => !row.seller).reduce((sum, row) => sum + Number(row.proposals ?? 0), 0),
    unassignedBrl: sellerRows.filter((row) => !row.seller).reduce((sum, row) => sum + money(row.valor), 0),
    updatedAt: latest ? formatDateTimeBrasilia(latest) : null,
    schemaReady: true,
  };
}
