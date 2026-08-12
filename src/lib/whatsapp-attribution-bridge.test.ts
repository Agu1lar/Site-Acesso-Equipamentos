import { describe, expect, it } from 'vitest';
import {
  appendWhatsAppAttributionRefToUrl,
  attributionQualifiesForWhatsAppBridge,
  extractWhatsAppAttributionRefCode,
} from '@/lib/whatsapp-attribution-bridge';

describe('attributionQualifiesForWhatsAppBridge', () => {
  it('accepts paid click ids and paid medium', () => {
    expect(attributionQualifiesForWhatsAppBridge({ gclid: 'abc' })).toBe(true);
    expect(attributionQualifiesForWhatsAppBridge({ utmMedium: 'cpc' })).toBe(true);
  });

  it('rejects utm campaign without paid signal', () => {
    expect(attributionQualifiesForWhatsAppBridge({ utmCampaign: 'nova_plataformas' })).toBe(false);
  });
});

describe('extractWhatsAppAttributionRefCode', () => {
  it('parses ref code from prefilled message', () => {
    const text =
      'Olá! Tenho interesse na locação. Origem: site-home. Cód. AB12CD34';
    expect(extractWhatsAppAttributionRefCode(text)).toBe('AB12CD34');
  });

  it('returns null without ref code', () => {
    expect(extractWhatsAppAttributionRefCode('Olá, quero orçamento')).toBeNull();
  });
});

describe('appendWhatsAppAttributionRefToUrl', () => {
  it('appends suffix to wa.me text param', () => {
    const href = 'https://wa.me/5531994700201?text=Ol%C3%A1';
    const updated = appendWhatsAppAttributionRefToUrl(href, 'AB12CD34');
    expect(updated).toContain('AB12CD34');
    expect(updated).toContain('C%C3%B3d.');
  });
});
