import { describe, expect, it } from 'vitest';
import type { ClosedProposalToken } from '@/lib/closed-proposal';
import { acceptNameJudgements, decideClosedProposalMatch } from '@/lib/closed-proposal';

function trafficToken(phoneKey: string, leadId: number, extras?: Partial<ClosedProposalToken>): ClosedProposalToken {
  return {
    phoneKey,
    leadId,
    claimed: true,
    gclid: 'click',
    ...extras,
  };
}

describe('decideClosedProposalMatch', () => {
  it('matches one claimed traffic lead by phone', () => {
    expect(
      decideClosedProposalMatch({
        phones: ['(31) 99999-8877', ''],
        attendance: [{ phoneKey: '31988887766', name: 'Outra', phoneMatched: false }],
        tokens: [
          trafficToken('5531999998877', 42),
          trafficToken('5531999998877', 42, { gclid: null, utmMedium: 'cpc' }),
        ],
      }),
    ).toEqual({ kind: 'phone', leadId: 42 });
  });

  it('returns none when phone hits two lead ids', () => {
    expect(
      decideClosedProposalMatch({
        phones: ['31999998877', '31988887766'],
        attendance: [{ phoneKey: '31977776655', name: 'Ana', phoneMatched: false }],
        tokens: [trafficToken('31999998877', 1), trafficToken('31988887766', 2)],
      }),
    ).toEqual({ kind: 'none' });
  });

  it('returns none when no phone hits and names are absent', () => {
    expect(
      decideClosedProposalMatch({
        phones: ['31900000000'],
        attendance: [
          { phoneKey: '31999998877', name: 'Ana', phoneMatched: true },
          { phoneKey: '31988887766', name: '   ', phoneMatched: false },
        ],
        tokens: [trafficToken('31999998877', 9)],
      }),
    ).toEqual({ kind: 'none' });
  });

  it('caps unmatched attendance names at five', () => {
    const names = ['Ana', 'Bia', 'Caio', 'Duda', 'Enzo', 'Fabi'];
    const result = decideClosedProposalMatch({
      phones: [],
      attendance: [
        { phoneKey: '12', name: 'Curto', phoneMatched: false },
        ...names.map((name, index) => ({
          phoneKey: `3199991000${index}`,
          name: index === 0 ? '  Ana  ' : name,
          phoneMatched: false,
        })),
      ],
      tokens: [],
    });

    expect(result).toEqual({
      kind: 'needs_name',
      candidates: names.slice(0, 5).map((name, index) => ({
        phoneKey: `3199991000${index}`,
        name,
        phoneMatched: false,
      })),
    });
  });

  it('ignores an unclaimed token', () => {
    expect(
      decideClosedProposalMatch({
        phones: ['31999998877'],
        attendance: [],
        tokens: [{ phoneKey: '31999998877', leadId: 3, claimed: false, gclid: 'click' }],
      }),
    ).toEqual({ kind: 'none' });
  });

  it('ignores an organic utm token', () => {
    expect(
      decideClosedProposalMatch({
        phones: ['31999998877'],
        attendance: [],
        tokens: [{ phoneKey: '31999998877', leadId: 3, claimed: true, utmMedium: 'organic' }],
      }),
    ).toEqual({ kind: 'none' });
  });
});

describe('acceptNameJudgements', () => {
  it('accepts one same-account judgement for one traffic lead', () => {
    expect(
      acceptNameJudgements(
        [{ phoneKey: '(31) 99999-8877', name: 'Ana', phoneMatched: false }],
        ['same_account'],
        [trafficToken('5531999998877', 7), trafficToken('5531999998877', 7, { gclid: null, utmMedium: 'cpc' })],
      ),
    ).toEqual({ kind: 'ai', leadId: 7 });
  });

  it('rejects two same-account judgements', () => {
    expect(
      acceptNameJudgements(
        [
          { phoneKey: '31999998877', name: 'Ana', phoneMatched: false },
          { phoneKey: '31988887766', name: 'Bia', phoneMatched: false },
        ],
        ['same_account', 'same_account'],
        [trafficToken('31999998877', 1), trafficToken('31988887766', 2)],
      ),
    ).toEqual({ kind: 'none' });
  });

  it('returns none when the accepted name maps to two lead ids', () => {
    expect(
      acceptNameJudgements(
        [{ phoneKey: '31999998877', name: 'Ana', phoneMatched: false }],
        ['same_account'],
        [trafficToken('31999998877', 1), trafficToken('31999998877', 2)],
      ),
    ).toEqual({ kind: 'none' });
  });
});
