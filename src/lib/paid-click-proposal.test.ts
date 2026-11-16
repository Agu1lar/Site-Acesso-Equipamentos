import { describe, expect, it } from 'vitest';
import { isAugustBulkImport, matchProposalToPaidClick, proposalPhoneKey, uniquePaidClicks } from '@/lib/paid-click-proposal';

const click = new Date('2026-07-06T22:40:41.935Z');

describe('paid click proposal', () => {
  it('reads the same 8 digits with country code and the mobile 9', () => {
    expect(proposalPhoneKey('(31) 91111-2222')).toBe('11112222');
    expect(proposalPhoneKey('5531911112222')).toBe('11112222');
    expect(proposalPhoneKey('123')).toBeNull();
  });

  it('keeps the same phone when a closed journey created a second lead', () => {
    const clicks = uniquePaidClicks([
      {
        identity: 'lead:1',
        phone: '31911112222',
        clickedAt: click,
        leadId: 1,
        attribution: { gclid: 'a' },
      },
      {
        identity: 'lead:2',
        phone: '5531911112222',
        clickedAt: new Date('2026-08-01T12:00:00.000Z'),
        leadId: 2,
        attribution: { gclid: 'b' },
      },
    ]);
    expect(clicks).toEqual([{ prefix: '11112222', clickedAt: click, leadId: 1 }]);
  });

  it('keeps the lead when the earliest click has no lead id', () => {
    const clicks = uniquePaidClicks([
      {
        identity: 'token:1',
        phone: '31911112222',
        clickedAt: click,
        leadId: null,
        attribution: { gclid: 'a' },
      },
      {
        identity: 'lead:4',
        phone: '5531911112222',
        clickedAt: new Date('2026-08-01T12:00:00.000Z'),
        leadId: 4,
        attribution: { gclid: 'b' },
      },
    ]);
    expect(clicks).toEqual([{ prefix: '11112222', clickedAt: click, leadId: 4 }]);
  });

  it('drops a prefix shared by two different numbers', () => {
    const clicks = uniquePaidClicks([
      {
        identity: 'lead:1',
        phone: '31911112222',
        clickedAt: click,
        leadId: 1,
        attribution: { gclid: 'a' },
      },
      {
        identity: 'lead:2',
        phone: '11911112222',
        clickedAt: click,
        leadId: 2,
        attribution: { gclid: 'b' },
      },
    ]);
    expect(clicks).toEqual([]);
  });

  it('counts a proposal created after the paid click', () => {
    expect(
      matchProposalToPaidClick({
        createdAt: new Date('2026-08-01T12:00:00.000Z'),
        phones: ['(31) 91111-2222'],
        clicks: [{ prefix: '11112222', clickedAt: click, leadId: 4 }],
      }),
    ).toEqual({ traffic: true, leadId: 4 });
  });

  it('leaves out a proposal created before the click', () => {
    expect(
      matchProposalToPaidClick({
        createdAt: new Date('2026-06-01T12:00:00.000Z'),
        phones: ['31911112222'],
        clicks: [{ prefix: '11112222', clickedAt: click, leadId: 4 }],
      }),
    ).toEqual({ traffic: false, leadId: null });
  });

  it('leaves out the 14 Aug 2026 bulk import', () => {
    expect(isAugustBulkImport(new Date('2026-08-14T03:00:00.000Z'), '1042-01')).toBe(true);
    expect(isAugustBulkImport(new Date('2026-08-14T00:30:00.000Z'), '1042-01')).toBe(false);
    expect(
      matchProposalToPaidClick({
        createdAt: new Date('2026-08-14T03:00:00.000Z'),
        numero: '1042-01',
        phones: ['31911112222'],
        clicks: [{ prefix: '11112222', clickedAt: click, leadId: 4 }],
      }),
    ).toEqual({ traffic: false, leadId: null });
  });
});
