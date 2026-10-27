import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireAdsContactConversion } from '@/lib/ads-contact-conversion';
import { openTrackedWhatsApp } from '@/lib/track-whatsapp-click';

vi.mock('@/lib/ads-contact-conversion', () => ({
  fireAdsContactConversion: vi.fn(async () => ({ fired: true, transactionId: null })),
}));

vi.mock('@/lib/posthog-events', () => ({
  captureWhatsAppClick: vi.fn(),
}));

vi.mock('@/lib/google-analytics', () => ({
  GA_CONVERSION_EVENTS: { whatsappClick: 'whatsapp_click' },
  captureGaEvent: vi.fn(),
  preparePaidSearchAdsConversion: vi.fn(),
  isGoogleAnalyticsConsentGranted: () => false,
  syncGoogleAnalyticsConsentFromStorage: vi.fn(),
}));

vi.mock('@/lib/attribution', () => ({
  pickEssentialCampaignAttribution: (value: unknown) => value,
  readStoredAttribution: () => ({ gclid: 'click-1' }),
}));

vi.mock('@/lib/visitor-geo', () => ({
  readStoredVisitorGeo: () => null,
}));

vi.mock('@/lib/meta-conversion-context', () => ({
  readMetaConversionContext: () => undefined,
}));

function stubWindow(open: () => Window | null) {
  vi.stubGlobal('window', {
    open,
    location: { pathname: '/equipamentos' },
    matchMedia: () => ({ matches: true }),
    setTimeout: globalThis.setTimeout.bind(globalThis),
  });
}

describe('openTrackedWhatsApp', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('skips the conversion when the browser blocks the tab', async () => {
    stubWindow(() => null);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await openTrackedWhatsApp('https://wa.me/5531994700201?text=Oi', { origin: 'bloqueado' });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(fireAdsContactConversion).not.toHaveBeenCalled();
  });

  it('opens the tab on the click and then loads the ref into it', async () => {
    const popup = {
      closed: false,
      opener: {},
      location: { href: 'about:blank' },
      close: vi.fn(),
    };
    stubWindow(() => popup as unknown as Window);
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ refCode: 'ABCD1234' }),
    })));

    await openTrackedWhatsApp('https://wa.me/5531994700201?text=Oi', { origin: 'aberto' });

    expect(fireAdsContactConversion).toHaveBeenCalledOnce();
    expect(popup.location.href).toContain('ABCD1234');
    expect(popup.location.href).toContain('wa.me');
  });

  it('still opens WhatsApp when Ads conversion throws', async () => {
    vi.mocked(fireAdsContactConversion).mockRejectedValueOnce(new Error('hash failed'));
    const popup = {
      closed: false,
      opener: {},
      location: { href: 'about:blank' },
      close: vi.fn(),
    };
    stubWindow(() => popup as unknown as Window);
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ refCode: null }),
    })));

    await openTrackedWhatsApp('https://wa.me/5531994700201?text=Oi', { origin: 'ads-erro' });

    expect(popup.location.href).toBe('https://wa.me/5531994700201?text=Oi');
  });

  it('opens WhatsApp without waiting forever when the ref request is slow', async () => {
    vi.useFakeTimers();
    const popup = {
      closed: false,
      opener: {},
      location: { href: 'about:blank' },
      close: vi.fn(),
    };
    stubWindow(() => popup as unknown as Window);
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));

    const openPromise = openTrackedWhatsApp('https://wa.me/5531994700201?text=Oi', {
      origin: 'ref-lento',
    });
    await vi.advanceTimersByTimeAsync(500);
    await openPromise;

    expect(popup.location.href).toBe('https://wa.me/5531994700201?text=Oi');
  });
});
