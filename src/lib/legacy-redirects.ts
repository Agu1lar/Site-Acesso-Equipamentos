import legacyRedirectsData from '@/data/legacy-redirects.json';

type LegacyRedirectEntry = {
  source: string;
  destination: string;
  note?: string;
};

type LegacyPrefixRedirectEntry = {
  sourcePrefix: string;
  destination: string;
  note?: string;
};

/**
 * Normalizes pathname for legacy lookup (lowercase, no trailing slash).
 * @param pathname Request pathname.
 * @returns Normalized path without trailing slash.
 */
export function normalizeLegacyPathname(pathname: string) {
  const lower = pathname.toLowerCase();
  if (lower.length > 1 && lower.endsWith('/')) {
    return lower.slice(0, -1);
  }
  return lower;
}

const exactMap = new Map<string, string>();

for (const entry of legacyRedirectsData.redirects as LegacyRedirectEntry[]) {
  exactMap.set(normalizeLegacyPathname(entry.source), entry.destination);
}

const prefixRules = (legacyRedirectsData.prefixRedirects as LegacyPrefixRedirectEntry[]).map(
  (entry) => ({
    prefix: normalizeLegacyPathname(entry.sourcePrefix),
    destination: entry.destination,
  }),
);

/**
 * Resolves redirect destination for a normalized pathname.
 */
function resolveLegacyRedirectPath(normalized: string) {
  const exact = exactMap.get(normalized);
  if (exact) {
    return exact;
  }

  for (const rule of prefixRules) {
    if (normalized === rule.prefix || normalized.startsWith(`${rule.prefix}/`)) {
      return rule.destination;
    }
  }

  return null;
}

/**
 * Resolves a permanent redirect destination for WordPress legacy URLs.
 * @param pathname Request pathname (with or without trailing slash).
 * @returns Destination path on this site, or null if no rule matches.
 */
export function resolveLegacyRedirect(pathname: string) {
  const normalized = normalizeLegacyPathname(pathname);

  if (normalized.endsWith('/feed')) {
    const parent = normalized.slice(0, -'/feed'.length);
    if (parent) {
      const parentDestination = resolveLegacyRedirectPath(normalizeLegacyPathname(parent));
      if (parentDestination) {
        return parentDestination;
      }
    }
    return '/';
  }

  return resolveLegacyRedirectPath(normalized);
}

/**
 * Exposes redirect count for docs and tests.
 * @returns Counts and metadata from the legacy redirect map.
 */
export function legacyRedirectStats() {
  return {
    exact: legacyRedirectsData.redirects.length,
    prefix: legacyRedirectsData.prefixRedirects.length,
    generatedAt: legacyRedirectsData.generatedAt,
    source: legacyRedirectsData.source,
  };
}
