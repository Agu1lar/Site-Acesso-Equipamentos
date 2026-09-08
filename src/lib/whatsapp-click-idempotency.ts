/** Ignore a second WhatsApp click from the same button within this window. */
export const WHATSAPP_CLICK_DEDUP_WINDOW_MS = 10_000;

export type WhatsAppClickDedupRow = {
  createdAt: Date;
  origin?: string | null;
  equipmentSlug?: string | null;
  pathname?: string | null;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
};

function blank(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function clickId(row: Pick<WhatsAppClickDedupRow, 'gclid' | 'gbraid' | 'wbraid'>) {
  return blank(row.gclid) || blank(row.gbraid) || blank(row.wbraid);
}

/**
 * Fingerprint for the same WhatsApp button click (origin, page, campaign click id).
 */
export function whatsappClickDedupKey(row: WhatsAppClickDedupRow) {
  return [blank(row.origin), blank(row.equipmentSlug), blank(row.pathname), clickId(row)].join('\u0001');
}

/**
 * True when `now` falls inside the duplicate-click window after `previousAt`.
 */
export function isWithinWhatsAppClickDedupWindow(previousAt: number, now = Date.now()) {
  return now - previousAt >= 0 && now - previousAt < WHATSAPP_CLICK_DEDUP_WINDOW_MS;
}

/**
 * Keeps the first click and drops later events with the same fingerprint inside the window.
 */
export function collapseDuplicateWhatsAppClicks<T extends WhatsAppClickDedupRow>(rows: T[]): T[] {
  const sorted = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const kept: T[] = [];
  const lastKeptAt = new Map<string, number>();

  for (const row of sorted) {
    const key = whatsappClickDedupKey(row);
    const previousAt = lastKeptAt.get(key);
    if (previousAt !== undefined && isWithinWhatsAppClickDedupWindow(previousAt, row.createdAt.getTime())) {
      continue;
    }
    kept.push(row);
    lastKeptAt.set(key, row.createdAt.getTime());
  }

  return kept;
}
