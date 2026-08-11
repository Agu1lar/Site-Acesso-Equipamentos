import * as z from 'zod';
import { isInternalAnalyticsPath } from '@/lib/analytics-internal-paths';

const ATTRIBUTION_STORAGE_KEY = 'acesso_attribution';

const UTM_PARAM_MAP = {
  utm_source: 'utmSource',
  utm_medium: 'utmMedium',
  utm_campaign: 'utmCampaign',
  utm_content: 'utmContent',
  utm_term: 'utmTerm',
} as const;

const CLICK_ID_PARAM_MAP = {
  gclid: 'gclid',
  gbraid: 'gbraid',
  wbraid: 'wbraid',
} as const;

export const AttributionSchema = z.object({
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(200).optional(),
  utmContent: z.string().max(200).optional(),
  utmTerm: z.string().max(200).optional(),
  gclid: z.string().max(255).optional(),
  gbraid: z.string().max(255).optional(),
  wbraid: z.string().max(255).optional(),
  referrer: z.string().max(500).optional(),
  landingPage: z.string().max(500).optional(),
});

export type AttributionInput = z.infer<typeof AttributionSchema>;

/**
 * Parses UTM query params from a search string (e.g. `?utm_source=google`).
 */
export function parseUtmsFromSearch(search: string) {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const partial: Partial<AttributionInput> = {};

  for (const [queryKey, fieldKey] of Object.entries(UTM_PARAM_MAP)) {
    const value = params.get(queryKey)?.trim();
    if (value) {
      partial[fieldKey] = value;
    }
  }

  return partial;
}

/**
 * Parses Google Ads click ids from URL (auto-tagging).
 */
export function parseClickIdsFromSearch(search: string) {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const partial: Partial<AttributionInput> = {};

  for (const [queryKey, fieldKey] of Object.entries(CLICK_ID_PARAM_MAP)) {
    const value = params.get(queryKey)?.trim();
    if (value) {
      partial[fieldKey] = value;
    }
  }

  return partial;
}

/**
 * Builds attribution payload from URL search, referrer and landing path (first-touch).
 */
export function buildAttributionFromVisit(options: {
  search: string;
  referrer: string;
  landingPath: string;
}) {
  const fromQuery = {
    ...parseUtmsFromSearch(options.search),
    ...parseClickIdsFromSearch(options.search),
  };
  const referrer = options.referrer.trim().slice(0, 500) || undefined;
  const landingPage = options.landingPath.trim().slice(0, 500) || undefined;

  const payload = {
    ...fromQuery,
    referrer,
    landingPage,
  };

  const parsed = AttributionSchema.safeParse(payload);
  return parsed.success ? parsed.data : {};
}

/**
 * True when the visit carries a paid Google Ads click id or gad_source.
 */
export function urlHasPaidAdsClickSignal(search: string) {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  return Boolean(
    params.get('gclid')?.trim() ||
      params.get('gbraid')?.trim() ||
      params.get('wbraid')?.trim() ||
      params.get('gad_source')?.trim(),
  );
}

/**
 * True when attribution includes a paid click id.
 */
export function hasPaidClickIds(attribution: AttributionInput) {
  return Boolean(attribution.gclid ?? attribution.gbraid ?? attribution.wbraid);
}

/**
 * Resolves paid click ids from the current URL or first-touch session storage.
 */
export function resolvePaidClickIds(): Pick<AttributionInput, 'gclid' | 'gbraid' | 'wbraid'> | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const fromUrl = parseClickIdsFromSearch(window.location?.search ?? '');
  const stored = readStoredAttribution();
  const gclid = fromUrl.gclid ?? stored?.gclid;
  const gbraid = fromUrl.gbraid ?? stored?.gbraid;
  const wbraid = fromUrl.wbraid ?? stored?.wbraid;

  if (!gclid && !gbraid && !wbraid) {
    return null;
  }

  return { gclid, gbraid, wbraid };
}

/**
 * Puts stored gclid/gbraid/wbraid back into the URL so the Ads conversion linker
 * can attribute the WhatsApp click without analytics cookies.
 * @returns true when a paid click id is present after the call
 */
export function restorePaidClickIdsToLocationSearch() {
  const paid = resolvePaidClickIds();
  if (!paid || typeof window === 'undefined') {
    return false;
  }

  try {
    const url = new URL(window.location.href);
    let changed = false;

    if (paid.gclid && url.searchParams.get('gclid') !== paid.gclid) {
      url.searchParams.set('gclid', paid.gclid);
      changed = true;
    }
    if (paid.gbraid && url.searchParams.get('gbraid') !== paid.gbraid) {
      url.searchParams.set('gbraid', paid.gbraid);
      changed = true;
    }
    if (paid.wbraid && url.searchParams.get('wbraid') !== paid.wbraid) {
      url.searchParams.set('wbraid', paid.wbraid);
      changed = true;
    }

    if (changed && typeof window.history?.replaceState === 'function') {
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
  } catch {
    return Boolean(paid.gclid ?? paid.gbraid ?? paid.wbraid);
  }

  return true;
}

/**
 * Campaign attribution kept for essential Ads conversion counting (no geo / profiling).
 */
export function pickEssentialCampaignAttribution(
  attribution: AttributionInput | null | undefined,
): AttributionInput | undefined {
  if (!attribution) {
    return undefined;
  }

  const essential: AttributionInput = {};
  if (attribution.gclid) {
    essential.gclid = attribution.gclid;
  }
  if (attribution.gbraid) {
    essential.gbraid = attribution.gbraid;
  }
  if (attribution.wbraid) {
    essential.wbraid = attribution.wbraid;
  }
  if (attribution.utmSource) {
    essential.utmSource = attribution.utmSource;
  }
  if (attribution.utmMedium) {
    essential.utmMedium = attribution.utmMedium;
  }
  if (attribution.utmCampaign) {
    essential.utmCampaign = attribution.utmCampaign;
  }
  if (attribution.landingPage) {
    essential.landingPage = attribution.landingPage;
  }

  if (!hasPaidClickIds(essential) && !essential.landingPage && !essential.utmCampaign) {
    return undefined;
  }

  // Only keep when there is a paid signal or UTM campaign — avoid storing bare "/" landings alone.
  if (!hasPaidClickIds(essential) && !essential.utmSource && !essential.utmCampaign) {
    return undefined;
  }

  return essential;
}

/**
 * Returns true when attribution has at least one meaningful field.
 */
export function hasAttributionData(attribution: AttributionInput) {
  return Boolean(
    attribution.utmSource ??
      attribution.utmMedium ??
      attribution.utmCampaign ??
      attribution.utmContent ??
      attribution.utmTerm ??
      attribution.gclid ??
      attribution.gbraid ??
      attribution.wbraid ??
      attribution.referrer ??
      attribution.landingPage,
  );
}

/**
 * Reads JSON attribution from sessionStorage (browser only).
 */
export function readStoredAttribution(): AttributionInput | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage?.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = AttributionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Persists first-touch attribution for the tab session (does not overwrite).
 */
export function captureAttributionFirstTouch() {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY)) {
    return;
  }

  const landingPath = `${window.location.pathname}${window.location.search}`;
  if (isInternalAnalyticsPath(landingPath)) {
    return;
  }

  const built = buildAttributionFromVisit({
    search: window.location.search,
    referrer: document.referrer,
    landingPath,
  });

  const payload: AttributionInput = {
    ...built,
    landingPage: (built.landingPage ?? landingPath.trim()).slice(0, 500) || undefined,
  };

  window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(payload));
}
