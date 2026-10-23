import 'server-only';

import { and, count, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { ClosedProposalAttendance, ClosedProposalToken } from '@/lib/closed-proposal';
import { acceptNameJudgements, decideClosedProposalMatch } from '@/lib/closed-proposal';
import { judgeClosedProposalName } from '@/lib/closed-proposal-name-judge';
import { subscriberKey } from '@/lib/lead-contact';
import { db } from '@/libs/DB';
import { closedProposalsSchema, whatsappAttributionTokensSchema } from '@/models/Schema';

export type RecordClosedProposalInput = {
  proposalId: string;
  numero: string;
  approvedAt: Date;
  valorTotal: number;
  companyName: string;
  phones: string[];
  contactNames: string[];
  attendance: ClosedProposalAttendance[];
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

function toRecord(row: { matchKind: string; leadId: number | null; traffic: boolean }): ClosedProposalRecord {
  return {
    match: matchKindOf(row.matchKind),
    leadId: row.leadId,
    traffic: row.traffic,
  };
}

function collectPhoneKeys(phones: string[], attendance: ClosedProposalAttendance[]) {
  const keys = new Set<string>();
  for (const phone of [...phones, ...attendance.map((entry) => entry.phoneKey)]) {
    const key = subscriberKey(phone);
    if (key) {
      keys.add(key);
    }
  }
  return [...keys];
}

async function loadClaimedTokens(phoneKeys: string[]): Promise<ClosedProposalToken[]> {
  if (phoneKeys.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      phoneKey: whatsappAttributionTokensSchema.phoneKey,
      leadId: whatsappAttributionTokensSchema.leadId,
      gclid: whatsappAttributionTokensSchema.gclid,
      gbraid: whatsappAttributionTokensSchema.gbraid,
      wbraid: whatsappAttributionTokensSchema.wbraid,
      utmMedium: whatsappAttributionTokensSchema.utmMedium,
    })
    .from(whatsappAttributionTokensSchema)
    .where(
      and(
        isNotNull(whatsappAttributionTokensSchema.claimedAt),
        inArray(sql`right(${whatsappAttributionTokensSchema.phoneKey}, 8)`, phoneKeys),
      ),
    );

  return rows.map((row) => ({
    phoneKey: row.phoneKey,
    leadId: row.leadId,
    claimed: true,
    gclid: row.gclid,
    gbraid: row.gbraid,
    wbraid: row.wbraid,
    utmMedium: row.utmMedium,
  }));
}

async function resolveMatch(
  input: RecordClosedProposalInput,
  tokens: ClosedProposalToken[],
  decision: ReturnType<typeof decideClosedProposalMatch>,
) {
  if (decision.kind === 'phone') {
    return { match: 'phone' as const, leadId: decision.leadId };
  }
  if (decision.kind !== 'needs_name') {
    return { match: 'none' as const, leadId: null };
  }

  const candidates = decision.candidates.slice(0, 5);
  const judgements: ('same_account' | 'insufficient')[] = [];
  for (const candidate of candidates) {
    judgements.push(
      await judgeClosedProposalName({
        companyName: input.companyName,
        contactNames: input.contactNames,
        attendanceName: candidate.name,
      }),
    );
  }
  const accepted = acceptNameJudgements(candidates, judgements, tokens);
  if (accepted.kind === 'ai') {
    return { match: 'ai' as const, leadId: accepted.leadId };
  }
  return { match: 'none' as const, leadId: null };
}

/**
 * Upserts an approved proposal and attributes it to paid WhatsApp traffic when the match is unique.
 * @param input Approved proposal fields and the phones used for matching.
 * @returns The stored match. An existing traffic row is returned unchanged.
 * @throws When the upsert does not return a row.
 */
export async function recordClosedProposal(input: RecordClosedProposalInput): Promise<ClosedProposalRecord> {
  const [existing] = await db
    .select({
      matchKind: closedProposalsSchema.matchKind,
      leadId: closedProposalsSchema.leadId,
      traffic: closedProposalsSchema.traffic,
    })
    .from(closedProposalsSchema)
    .where(eq(closedProposalsSchema.proposalId, input.proposalId))
    .limit(1);

  if (existing?.traffic) {
    return toRecord(existing);
  }

  const tokens = await loadClaimedTokens(collectPhoneKeys(input.phones, input.attendance));
  const decision = decideClosedProposalMatch({
    phones: input.phones,
    attendance: input.attendance,
    tokens,
  });

  const resolved = await resolveMatch(input, tokens, decision);
  const { match, leadId } = resolved;

  const traffic = match === 'phone' || match === 'ai';
  const valorTotal = input.valorTotal.toFixed(2);
  const [saved] = await db
    .insert(closedProposalsSchema)
    .values({
      proposalId: input.proposalId,
      numero: input.numero,
      approvedAt: input.approvedAt,
      valorTotal,
      matchKind: match,
      leadId,
      traffic,
    })
    .onConflictDoUpdate({
      target: closedProposalsSchema.proposalId,
      set: {
        numero: input.numero,
        approvedAt: input.approvedAt,
        valorTotal,
        matchKind: match,
        leadId,
        traffic,
        updatedAt: new Date(),
      },
      where: eq(closedProposalsSchema.traffic, false),
    })
    .returning({
      matchKind: closedProposalsSchema.matchKind,
      leadId: closedProposalsSchema.leadId,
      traffic: closedProposalsSchema.traffic,
    });

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
    .where(eq(closedProposalsSchema.traffic, true));

  const valorTotal = row?.valorTotal;
  return {
    proposals: Number(row?.proposals ?? 0),
    valorTotal: valorTotal === null || valorTotal === undefined ? '0' : String(valorTotal),
  };
}
