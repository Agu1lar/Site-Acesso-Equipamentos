import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildAttributionFromVisit,
  hasAttributionData,
  parseClickIdsFromSearch,
  parseUtmsFromSearch,
  pickEssentialCampaignAttribution,
  restorePaidClickIdsToLocationSearch,
  urlHasPaidAdsClickSignal,
} from '@/lib/attribution';

describe('parse UTMs from search', () => {
  it('maps standard utm query keys', () => {
    const result = parseUtmsFromSearch('?utm_source=google&utm_medium=cpc&utm_campaign=obra');
    expect(result.utmSource).toBe('google');
    expect(result.utmMedium).toBe('cpc');
    expect(result.utmCampaign).toBe('obra');
  });
});

describe('parse click ids from search', () => {
  it('maps gclid from Google Ads auto-tagging', () => {
    const result = parseClickIdsFromSearch('?gclid=CjwKCAiAexample');
    expect(result.gclid).toBe('CjwKCAiAexample');
  });
});

describe('build attribution from visit', () => {
  it('includes referrer and landing path', () => {
    const result = buildAttributionFromVisit({
      search: '?utm_source=meta',
      referrer: 'https://google.com/',
      landingPath: '/equipamentos/betoneira?utm_source=meta',
    });
    expect(result.utmSource).toBe('meta');
    expect(result.referrer).toContain('google.com');
    expect(result.landingPage).toContain('betoneira');
  });
});

describe('has attribution data', () => {
  it('returns false for empty object', () => {
    expect(hasAttributionData({})).toBeFalsy();
  });

  it('returns true when utm source is set', () => {
    expect(hasAttributionData({ utmSource: 'google' })).toBeTruthy();
  });

  it('returns true when gclid is set', () => {
    expect(hasAttributionData({ gclid: 'abc123' })).toBeTruthy();
  });
});

describe('essential campaign attribution', () => {
  it('keeps gclid without analytics consent fields like referrer', () => {
    const essential = pickEssentialCampaignAttribution({
      gclid: 'abc',
      referrer: 'https://google.com',
      landingPage: '/?gclid=abc',
      utmSource: 'google',
    });
    expect(essential?.gclid).toBe('abc');
    expect(essential?.utmSource).toBe('google');
    expect(essential?.referrer).toBeUndefined();
  });

  it('omits bare landing without campaign or click id', () => {
    expect(pickEssentialCampaignAttribution({ landingPage: '/', referrer: 'x' })).toBeUndefined();
  });
});

describe('paid ads click signals', () => {
  it('detects gclid and gad_source in the URL', () => {
    expect(urlHasPaidAdsClickSignal('?gclid=x')).toBe(true);
    expect(urlHasPaidAdsClickSignal('?gad_source=1')).toBe(true);
    expect(urlHasPaidAdsClickSignal('?utm_source=google')).toBe(false);
  });
});

describe('restore paid click ids to location search', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rewrites the URL with gclid from session attribution', () => {
    const replaceState = vi.fn();
    vi.stubGlobal('window', {
      location: {
        href: 'https://acessoequipamentos.com.br/equipamentos',
        search: '',
        pathname: '/equipamentos',
        hash: '',
      },
      history: { state: null, replaceState },
      sessionStorage: {
        getItem: () => JSON.stringify({ gclid: 'CjwKCAiAexample' }),
        setItem: () => undefined,
        removeItem: () => undefined,
        clear: () => undefined,
      },
    });

    expect(restorePaidClickIdsToLocationSearch()).toBe(true);
    expect(replaceState).toHaveBeenCalled();
    const nextUrl = String(replaceState.mock.calls[0]?.[2] ?? '');
    expect(nextUrl).toContain('gclid=CjwKCAiAexample');
  });
});
