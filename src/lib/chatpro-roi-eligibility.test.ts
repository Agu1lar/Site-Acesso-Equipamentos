import { describe, expect, it } from 'vitest';
import {
  leadHasCampaignAttribution,
  shouldEvaluateLeadForRoi,
} from '@/lib/chatpro-roi-eligibility';

const baseLead = {
  id: 1,
  status: 'contacted',
  gclid: null,
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

  it('detects utm campaign', () => {
    expect(leadHasCampaignAttribution({ ...baseLead, utmCampaign: 'plataformas-mg' })).toBe(true);
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
