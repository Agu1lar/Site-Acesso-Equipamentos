import type { AttributionInput } from '@/lib/attribution';
import { phoneMatchKey, subscriberKey } from '@/lib/lead-contact';
import { attributionQualifiesForWhatsAppBridge } from '@/lib/whatsapp-attribution-bridge';

export type PaidClick = {
  prefix: string;
  clickedAt: Date;
  leadId: number | null;
};

export type PaidClickSource = {
  identity: string;
  phone: string | null;
  clickedAt: Date;
  leadId: number | null;
  attribution: AttributionInput;
};

/**
 * Eight local digits that stay the same with or without country code 55, DDD, and the mobile 9.
 * A prefix shared by two people is dropped by the caller.
 * @param phone Raw phone text.
 * @returns The subscriber key, or null when the phone is too short.
 */
export function proposalPhoneKey(phone: string | null | undefined) {
  return subscriberKey(phone);
}

/**
 * True for the 14 Aug 2026 bulk import of old proposals, which must not become a contract.
 * @param createdAt Proposal creation time from Força.
 * @param numero Proposal number, with or without the revision.
 * @returns Whether this row is the imported history.
 */
export function isAugustBulkImport(createdAt: Date, numero: string) {
  const number = Number.parseInt(numero, 10);
  if (!Number.isFinite(number) || number >= 15000) {
    return false;
  }
  const local = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(createdAt);
  return local.startsWith('2026-08-14 00');
}

/**
 * Keeps one click per prefix. The same phone on two leads stays. Two different numbers that share the 8 digits are left out.
 * @param sources Paid leads and WhatsApp clicks.
 * @returns The earliest click for each unique prefix.
 */
export function uniquePaidClicks(sources: PaidClickSource[]) {
  const groups = new Map<string, { people: Set<string>; clickedAt: Date; leadId: number | null }>();
  for (const source of sources) {
    if (!attributionQualifiesForWhatsAppBridge(source.attribution)) {
      continue;
    }
    const prefix = proposalPhoneKey(source.phone);
    if (!prefix) {
      continue;
    }
    const person = phoneMatchKey(source.phone) ?? source.identity;
    const current = groups.get(prefix);
    if (!current) {
      groups.set(prefix, {
        people: new Set([person]),
        clickedAt: source.clickedAt,
        leadId: source.leadId,
      });
      continue;
    }
    current.people.add(person);
    if (source.clickedAt < current.clickedAt) {
      current.clickedAt = source.clickedAt;
      if (source.leadId !== null) {
        current.leadId = source.leadId;
      }
    } else if (current.leadId === null && source.leadId !== null) {
      current.leadId = source.leadId;
    }
  }

  const clicks: PaidClick[] = [];
  for (const [prefix, group] of groups) {
    if (group.people.size !== 1) {
      continue;
    }
    clicks.push({
      prefix,
      clickedAt: group.clickedAt,
      leadId: group.leadId,
    });
  }
  return clicks;
}

/**
 * Links a proposal to a paid click when a contact prefix matches and the proposal was created after that click.
 * @param input Proposal creation time, contact phones, and the paid-click list.
 * @returns Whether the proposal counts as paid traffic, and the lead when exactly one matches.
 */
export function matchProposalToPaidClick(input: {
  createdAt: Date | null;
  numero?: string;
  phones: string[];
  clicks: PaidClick[];
}) {
  if (!input.createdAt || isAugustBulkImport(input.createdAt, input.numero ?? '')) {
    return { traffic: false as const, leadId: null };
  }
  const prefixes = new Set(input.phones.map((phone) => proposalPhoneKey(phone)).filter((prefix) => prefix !== null));
  const matched = input.clicks.filter((click) => prefixes.has(click.prefix));
  const earliest = matched.reduce<PaidClick | null>((current, click) => {
    if (!current || click.clickedAt < current.clickedAt) {
      return click;
    }
    return current;
  }, null);
  if (!earliest || input.createdAt < earliest.clickedAt) {
    return { traffic: false as const, leadId: null };
  }
  const leadIds = new Set(matched.flatMap((click) => (click.leadId === null ? [] : [click.leadId])));
  const [leadId] = leadIds;
  return {
    traffic: true as const,
    leadId: leadIds.size === 1 ? (leadId ?? null) : null,
  };
}
