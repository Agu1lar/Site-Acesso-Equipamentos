import { describe, expect, it } from 'vitest';
import { buildWhatsAppClickAnalyticsPayload } from '@/lib/track-whatsapp-click';

describe('buildWhatsAppClickAnalyticsPayload', () => {
  it('keeps essential campaign attribution without analytics consent', () => {
    const payload = buildWhatsAppClickAnalyticsPayload({
      origin: 'site-home',
      pathname: '/equipamentos',
      device: 'mobile',
      analyticsConsent: false,
      attribution: {
        gclid: 'secret',
        utmSource: 'google',
        utmCampaign: 'guindaste',
        landingPage: '/categorias/guindaste-industrial?gclid=secret',
      },
      visitorGeo: { geoCity: 'Belo Horizonte', geoRegion: 'MG' },
    });

    expect(payload.analyticsConsent).toBe(false);
    expect(payload.origin).toBe('site-home');
    expect(payload.attribution?.gclid).toBe('secret');
    expect(payload.attribution?.utmCampaign).toBe('guindaste');
    expect(payload.attribution?.landingPage).toContain('guindaste');
    expect(payload.visitorGeo).toBeUndefined();
  });

  it('omits geo and bare non-campaign attribution without analytics consent', () => {
    const payload = buildWhatsAppClickAnalyticsPayload({
      origin: 'site-home',
      pathname: '/',
      device: 'desktop',
      analyticsConsent: false,
      attribution: { landingPage: '/', referrer: 'https://example.com' },
      visitorGeo: { geoCity: 'BH', geoRegion: 'MG' },
    });

    expect(payload.attribution).toBeUndefined();
    expect(payload.visitorGeo).toBeUndefined();
  });

  it('keeps attribution and geo when analytics consent is granted', () => {
    const payload = buildWhatsAppClickAnalyticsPayload({
      origin: 'site-orcamento-envio',
      equipmentSlug: 'tesoura',
      pathname: '/orcamento',
      device: 'desktop',
      analyticsConsent: true,
      attribution: { gclid: 'abc', utmSource: 'google' },
      visitorGeo: { geoCity: 'Contagem', geoRegion: 'MG' },
    });

    expect(payload.analyticsConsent).toBe(true);
    expect(payload.attribution?.gclid).toBe('abc');
    expect(payload.visitorGeo?.geoCity).toBe('Contagem');
  });
});
