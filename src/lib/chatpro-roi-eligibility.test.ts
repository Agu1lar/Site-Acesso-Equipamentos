import { describe, expect, it } from 'vitest';
import {
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

  it('returns false without attribution', () => {
    expect(leadHasCampaignAttribution(baseLead)).toBe(false);
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

  it('skips terminal lead without new messages', () => {
    expect(
      shouldEvaluateLeadForRoi(
        { ...baseLead, gclid: 'x', status: 'won' },
        5,
        false,
      ),
    ).toBe(false);
  });
});
