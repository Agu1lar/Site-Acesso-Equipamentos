import { describe, expect, it } from 'vitest';
import { classifyTrafficChannel, tallyTrafficChannels } from '@/lib/traffic-channel';

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

describe('tallyTrafficChannels', () => {
  it('splits rows into geral and the three channels', () => {
    expect(
      tallyTrafficChannels([
        { gclid: '1' },
        { utmSource: 'google', utmMedium: 'organic' },
        {},
        {},
      ]),
    ).toStrictEqual({
      total: 4,
      paid: 1,
      organic: 1,
      direct: 2,
    });
  });
});
