import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/libs/Env', () => ({ Env: { NEXT_PUBLIC_META_PIXEL_ID: '123456' } }));

describe('Meta Pixel consent and conversion tracking', () => {
  let consent: string | null;
  const pixel = vi.fn();
  beforeEach(() => {
    vi.resetModules();
    pixel.mockClear();
    consent = 'analytics';
    const session = new Map<string, string>();
    vi.stubGlobal('window', {
      fbq: pixel,
      localStorage: { getItem: () => consent },
      sessionStorage: {
        getItem: (key: string) => session.get(key) ?? null,
        setItem: (key: string, value: string) => session.set(key, value),
      },
      location: { pathname: '/' },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends no events before consent or after withdrawal', async () => {
    const { captureMetaContact, captureMetaPageView, revokeMetaPixelConsent } = await import('@/lib/meta-pixel');
    consent = 'essential';
    captureMetaPageView('/');
    expect(captureMetaContact({ source: 'whatsapp' })).toBe(false);
    expect(pixel).not.toHaveBeenCalled();
    consent = 'analytics';
    captureMetaPageView('/');
    revokeMetaPixelConsent();
    consent = null;
    pixel.mockClear();
    captureMetaContact({ source: 'quote' });
    expect(pixel).not.toHaveBeenCalled();
  });

  it('counts route changes once and excludes private dashboard pages', async () => {
    const { captureMetaPageView } = await import('@/lib/meta-pixel');
    captureMetaPageView('/');
    captureMetaPageView('/');
    captureMetaPageView('/equipamentos');
    captureMetaPageView('/dashboard');
    expect(pixel.mock.calls.filter(args => args[0] === 'track')).toEqual([
      ['track', 'PageView'], ['track', 'PageView'],
    ]);
  });

  it('deduplicates attempts without reporting them as confirmed conversions', async () => {
    const { captureMetaContact } = await import('@/lib/meta-pixel');
    expect(captureMetaContact({ source: 'whatsapp' })).toBe(true);
    expect(captureMetaContact({ source: 'whatsapp' })).toBe(false);
    expect(captureMetaContact({ source: 'quote' })).toBe(true);
    expect(pixel.mock.calls.filter(args => args[0] === 'trackCustom')).toEqual([
      ['trackCustom', 'WhatsAppButtonClick', { contact_channel: 'whatsapp' }],
      ['trackCustom', 'QuoteFormSubmitted', { contact_channel: 'quote' }],
    ]);
    expect(pixel.mock.calls.some(args => args[0] === 'track' && ['Lead', 'Contact', 'Purchase'].includes(args[1]))).toBe(false);
  });
});
