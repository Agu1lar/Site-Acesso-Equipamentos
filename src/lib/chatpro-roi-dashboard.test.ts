import { describe, expect, it } from 'vitest';
import type { ChatProRoiDashboardEvaluation } from '@/lib/chatpro-roi-dashboard-types';
import { groupChatProRoiEvaluationsByLead } from '@/lib/chatpro-roi-group';

function makeEval(
  overrides: Partial<ChatProRoiDashboardEvaluation> & Pick<ChatProRoiDashboardEvaluation, 'id' | 'leadId'>,
): ChatProRoiDashboardEvaluation {
  return {
    leadName: `Lead ${overrides.leadId}`,
    leadStatus: 'contacted',
    utmCampaign: null,
    evaluatedAt: new Date('2026-08-13T15:00:00.000Z'),
    messageCount: 1,
    trigger: 'local_consumer',
    stage: 'inquiry',
    dealLikelihood: 30,
    followUpPriority: 'medium',
    suggestedStatus: 'contacted',
    divertedToPhone: null,
    contractDetected: false,
    estimatedMonthlyValueBrl: null,
    summary: 'resumo',
    ...overrides,
  };
}

describe('groupChatProRoiEvaluationsByLead', () => {
  it('packs same lead evaluations into one group with history', () => {
    const rows = [
      makeEval({ id: 3, leadId: 68, messageCount: 24, evaluatedAt: new Date('2026-08-13T15:46:00Z') }),
      makeEval({ id: 2, leadId: 68, messageCount: 24, evaluatedAt: new Date('2026-08-13T15:46:00Z') }),
      makeEval({ id: 1, leadId: 68, messageCount: 21, evaluatedAt: new Date('2026-08-13T15:02:00Z') }),
      makeEval({ id: 4, leadId: 66, messageCount: 5, evaluatedAt: new Date('2026-08-13T13:47:00Z') }),
    ];

    const groups = groupChatProRoiEvaluationsByLead(rows, 30);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.leadId).toBe(68);
    expect(groups[0]?.latest.id).toBe(3);
    expect(groups[0]?.previous.map((row) => row.id)).toEqual([2, 1]);
    expect(groups[1]?.leadId).toBe(66);
    expect(groups[1]?.previous).toEqual([]);
  });

  it('respects lead limit after grouping', () => {
    const rows = [
      makeEval({ id: 10, leadId: 1, evaluatedAt: new Date('2026-08-13T16:00:00Z') }),
      makeEval({ id: 11, leadId: 2, evaluatedAt: new Date('2026-08-13T15:00:00Z') }),
      makeEval({ id: 12, leadId: 3, evaluatedAt: new Date('2026-08-13T14:00:00Z') }),
    ];

    expect(groupChatProRoiEvaluationsByLead(rows, 2)).toHaveLength(2);
  });
});
