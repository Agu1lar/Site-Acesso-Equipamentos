import { describe, expect, it } from 'vitest';
import {
  isRoiJourneyFrozen,
  leadHasCampaignAttribution,
  shouldEvaluateLeadForRoi,
} from '@/lib/chatpro-roi-eligibility';

const baseLead = {
  id: 1,
  status: 'contacted',
  gclid: null,
  gbraid: null,
  wbraid: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  whatsappRepliedAt: new Date('2026-08-01'),
  lastActivityAt: new Date('2026-08-10'),
  createdAt: new Date('2026-08-01'),
};

describe('leadHasCampaignAttribution', () => {
  it('detects gclid', () => {
    expect(leadHasCampaignAttribution({ ...baseLead, gclid: 'abc' })).toBe(true);
  });

  it('detects gbraid and wbraid', () => {
    expect(leadHasCampaignAttribution({ ...baseLead, gbraid: 'abc' })).toBe(true);
    expect(leadHasCampaignAttribution({ ...baseLead, wbraid: 'abc' })).toBe(true);
  });

  it('detects paid medium', () => {
    expect(leadHasCampaignAttribution({ ...baseLead, utmMedium: 'cpc' })).toBe(true);
  });

  it('ignores utm campaign without paid signal', () => {
    expect(leadHasCampaignAttribution({ ...baseLead, utmCampaign: 'plataformas-mg' })).toBe(false);
  });

  it('ignores google source without paid medium', () => {
    expect(
      leadHasCampaignAttribution({
        ...baseLead,
        utmSource: 'google',
        utmMedium: 'organic',
      }),
    ).toBe(false);
  });

  it('returns false without attribution', () => {
    expect(leadHasCampaignAttribution(baseLead)).toBe(false);
  });
});

describe('isRoiJourneyFrozen', () => {
  it('freezes after CRM won or lost', () => {
    expect(isRoiJourneyFrozen({ status: 'won' })).toBe(true);
    expect(isRoiJourneyFrozen({ status: 'lost' })).toBe(true);
  });

  it('freezes after Claude closed_won or closed_lost', () => {
    expect(isRoiJourneyFrozen({ status: 'contacted', lastEvaluationStage: 'closed_won' })).toBe(true);
    expect(isRoiJourneyFrozen({ status: 'quoted', lastEvaluationStage: 'closed_lost' })).toBe(true);
  });

  it('stays open while journey is active', () => {
    expect(isRoiJourneyFrozen({ status: 'contacted', lastEvaluationStage: 'negotiation' })).toBe(false);
  });
});

describe('shouldEvaluateLeadForRoi', () => {
  it('evaluates campaign lead with new messages', () => {
    expect(
      shouldEvaluateLeadForRoi(
        { ...baseLead, gclid: 'x' },
        3,
        true,
      ),
    ).toBe(true);
  });

  it('skips lead without campaign', () => {
    expect(shouldEvaluateLeadForRoi(baseLead, 2, true)).toBe(false);
  });

  it('skips frozen journey even with new messages', () => {
    expect(
      shouldEvaluateLeadForRoi(
        { ...baseLead, gclid: 'x', status: 'won' },
        5,
        true,
      ),
    ).toBe(false);
    expect(
      shouldEvaluateLeadForRoi(
        { ...baseLead, gclid: 'x', status: 'contacted' },
        5,
        true,
        {},
        'closed_won',
      ),
    ).toBe(false);
  });

  it('skips terminal lead without new messages', () => {
    expect(
      shouldEvaluateLeadForRoi(
        { ...baseLead, gclid: 'x', status: 'won' },
        5,
        false,
      ),
    ).toBe(false);
  });

  it('skips open campaign lead without new messages', () => {
    expect(
      shouldEvaluateLeadForRoi(
        { ...baseLead, gclid: 'x', status: 'contacted' },
        5,
        false,
      ),
    ).toBe(false);
  });
});
