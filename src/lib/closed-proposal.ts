import { phoneMatchKey } from '@/lib/lead-contact';
import { attributionQualifiesForWhatsAppBridge } from '@/lib/whatsapp-attribution-bridge';

export type ClosedProposalAttendance = {
  phoneKey: string;
  name: string;
  phoneMatched: boolean;
};

export type ClosedProposalToken = {
  phoneKey: string | null;
  leadId: number | null;
  claimed: boolean;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  utmMedium?: string | null;
};

export type ClosedProposalMatch =
  | { kind: 'phone'; leadId: number }
  | { kind: 'needs_name'; candidates: ClosedProposalAttendance[] }
  | { kind: 'none' };

export type ClosedProposalNameMatch = { kind: 'ai'; leadId: number } | { kind: 'none' };

const NAME_CANDIDATE_CAP = 5;

function trafficLeadId(token: ClosedProposalToken) {
  if (!token.claimed || token.leadId === null) {
    return null;
  }
  if (
    !attributionQualifiesForWhatsAppBridge({
      gclid: token.gclid ?? undefined,
      gbraid: token.gbraid ?? undefined,
      wbraid: token.wbraid ?? undefined,
      utmMedium: token.utmMedium ?? undefined,
    })
  ) {
    return null;
  }
  return token.leadId;
}

function leadIdsForPhone(phoneKey: string, tokens: ClosedProposalToken[]) {
  const leadIds = new Set<number>();
  for (const token of tokens) {
    const leadId = trafficLeadId(token);
    const tokenKey = phoneMatchKey(token.phoneKey);
    if (leadId === null || tokenKey !== phoneKey) {
      continue;
    }
    leadIds.add(leadId);
  }
  return leadIds;
}

/**
 * Decides a unique phone match or a short list of attendance names to judge.
 * The only phones considered are the arguments passed in.
 * @param input Proposal phones, attendance rows, and attribution tokens.
 * @returns A phone match, a name-check list, or none.
 */
export function decideClosedProposalMatch(input: {
  phones: string[];
  attendance: ClosedProposalAttendance[];
  tokens: ClosedProposalToken[];
}): ClosedProposalMatch {
  const proposalKeys = new Set<string>();
  for (const phone of input.phones) {
    const key = phoneMatchKey(phone);
    if (key) {
      proposalKeys.add(key);
    }
  }

  const leadIds = new Set<number>();
  for (const key of proposalKeys) {
    for (const leadId of leadIdsForPhone(key, input.tokens)) {
      leadIds.add(leadId);
    }
  }

  if (leadIds.size > 1) {
    return { kind: 'none' };
  }

  if (leadIds.size === 1) {
    const [leadId] = leadIds;
    if (leadId !== undefined) {
      return { kind: 'phone', leadId };
    }
  }

  const candidates: ClosedProposalAttendance[] = [];
  for (const entry of input.attendance) {
    if (entry.phoneMatched) {
      continue;
    }
    const name = entry.name.trim();
    const phoneKey = phoneMatchKey(entry.phoneKey);
    if (!name || !phoneKey) {
      continue;
    }
    candidates.push({ phoneKey, name, phoneMatched: false });
    if (candidates.length === NAME_CANDIDATE_CAP) {
      break;
    }
  }

  if (candidates.length === 0) {
    return { kind: 'none' };
  }

  return { kind: 'needs_name', candidates };
}

/**
 * Accepts a name match only when one candidate is the same account and maps to one traffic lead.
 * @param candidates Attendance rows returned for a name check.
 * @param judgements Judge results aligned with candidates.
 * @param tokens Claimed attribution tokens.
 * @returns An ai match for one traffic lead, or none.
 */
export function acceptNameJudgements(
  candidates: ClosedProposalAttendance[],
  judgements: ('same_account' | 'insufficient')[],
  tokens: ClosedProposalToken[],
): ClosedProposalNameMatch {
  const accepted = candidates.filter((_, index) => judgements[index] === 'same_account');
  const [candidate] = accepted;
  if (accepted.length !== 1 || candidate === undefined) {
    return { kind: 'none' };
  }

  const phoneKey = phoneMatchKey(candidate.phoneKey);
  if (!phoneKey) {
    return { kind: 'none' };
  }

  const leadIds = leadIdsForPhone(phoneKey, tokens);
  if (leadIds.size !== 1) {
    return { kind: 'none' };
  }

  const [leadId] = leadIds;
  if (leadId === undefined) {
    return { kind: 'none' };
  }

  return { kind: 'ai', leadId };
}
