import 'server-only';

import { and, count, eq, ne, sql } from 'drizzle-orm';
import { commercialSeller } from '@/lib/commercial-seller';
import { subscriberKey } from '@/lib/lead-contact';
import type { ClosedProposalAttendance } from '@/lib/closed-proposal';
import { isAugustBulkImport, matchProposalToPaidClick, uniquePaidClicks } from '@/lib/paid-click-proposal';
import type { PaidClickSource } from '@/lib/paid-click-proposal';
import { db } from '@/libs/DB';
import { closedProposalsSchema, leadsSchema, whatsappAttributionTokensSchema } from '@/models/Schema';

export type ProposalChannel = 'paid' | 'organic' | 'direct' | 'referral';

export type ProposalSegments = {
  plataformas: number;
  guindastes: number;
  andaimes: number;
  ferramentas: number;
};

export type RecordClosedProposalInput = {
  proposalId: string;
  numero: string;
  createdAt: Date | null;
  approvedAt: Date | null;
  closed: boolean;
  valorTotal: number;
  companyName: string;
  phones: string[];
  contactNames: string[];
  attendance: ClosedProposalAttendance[];
  channel: ProposalChannel | null;
  segments?: ProposalSegments | null;
  seller?: string | null;
};

export type ClosedProposalRecord = {
  match: 'phone' | 'ai' | 'none';
  leadId: number | null;
  traffic: boolean;
};

function matchKindOf(value: string): ClosedProposalRecord['match'] {
  if (value === 'phone' || value === 'ai' || value === 'none') {
    return value;
  }
  return 'none';
}

function earliestPaidAttendance(attendance: ClosedProposalAttendance[], proposalPhones: string[]) {
  const proposalKeys = new Set(proposalPhones.flatMap((phone) => {
    const key = subscriberKey(phone);
    return key ? [key] : [];
  }));
  const matches = attendance.flatMap((entry) => {
    const key = subscriberKey(entry.phoneKey);
    if (!entry.phoneMatched || entry.channel !== 'paid' || !entry.paidAt || !key || !proposalKeys.has(key)) {
      return [];
    }
    const moment = new Date(entry.paidAt);
    if (Number.isNaN(moment.getTime())) {
      return [];
    }
    return [{ key, full: entry.phoneKey.replace(/\D/g, ''), moment }];
  });
  const people = new Map<string, Set<string>>();
  for (const match of matches) {
    const seen = people.get(match.key) ?? new Set<string>();
    seen.add(match.full);
    people.set(match.key, seen);
  }
  const moments = matches.flatMap((match) => (people.get(match.key)?.size === 1 ? [match.moment] : []));
  return moments.reduce<Date | null>((earliest, moment) => {
    if (!earliest || moment < earliest) {
      return moment;
    }
    return earliest;
  }, null);
}

function toRecord(row: { matchKind: string; leadId: number | null; traffic: boolean }): ClosedProposalRecord {
  return {
    match: matchKindOf(row.matchKind),
    leadId: row.leadId,
    traffic: row.traffic,
  };
}

function clickSource(row: {
  identity: string;
  phone: string | null;
  clickedAt: Date;
  leadId: number | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  utmMedium: string | null;
}): PaidClickSource {
  return {
    identity: row.identity,
    phone: row.phone,
    clickedAt: row.clickedAt,
    leadId: row.leadId,
    attribution: {
      gclid: row.gclid ?? undefined,
      gbraid: row.gbraid ?? undefined,
      wbraid: row.wbraid ?? undefined,
      utmMedium: row.utmMedium ?? undefined,
    },
  };
}

async function loadPaidClicks() {
  const leads = await db
    .select({
      id: leadsSchema.id,
      phone: leadsSchema.phone,
      clickedAt: leadsSchema.createdAt,
      gclid: leadsSchema.gclid,
      gbraid: leadsSchema.gbraid,
      wbraid: leadsSchema.wbraid,
      utmMedium: leadsSchema.utmMedium,
    })
    .from(leadsSchema);
  const tokens = await db
    .select({
      id: whatsappAttributionTokensSchema.id,
      leadId: whatsappAttributionTokensSchema.leadId,
      phone: whatsappAttributionTokensSchema.phoneKey,
      clickedAt: whatsappAttributionTokensSchema.createdAt,
      gclid: whatsappAttributionTokensSchema.gclid,
      gbraid: whatsappAttributionTokensSchema.gbraid,
      wbraid: whatsappAttributionTokensSchema.wbraid,
      utmMedium: whatsappAttributionTokensSchema.utmMedium,
    })
    .from(whatsappAttributionTokensSchema);

  return uniquePaidClicks([
    ...leads.map((row) =>
      clickSource({
        identity: `lead:${row.id}`,
        phone: row.phone,
        clickedAt: row.clickedAt,
        leadId: row.id,
        gclid: row.gclid,
        gbraid: row.gbraid,
        wbraid: row.wbraid,
        utmMedium: row.utmMedium,
      }),
    ),
    ...tokens.map((row) =>
      clickSource({
        identity: row.leadId === null ? `token:${row.id}` : `lead:${row.leadId}`,
        phone: row.phone,
        clickedAt: row.clickedAt,
        leadId: row.leadId,
        gclid: row.gclid,
        gbraid: row.gbraid,
        wbraid: row.wbraid,
        utmMedium: row.utmMedium,
      }),
    ),
  ]);
}

/**
 * Upserts a proposal and marks traffic from the contact phone or from the conversation channel.
 * The earliest proposal after the click stays the contract. Later ones become recorrência.
 * @param input Proposal fields and the contact phones used for matching.
 * @returns The stored match.
 * @throws When the upsert does not return a row.
 */
export async function recordClosedProposal(input: RecordClosedProposalInput): Promise<ClosedProposalRecord> {
  const imported = input.createdAt ? isAugustBulkImport(input.createdAt, input.numero) : false;
  const matched = imported
    ? { traffic: false as const, leadId: null }
    : matchProposalToPaidClick({
      createdAt: input.createdAt,
      numero: input.numero,
      phones: input.phones,
      clicks: await loadPaidClicks(),
    });
  const [existing] = await db
    .select({
      leadId: closedProposalsSchema.leadId,
      traffic: closedProposalsSchema.traffic,
      channel: closedProposalsSchema.channel,
      closed: closedProposalsSchema.closed,
      matchKind: closedProposalsSchema.matchKind,
      dealKind: closedProposalsSchema.dealKind,
      proposalCreatedAt: closedProposalsSchema.proposalCreatedAt,
      approvedAt: closedProposalsSchema.approvedAt,
    })
    .from(closedProposalsSchema)
    .where(eq(closedProposalsSchema.proposalId, input.proposalId))
    .limit(1);
  const proposalCreatedAt = input.createdAt ?? existing?.proposalCreatedAt ?? null;
  const paidSince = imported ? null : earliestPaidAttendance(input.attendance, input.phones);
  const attendancePaid = Boolean(paidSince && proposalCreatedAt && proposalCreatedAt >= paidSince);
  let channel: ProposalChannel | null = null;
  if (!imported && (matched.traffic || attendancePaid)) {
    channel = 'paid';
  } else if (!imported && input.channel && input.channel !== 'paid') {
    channel = input.channel;
  }
  const alreadyPaid = existing?.traffic === true && existing.channel === 'paid';
  if (alreadyPaid && channel !== 'paid') {
    channel = 'paid';
  }
  const traffic = channel !== null;
  const match = matched.traffic || attendancePaid ? 'phone' : alreadyPaid ? matchKindOf(existing.matchKind) : 'none';
  const leadId = matched.leadId ?? (alreadyPaid ? existing.leadId : null);
  const approvedAt = input.approvedAt ?? existing?.approvedAt ?? null;
  const closed = input.closed || existing?.closed === true;
  let dealKind: 'contract' | 'ltv' | null = traffic ? 'contract' : null;
  if (traffic && leadId !== null) {
    const siblings = await db
      .select({
        createdAt: closedProposalsSchema.proposalCreatedAt,
      })
      .from(closedProposalsSchema)
      .where(and(
        eq(closedProposalsSchema.leadId, leadId),
        eq(closedProposalsSchema.traffic, true),
        ne(closedProposalsSchema.proposalId, input.proposalId),
      ));
    const created = proposalCreatedAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const hasEarlier = siblings.some((row) => (row.createdAt?.getTime() ?? Number.POSITIVE_INFINITY) < created);
    if (hasEarlier) {
      dealKind = 'ltv';
    }
  } else if (alreadyPaid && (existing?.dealKind === 'contract' || existing?.dealKind === 'ltv')) {
    dealKind = existing.dealKind;
  }
  const valorTotal = input.valorTotal.toFixed(2);
  const segmentValues = input.segments
    ? {
        segmentPlataformas: input.segments.plataformas.toFixed(2),
        segmentGuindastes: input.segments.guindastes.toFixed(2),
        segmentAndaimes: input.segments.andaimes.toFixed(2),
        segmentFerramentas: input.segments.ferramentas.toFixed(2),
      }
    : {};
  const seller = commercialSeller(input.seller);
  const sellerValues = seller ? { seller } : {};
  const [saved] = await db
    .insert(closedProposalsSchema)
    .values({
      proposalId: input.proposalId,
      numero: input.numero,
      proposalCreatedAt,
      approvedAt,
      closed,
      valorTotal,
      matchKind: match,
      leadId,
      traffic,
      channel,
      dealKind,
      ...segmentValues,
      ...sellerValues,
    })
    .onConflictDoUpdate({
      target: closedProposalsSchema.proposalId,
      set: {
        numero: input.numero,
        proposalCreatedAt,
        approvedAt,
        closed,
        valorTotal,
        matchKind: match,
        leadId,
        traffic,
        channel,
        dealKind,
        updatedAt: new Date(),
        ...segmentValues,
        ...sellerValues,
      },
    })
    .returning({
      matchKind: closedProposalsSchema.matchKind,
      leadId: closedProposalsSchema.leadId,
      traffic: closedProposalsSchema.traffic,
    });

  if (traffic && leadId !== null) {
    await refreshDealKinds(leadId);
  }

  if (saved) {
    return toRecord(saved);
  }

  const [current] = await db
    .select({
      matchKind: closedProposalsSchema.matchKind,
      leadId: closedProposalsSchema.leadId,
      traffic: closedProposalsSchema.traffic,
    })
    .from(closedProposalsSchema)
    .where(eq(closedProposalsSchema.proposalId, input.proposalId))
    .limit(1);

  if (!current) {
    throw new Error('closed_proposal_upsert_failed');
  }

  return toRecord(current);
}

async function refreshDealKinds(leadId: number) {
  const rows = await db
    .select({
      proposalId: closedProposalsSchema.proposalId,
      createdAt: closedProposalsSchema.proposalCreatedAt,
      numero: closedProposalsSchema.numero,
    })
    .from(closedProposalsSchema)
    .where(and(eq(closedProposalsSchema.leadId, leadId), eq(closedProposalsSchema.traffic, true)));
  const ordered = [...rows].sort((left, right) => {
    const leftAt = left.createdAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const rightAt = right.createdAt?.getTime() ?? Number.POSITIVE_INFINITY;
    if (leftAt !== rightAt) {
      return leftAt - rightAt;
    }
    return left.numero.localeCompare(right.numero);
  });
  for (let index = 0; index < ordered.length; index += 1) {
    const row = ordered[index];
    if (!row) {
      continue;
    }
    await db
      .update(closedProposalsSchema)
      .set({ dealKind: index === 0 ? 'contract' : 'ltv' })
      .where(eq(closedProposalsSchema.proposalId, row.proposalId));
  }
}

/**
 * Sums valor_total for proposals attributed to paid traffic.
 * @returns The proposal count and the SQL sum of valor_total.
 */
export async function trafficClosedTotal() {
  const [row] = await db
    .select({
      proposals: count(),
      valorTotal: sql<string>`coalesce(sum(${closedProposalsSchema.valorTotal}), 0)`,
    })
    .from(closedProposalsSchema)
    .where(and(eq(closedProposalsSchema.traffic, true), eq(closedProposalsSchema.closed, true)));

  const valorTotal = row?.valorTotal;
  return {
    proposals: Number(row?.proposals ?? 0),
    valorTotal: valorTotal === null || valorTotal === undefined ? '0' : String(valorTotal),
  };
}
