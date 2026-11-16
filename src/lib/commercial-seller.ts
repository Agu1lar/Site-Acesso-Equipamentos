const COMMERCIAL_SELLERS = [
  'Bianca',
  'Renata',
  'Sandra',
  'Cesar',
  'Claudilene',
  'Flaviano',
  'Pedro',
  'Soraia',
  'Sergio',
  'Jeremias',
  'Jose',
] as const;

const SELLER_ALIASES: Record<string, (typeof COMMERCIAL_SELLERS)[number]> = {
  andreza: 'Renata',
  andrezza: 'Renata',
};

/** Salespeople shown first on the ROAS panel. */
export const PRIMARY_SELLERS = ['Bianca', 'Renata', 'Sandra'] as const;

/**
 * Maps a Força salesperson name to the commercial team.
 * @param value Name from the proposal seller.
 * @returns The team first name, or null when it is not a known salesperson.
 */
export function commercialSeller(value: string | null | undefined) {
  const token = value
    ?.normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[\s.]+/)
    .find((part) => part.length >= 2);
  if (!token) {
    return null;
  }
  return SELLER_ALIASES[token] ?? COMMERCIAL_SELLERS.find((name) => name.toLowerCase() === token) ?? null;
}
