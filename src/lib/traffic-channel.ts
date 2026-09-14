export type TrafficChannel = 'paid' | 'organic' | 'direct';

export const TRAFFIC_CHANNEL_LABELS_PT: Record<TrafficChannel, string> = {
  paid: 'Paga',
  organic: 'Orgânico',
  direct: 'Direto',
};

export type TrafficChannelInput = {
  utmSource?: string | null;
  utmMedium?: string | null;
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  referrer?: string | null;
};

const PAID_MEDIUMS = new Set([
  'cpc',
  'ppc',
  'paid',
  'cpm',
  'display',
  'paid_social',
  'paid-social',
  'paidsocial',
  'shopping',
]);

const ORGANIC_MEDIUMS = new Set(['organic', 'seo', 'referral', 'social']);

const ORGANIC_SOURCES = new Set([
  'google',
  'bing',
  'yahoo',
  'duckduckgo',
  'ecosia',
  'facebook',
  'instagram',
  'youtube',
]);

const ORGANIC_REFERRER_NEEDLES = [
  'google.',
  'bing.',
  'yahoo.',
  'duckduckgo.',
  'ecosia.',
  'facebook.',
  'instagram.',
  'youtube.',
  'l.facebook.com',
  'lm.facebook.com',
];

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function hasClickId(input: TrafficChannelInput) {
  return Boolean(input.gclid?.trim() || input.gbraid?.trim() || input.wbraid?.trim());
}

function isPaidMedium(medium: string) {
  if (!medium) {
    return false;
  }
  if (PAID_MEDIUMS.has(medium)) {
    return true;
  }
  return medium.includes('paid');
}

function referrerLooksOrganic(referrer: string) {
  if (!referrer) {
    return false;
  }
  if (referrer.includes('acessoequipamentos.com')) {
    return false;
  }
  return ORGANIC_REFERRER_NEEDLES.some((needle) => referrer.includes(needle));
}

/**
 * Classifies a lead or event as paid ads, organic, or direct traffic.
 */
export function classifyTrafficChannel(input: TrafficChannelInput): TrafficChannel {
  const medium = normalize(input.utmMedium);
  const source = normalize(input.utmSource);
  const referrer = normalize(input.referrer);

  if (hasClickId(input) || isPaidMedium(medium)) {
    return 'paid';
  }

  if (
    ORGANIC_MEDIUMS.has(medium)
    || ORGANIC_SOURCES.has(source)
    || referrerLooksOrganic(referrer)
  ) {
    return 'organic';
  }

  return 'direct';
}

/** Portuguese label for the admin Origem column (Paga / Orgânico / Direto). */
export function formatTrafficChannelLabel(input: TrafficChannelInput) {
  return TRAFFIC_CHANNEL_LABELS_PT[classifyTrafficChannel(input)];
}

export function trafficChannelMessageKey(channel: TrafficChannel) {
  return `origin_channel_${channel}` as const;
}

/** Parses filter values such as paid, paga, organico, direto. */
export function parseTrafficChannelParam(value: string | null | undefined): TrafficChannel | null {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

  if (normalized === 'paid' || normalized === 'paga') {
    return 'paid';
  }
  if (normalized === 'organic' || normalized === 'organico') {
    return 'organic';
  }
  if (normalized === 'direct' || normalized === 'direto') {
    return 'direct';
  }

  return null;
}

export type TrafficChannelCounts = {
  total: number;
  paid: number;
  organic: number;
  direct: number;
};

export const EMPTY_TRAFFIC_CHANNEL_COUNTS: TrafficChannelCounts = {
  total: 0,
  paid: 0,
  organic: 0,
  direct: 0,
};

/**
 * Tallies classified rows into tráfego, orgânico, and direto.
 */
export function tallyTrafficChannels(rows: TrafficChannelInput[]): TrafficChannelCounts {
  const counts: TrafficChannelCounts = {
    total: rows.length,
    paid: 0,
    organic: 0,
    direct: 0,
  };

  for (const row of rows) {
    counts[classifyTrafficChannel(row)] += 1;
  }

  return counts;
}
