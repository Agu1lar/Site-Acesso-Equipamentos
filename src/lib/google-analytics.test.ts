import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COOKIE_CONSENT_STORAGE_KEY } from '@/lib/cookie-consent';

function installLocalStorageMock() {
  const store = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };

  vi.stubGlobal('window', {
    localStorage: localStorageMock,
    dataLayer: undefined,
    gtag: undefined,
  });
  vi.stubGlobal('localStorage', localStorageMock);
}

describe('google analytics consent sync', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', 'AW-11323862073');
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_WHATSAPP', 'AW-11323862073/RLI1CNa09tQcELnY0Zcq');
    installLocalStorageMock();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('restores Ads consent from localStorage before hydration completes', async () => {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, 'analytics');

    const {
      syncGoogleAnalyticsConsentFromStorage,
      isGoogleAnalyticsConsentGranted,
      denyGoogleAnalyticsConsent,
    } = await import('@/lib/google-analytics');

    denyGoogleAnalyticsConsent();
    expect(isGoogleAnalyticsConsentGranted()).toBe(false);

    expect(syncGoogleAnalyticsConsentFromStorage()).toBe(true);
    expect(isGoogleAnalyticsConsentGranted()).toBe(true);
  });

  it('leaves consent denied when storage is essential-only', async () => {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, 'essential');

    const {
      syncGoogleAnalyticsConsentFromStorage,
      isGoogleAnalyticsConsentGranted,
      denyGoogleAnalyticsConsent,
    } = await import('@/lib/google-analytics');

    denyGoogleAnalyticsConsent();
    expect(syncGoogleAnalyticsConsentFromStorage()).toBe(false);
    expect(isGoogleAnalyticsConsentGranted()).toBe(false);
  });

  it('exposes GA4 event names used by the funnel', async () => {
    const { GA_CONVERSION_EVENTS } = await import('@/lib/google-analytics');
    expect(GA_CONVERSION_EVENTS.generateLead).toBe('generate_lead');
    expect(GA_CONVERSION_EVENTS.whatsappClick).toBe('whatsapp_click');
  });

  it('fires WhatsApp Ads conversion without analytics cookie consent', async () => {
    const dataLayer: unknown[] = [];
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
        clear: () => undefined,
      },
      dataLayer,
      gtag: (...args: unknown[]) => {
        dataLayer.push(args);
      },
    });

    const { captureGoogleAdsWhatsAppConversion, isGoogleAnalyticsConsentGranted } =
      await import('@/lib/google-analytics');

    expect(isGoogleAnalyticsConsentGranted()).toBe(false);
    captureGoogleAdsWhatsAppConversion({ origin: 'site-home' });

    const conversion = dataLayer.find(
      (entry) =>
        Array.isArray(entry) && entry[0] === 'event' && entry[1] === 'conversion',
    ) as unknown[] | undefined;

    expect(conversion?.[2]).toMatchObject({
      send_to: 'AW-11323862073/RLI1CNa09tQcELnY0Zcq',
      transport_type: 'beacon',
    });
  });
});
