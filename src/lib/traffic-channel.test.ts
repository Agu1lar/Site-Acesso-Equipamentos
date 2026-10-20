import { describe, expect, it } from 'vitest';
import {
  classifyTrafficChannel,
  classifyPaidPlatform,
  formatTrafficChannelLabel,
  parseTrafficChannelParam,
  tallyTrafficChannels,
} from '@/lib/traffic-channel';

describe('classifyTrafficChannel', () => {
  it('marks google ads click ids as paid', () => {
    expect(classifyTrafficChannel({ gclid: 'CjwKCAjw' })).toBe('paid');
    expect(classifyTrafficChannel({ gbraid: 'abc' })).toBe('paid');
    expect(classifyTrafficChannel({ wbraid: 'xyz' })).toBe('paid');
  });

  it('marks paid utm medium as paid', () => {
    expect(classifyTrafficChannel({ utmMedium: 'cpc' })).toBe('paid');
    expect(classifyTrafficChannel({ utmMedium: 'paid_social' })).toBe('paid');
    expect(classifyTrafficChannel({ utmSource: 'google', utmMedium: 'cpc' })).toBe('paid');
  });

  it('marks google organic as organic', () => {
    expect(classifyTrafficChannel({ utmSource: 'google', utmMedium: 'organic' })).toBe('organic');
    expect(classifyTrafficChannel({ utmSource: 'google' })).toBe('organic');
  });

  it('marks search engine referrers as organic', () => {
    expect(classifyTrafficChannel({ referrer: 'https://www.google.com/search?q=plataforma' })).toBe(
      'organic',
    );
  });

  it('marks empty attribution as direct', () => {
    expect(classifyTrafficChannel({})).toBe('direct');
    expect(classifyTrafficChannel({ referrer: 'https://acessoequipamentos.com.br/equipamentos' })).toBe(
      'direct',
    );
  });

  it('prefers paid over organic when both signals exist', () => {
    expect(
      classifyTrafficChannel({
        utmSource: 'google',
        utmMedium: 'organic',
        gclid: 'Cjw',
      }),
    ).toBe('paid');
  });
});

describe('formatTrafficChannelLabel', () => {
  it('returns Portuguese channel names', () => {
    expect(formatTrafficChannelLabel({ gclid: '1' })).toBe('Google Ads');
    expect(formatTrafficChannelLabel({ utmSource: 'google' })).toBe('Orgânico');
    expect(formatTrafficChannelLabel({})).toBe('Direto');
  });
});

describe('parseTrafficChannelParam', () => {
  it('accepts English and Portuguese values', () => {
    expect(parseTrafficChannelParam('paga')).toBe('paid');
    expect(parseTrafficChannelParam('Orgânico')).toBe('organic');
    expect(parseTrafficChannelParam('direto')).toBe('direct');
    expect(parseTrafficChannelParam('site-orcamento')).toBeNull();
  });
});

describe('tallyTrafficChannels', () => {
  it('separates ad platforms without treating organic social visits as ads', () => {
    expect(classifyPaidPlatform({ utmSource: 'facebook', utmMedium: 'social' })).toBeNull();
    expect(classifyPaidPlatform({ utmSource: 'ig', utmMedium: 'paid_social' })).toBe('metaAds');
    expect(classifyPaidPlatform({ utmSource: 'meta', utmMedium: 'paid_social', gclid: '1' })).toBe('googleAds');
    const counts = tallyTrafficChannels([
      { utmSource: 'google', utmMedium: 'cpc' },
      { utmSource: 'facebook', utmMedium: 'paid_social' },
      { utmSource: 'instagram', utmMedium: 'paid_social' },
      { utmSource: 'linkedin', utmMedium: 'cpc' },
      { utmSource: 'facebook', utmMedium: 'social' },
    ]);
    expect(counts).toMatchObject({ paid: 4, googleAds: 1, metaAds: 2, otherPaid: 1, organic: 1 });
    expect(counts.paid).toBe(counts.googleAds + counts.metaAds + counts.otherPaid);
  });
  it('splits rows into geral and the three channels', () => {
    expect(
      tallyTrafficChannels([
        { gclid: '1' },
        { utmSource: 'google', utmMedium: 'organic' },
        {},
        {},
      ]),
    ).toStrictEqual({
      googleAds: 1,
      metaAds: 0,
      otherPaid: 0,
      total: 4,
      paid: 1,
      organic: 1,
      direct: 2,
    });
  });
});
