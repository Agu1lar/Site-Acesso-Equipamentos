import { getTranslations } from 'next-intl/server';
import { AdminCallout } from '@/components/admin/AdminCallout';
import { LeadPriorityBadge } from '@/components/admin/LeadPriorityBadge';
import { hoursSinceLeadActivity } from '@/lib/leads-stale-alert';
import type { LeadIntentTier } from '@/lib/lead-intent-score';
import type { StaleLeadsSummary } from '@/lib/leads-stale-alert';
import { Link } from '@/libs/I18nNavigation';

type StaleLeadsAlertProps = {
  summary: StaleLeadsSummary;
};

function tierLabelKey(tier: LeadIntentTier) {
  if (tier === 'hot') {
    return 'priority_hot' as const;
  }
  if (tier === 'warm') {
    return 'priority_warm' as const;
  }
  return 'priority_cold' as const;
}

/**
 * Warns when new leads have waited too long without contact.
 */
export async function StaleLeadsAlert(props: StaleLeadsAlertProps) {
  const { summary } = props;
  if (summary.total === 0) {
    return null;
  }

  const t = await getTranslations('LeadsAdminPage');
  const remaining = summary.total - summary.leads.length;

  return (
    <AdminCallout title={t('stale_alert_title')} variant="warning">
      <p>{t('stale_alert_summary', { count: summary.total, hours: summary.thresholdHours })}</p>
      <ul className="mt-3 space-y-2">
        {summary.leads.map((lead) => (
          <li
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/80 bg-white/60 px-3 py-2"
            key={lead.id}
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="font-medium text-neutral-900">{lead.name}</span>
              <LeadPriorityBadge
                label={t(tierLabelKey(lead.tier))}
                score={lead.score}
                tier={lead.tier}
              />
              <span className="text-sm text-amber-900/80">
                {t('stale_alert_waiting', { hours: hoursSinceLeadActivity(lead) })}
              </span>
            </div>
            <Link
              className="shrink-0 text-sm font-medium text-primary hover:underline"
              href={`/dashboard/leads/${lead.id}`}
            >
              {t('view_detail')}
            </Link>
          </li>
        ))}
      </ul>
      {remaining > 0 ? (
        <p className="mt-2 text-xs opacity-80">{t('stale_alert_more', { count: remaining })}</p>
      ) : null}
    </AdminCallout>
  );
}
