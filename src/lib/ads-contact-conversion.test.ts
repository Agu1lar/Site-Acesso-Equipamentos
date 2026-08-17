import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CONTACT_SEND_TO = 'AW-11323862073/ContactLabel1';

function installWindowMock() {
  const session = new Map<string, string>();
  const dataLayer: unknown[] = [];

  vi.stubGlobal('window', {
    localStorage: {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
    },
    sessionStorage: {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => {
        session.set(key, value);
      },
      removeItem: (key: string) => {
        session.delete(key);
      },
      clear: () => {
        session.clear();
      },
    },
    location: { search: '', pathname: '/', href: 'https://example.com/', hash: '' },
    dataLayer,
    gtag: (...args: unknown[]) => {
      dataLayer.push(args);
    },
  });

  return { dataLayer };
}

function countConversions(dataLayer: unknown[]) {
  return dataLayer.filter(
    entry => Array.isArray(entry) && entry[0] === 'event' && entry[1] === 'conversion',
  ).length;
}

describe('ads contact conversion', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', 'AW-11323862073');
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_CONTACT', CONTACT_SEND_TO);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sends one conversion with the unified send_to and a transaction id', async () => {
    const { dataLayer } = installWindowMock();
    const { fireAdsContactConversion } = await import('@/lib/ads-contact-conversion');

    const result = fireAdsContactConversion({ source: 'whatsapp', origin: 'site-home' });

    expect(result.fired).toBe(true);
    expect(countConversions(dataLayer)).toBe(1);

    const conversion = dataLayer.find(
      entry => Array.isArray(entry) && entry[1] === 'conversion',
    ) as unknown[];

    expect(conversion[2]).toMatchObject({
      send_to: CONTACT_SEND_TO,
      transaction_id: result.transactionId,
      contact_source: 'whatsapp',
      currency: 'BRL',
    });
  });

  it('skips the second conversion in the same session', async () => {
    const { dataLayer } = installWindowMock();
    const { fireAdsContactConversion } = await import('@/lib/ads-contact-conversion');

    fireAdsContactConversion({ source: 'whatsapp', origin: 'site-home' });
    const second = fireAdsContactConversion({ source: 'whatsapp', origin: 'site-detalhe' });

    expect(second.fired).toBe(false);
    expect(second.reason).toBe('already_fired');
    expect(countConversions(dataLayer)).toBe(1);
  });

  it('counts quote submit followed by WhatsApp open as a single lead', async () => {
    const { dataLayer } = installWindowMock();
    const { fireAdsContactConversion } = await import('@/lib/ads-contact-conversion');

    fireAdsContactConversion({ source: 'quote', origin: 'site-orcamento', leadId: 42 });
    fireAdsContactConversion({ source: 'whatsapp', origin: 'site-orcamento-envio' });

    expect(countConversions(dataLayer)).toBe(1);
  });

  it('shares the session lock across WhatsApp, quote and phone CTAs', async () => {
    const { dataLayer } = installWindowMock();
    const { fireAdsContactConversion, hasFiredAdsContactConversion } =
      await import('@/lib/ads-contact-conversion');

    expect(hasFiredAdsContactConversion()).toBe(false);

    fireAdsContactConversion({ source: 'phone', origin: 'site-contato-ligar' });
    fireAdsContactConversion({ source: 'quote', origin: 'site-orcamento' });
    fireAdsContactConversion({ source: 'whatsapp', origin: 'site-header' });

    expect(hasFiredAdsContactConversion()).toBe(true);
    expect(countConversions(dataLayer)).toBe(1);
  });

  it('reports not configured when no conversion label exists', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_CONTACT', '');
    const { dataLayer } = installWindowMock();
    const { fireAdsContactConversion } = await import('@/lib/ads-contact-conversion');

    const result = fireAdsContactConversion({ source: 'phone', origin: 'site-footer-ligar' });

    expect(result.fired).toBe(false);
    expect(result.reason).toBe('not_configured');
    expect(countConversions(dataLayer)).toBe(0);
  });

  it('falls back to the legacy lead label until the contact action is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_CONTACT', '');
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LEAD', 'AW-11323862073/LegacyLead1');
    const { dataLayer } = installWindowMock();
    const { fireAdsContactConversion } = await import('@/lib/ads-contact-conversion');

    expect(fireAdsContactConversion({ source: 'quote', origin: 'site-orcamento' }).fired).toBe(true);

    const conversion = dataLayer.find(
      entry => Array.isArray(entry) && entry[1] === 'conversion',
    ) as unknown[];

    expect(conversion[2]).toMatchObject({ send_to: 'AW-11323862073/LegacyLead1' });
  });
});
