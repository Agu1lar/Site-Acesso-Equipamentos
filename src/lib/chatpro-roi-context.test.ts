import { describe, expect, it } from 'vitest';
import { isLeadEligibleForClaudeAnalysis } from '@/lib/chatpro-roi-context';
import type { CampaignLeadSnapshot } from '@/lib/chatpro-roi-eligibility';

const baseLead: CampaignLeadSnapshot = {
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

describe('isLeadEligibleForClaudeAnalysis', () => {
  it('allows campaign-attributed leads', () => {
    expect(isLeadEligibleForClaudeAnalysis({ ...baseLead, gclid: 'abc' })).toBe(true);
    expect(isLeadEligibleForClaudeAnalysis({ ...baseLead, utmMedium: 'cpc' })).toBe(true);
  });

  it('blocks organic leads', () => {
    expect(isLeadEligibleForClaudeAnalysis(baseLead)).toBe(false);
    expect(isLeadEligibleForClaudeAnalysis({ ...baseLead, utmSource: 'direct' })).toBe(false);
    expect(isLeadEligibleForClaudeAnalysis({ ...baseLead, utmCampaign: 'nova_plataformas' })).toBe(
      false,
    );
  });
});
