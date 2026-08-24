import { describe, expect, it } from 'vitest';
import { countLatestClosedWonSignals } from '@/lib/chatpro-roi-summary';

describe('countLatestClosedWonSignals', () => {
  it('ignores an older won evaluation after a loss correction', () => {
    const count = countLatestClosedWonSignals([
      { leadId: 76, result: { stage: 'closed_lost' } },
      { leadId: 76, result: { stage: 'closed_won' } },
    ]);

    expect(count).toBe(0);
  });

  it('counts only the latest evaluation for each lead', () => {
    const count = countLatestClosedWonSignals([
      { leadId: 80, result: { stage: 'closed_won' } },
      { leadId: 80, result: { stage: 'negotiation' } },
      { leadId: 81, result: { stage: 'closed_lost' } },
    ]);

    expect(count).toBe(1);
  });
});
