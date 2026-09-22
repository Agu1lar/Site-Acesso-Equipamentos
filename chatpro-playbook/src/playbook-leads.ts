export type LeadSessionLike = {
  id: string;
  phoneKey?: string | null;
  phone_key?: string | null;
};

/**
 * Stable lead id: WhatsApp digits, or the session id when the phone is missing.
 */
export function leadKeyFromSession(session: LeadSessionLike) {
  const phone = session.phoneKey ?? session.phone_key ?? null;
  if (phone && phone.length >= 10) {
    return phone;
  }
  return session.id;
}

/**
 * Keeps every session of the first `maxLeads` distinct phones. Transfers of the same
 * WhatsApp stay together instead of filling the cap as extra leads.
 */
export function takeSessionsForUniqueLeads<T extends LeadSessionLike>(
  sessions: T[],
  maxLeads: number,
) {
  const selectedKeys = new Set<string>();
  const kept: T[] = [];
  for (const session of sessions) {
    const key = leadKeyFromSession(session);
    if (selectedKeys.has(key) || selectedKeys.size < maxLeads) {
      selectedKeys.add(key);
      kept.push(session);
    }
  }
  return { sessions: kept, leadCount: selectedKeys.size };
}
