import { describe, expect, it } from 'vitest';
import {
  countWhatsAppClicksForPeriod,
  getOperationalDashboard,
  probeAnalyticsDashboard,
} from '@/lib/analytics-admin';
import { parseAnalyticsDashboardFailure } from '@/lib/analytics-dashboard-errors';

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

function formatProbeFailure(steps: Awaited<ReturnType<typeof probeAnalyticsDashboard>>['steps']) {
  return steps
    .filter((step) => step.status === 'error')
    .map((step) => `${step.id}: ${step.error ?? 'unknown'}${step.cause ? ` | ${step.cause}` : ''}`)
    .join('\n');
}

describe.skipIf(!hasDatabase)('analytics dashboard load', () => {
  it('probe passes every analytics query step', async () => {
    const probe = await probeAnalyticsDashboard();

    if (!probe.ok) {
      throw new Error(
        `Probe failed at step "${probe.failedStepId}":\n${formatProbeFailure(probe.steps)}`,
      );
    }

    expect(probe.steps.length).toBeGreaterThan(0);
    expect(probe.steps.every((step) => step.status === 'ok')).toBe(true);
  });

  it('loads full dashboard without throwing', async () => {
    let error: unknown;
    let dashboard;

    try {
      dashboard = await getOperationalDashboard();
    } catch (caught) {
      error = caught;
    }

    if (error) {
      const failure = parseAnalyticsDashboardFailure(error);
      throw new Error(
        `Dashboard failed${failure.stepId ? ` at ${failure.stepId}` : ''}: ${failure.message}${
          failure.cause ? ` | ${failure.cause}` : ''
        }`,
      );
    }

    expect(dashboard?.period.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('counts WhatsApp clicks without throwing', async () => {
    const clicks = await countWhatsAppClicksForPeriod();
    expect(clicks).toBeGreaterThanOrEqual(0);
  });
});
