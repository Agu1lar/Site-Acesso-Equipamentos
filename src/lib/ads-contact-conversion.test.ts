import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sha256Hex } from '@/lib/enhanced-conversions';

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

  return { dataLayer, session };
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

    const result = await fireAdsContactConversion({ source: 'whatsapp', origin: 'site-home' });

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

    await fireAdsContactConversion({ source: 'whatsapp', origin: 'site-home' });
    const second = await fireAdsContactConversion({ source: 'whatsapp', origin: 'site-detalhe' });

    expect(second.fired).toBe(false);
    expect(second.reason).toBe('already_fired');
    expect(countConversions(dataLayer)).toBe(1);
  });

  it('counts quote submit followed by WhatsApp open as a single lead', async () => {
    const { dataLayer } = installWindowMock();
    const { fireAdsContactConversion } = await import('@/lib/ads-contact-conversion');

    await fireAdsContactConversion({ source: 'quote', origin: 'site-orcamento', leadId: 42 });
    await fireAdsContactConversion({ source: 'whatsapp', origin: 'site-orcamento-envio' });

    expect(countConversions(dataLayer)).toBe(1);
  });

  it('shares the session lock across WhatsApp, quote and phone CTAs', async () => {
    const { dataLayer } = installWindowMock();
    const { fireAdsContactConversion, hasFiredAdsContactConversion } =
      await import('@/lib/ads-contact-conversion');

    expect(hasFiredAdsContactConversion()).toBe(false);

    await fireAdsContactConversion({ source: 'phone', origin: 'site-contato-ligar' });
    await fireAdsContactConversion({ source: 'quote', origin: 'site-orcamento' });
    await fireAdsContactConversion({ source: 'whatsapp', origin: 'site-header' });

    expect(hasFiredAdsContactConversion()).toBe(true);
    expect(countConversions(dataLayer)).toBe(1);
  });

  it('reports not configured when no conversion label exists', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_CONTACT', '');
    const { dataLayer } = installWindowMock();
    const { fireAdsContactConversion } = await import('@/lib/ads-contact-conversion');

    const result = await fireAdsContactConversion({ source: 'phone', origin: 'site-footer-ligar' });

    expect(result.fired).toBe(false);
    expect(result.reason).toBe('not_configured');
    expect(countConversions(dataLayer)).toBe(0);
  });

  it('falls back to the legacy lead label until the contact action is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_CONTACT', '');
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LEAD', 'AW-11323862073/LegacyLead1');
    const { dataLayer } = installWindowMock();
    const { fireAdsContactConversion } = await import('@/lib/ads-contact-conversion');

    expect(
      (await fireAdsContactConversion({ source: 'quote', origin: 'site-orcamento' })).fired,
    ).toBe(true);

    const conversion = dataLayer.find(
      entry => Array.isArray(entry) && entry[1] === 'conversion',
    ) as unknown[];

    expect(conversion[2]).toMatchObject({ send_to: 'AW-11323862073/LegacyLead1' });
  });

  it('sets hashed user_data when quote PII is provided', async () => {
    const { dataLayer } = installWindowMock();
    const { fireAdsContactConversion } = await import('@/lib/ads-contact-conversion');

    const result = await fireAdsContactConversion({
      source: 'quote',
      origin: 'site-orcamento',
      user: {
        email: 'Lead@Example.com',
        phone: '11988887777',
        name: 'Ana Souza',
      },
    });

    expect(result.fired).toBe(true);

    const userDataSet = dataLayer.find(
      entry => Array.isArray(entry) && entry[0] === 'set' && entry[1] === 'user_data',
    ) as unknown[] | undefined;

    expect(userDataSet?.[2]).toEqual({
      email: await sha256Hex('lead@example.com'),
      phone_number: await sha256Hex('+5511988887777'),
      address: {
        first_name: await sha256Hex('ana'),
        last_name: await sha256Hex('souza'),
      },
    });
  });

  it('upgrades a prior conversion with the same transaction id when PII arrives later', async () => {
    const { dataLayer } = installWindowMock();
    const { fireAdsContactConversion } = await import('@/lib/ads-contact-conversion');

    const first = await fireAdsContactConversion({ source: 'whatsapp', origin: 'site-home' });
    expect(first.fired).toBe(true);
    expect(countConversions(dataLayer)).toBe(1);

    const upgrade = await fireAdsContactConversion({
      source: 'quote',
      origin: 'site-orcamento',
      user: { email: 'upgrade@example.com', phone: '11999998888' },
    });

    expect(upgrade.fired).toBe(true);
    expect(upgrade.reason).toBe('enhanced_upgrade');
    expect(upgrade.transactionId).toBe(first.transactionId);
    expect(countConversions(dataLayer)).toBe(2);

    const userDataSet = dataLayer.find(
      entry => Array.isArray(entry) && entry[0] === 'set' && entry[1] === 'user_data',
    ) as unknown[] | undefined;
    expect(userDataSet?.[2]).toMatchObject({
      email: await sha256Hex('upgrade@example.com'),
    });
  });

  it('reuses stored session identifiers on a later WhatsApp click', async () => {
    const { dataLayer } = installWindowMock();
    const { storeEnhancedConversionUser } = await import('@/lib/enhanced-conversions');
    const { fireAdsContactConversion } = await import('@/lib/ads-contact-conversion');

    storeEnhancedConversionUser({ email: 'session@example.com' });
    await fireAdsContactConversion({ source: 'whatsapp', origin: 'site-header' });

    const userDataSet = dataLayer.find(
      entry => Array.isArray(entry) && entry[0] === 'set' && entry[1] === 'user_data',
    ) as unknown[] | undefined;

    expect(userDataSet?.[2]).toEqual({
      email: await sha256Hex('session@example.com'),
    });
  });
});
