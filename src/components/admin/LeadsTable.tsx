import { formatDateTimeBrasilia } from '@/lib/app-datetime';
import { getTranslations } from 'next-intl/server';
import { LEAD_STATUSES } from '@/lib/lead-status';
import type { LeadStatus } from '@/lib/lead-status';
import { scoreLeadIntent } from '@/lib/lead-intent-score';
import type { LeadRecord } from '@/lib/leads-admin';
import { formatLeadCartItems } from '@/lib/leads-admin';
import { leadActivityTimestamp } from '@/lib/lead-contact';
import { AdminCard } from '@/components/admin/AdminCard';
import { LeadPriorityBadge } from '@/components/admin/LeadPriorityBadge';
import { LeadRecurringBadge } from '@/components/admin/LeadRecurringBadge';
import { LeadWhatsAppBadge } from '@/components/admin/LeadWhatsAppBadge';
import { Link } from '@/libs/I18nNavigation';
import { resolveLeadWhatsAppStatus } from '@/lib/lead-whatsapp-status';

type LeadsTableProps = {
  leads: LeadRecord[];
  contactOrderCounts: Map<number, number>;
};
export async function LeadsTable(props: LeadsTableProps) {
  const { leads, contactOrderCounts } = props;
  const t = await getTranslations('LeadsAdminPage');

  if (leads.length === 0) {
    return (
      <AdminCard>
        <p className="py-6 text-center text-sm text-neutral-500">{t('empty_list')}</p>
      </AdminCard>
    );
  }

  return (
    <AdminCard padding={false}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50/80 text-neutral-600">
            <tr>
              <th className="px-4 py-3 font-semibold">{t('col_date')}</th>
              <th className="px-4 py-3 font-semibold">{t('col_name')}</th>
              <th className="px-4 py-3 font-semibold">{t('col_priority')}</th>
              <th className="px-4 py-3 font-semibold">{t('col_city')}</th>
              <th className="px-4 py-3 font-semibold">{t('col_items')}</th>
              <th className="px-4 py-3 font-semibold">{t('col_whatsapp')}</th>
              <th className="px-4 py-3 font-semibold">{t('col_origin')}</th>
              <th className="px-4 py-3 font-semibold">{t('col_kind')}</th>
              <th className="px-4 py-3 font-semibold">{t('col_status')}</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {leads.map((lead) => {
              const itemsSummary = (formatLeadCartItems(lead.itemsJson) || lead.equipmentName) ?? '—';
              const statusKey = LEAD_STATUSES.includes(lead.status as LeadStatus)
                ? (`status_${lead.status}` as 'status_new')
                : 'status_new';
              const kindKey =
                lead.leadKind === 'cookie_consent'
                  ? 'lead_kind_cookie_consent'
                  : 'lead_kind_quote';
              const intent = scoreLeadIntent(lead);
              const priorityKey =
                intent.tier === 'hot'
                  ? 'priority_hot'
                  : intent.tier === 'warm'
                    ? 'priority_warm'
                    : 'priority_cold';
              const contactCount = contactOrderCounts.get(lead.id) ?? 1;
              const activityAt = new Date(leadActivityTimestamp(lead));
              const whatsappStatus = resolveLeadWhatsAppStatus(lead);
              const whatsappLabel =
                whatsappStatus === 'replied'
                  ? t('whatsapp_status_replied')
                  : whatsappStatus === 'opened'
                    ? t('whatsapp_status_opened')
                    : whatsappStatus === 'blocked'
                      ? t('whatsapp_status_blocked')
                      : whatsappStatus === 'not_applicable'
                        ? t('whatsapp_status_not_applicable')
                        : t('whatsapp_status_unknown');
              return (
                <tr className="transition-colors hover:bg-neutral-50/80" key={lead.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-neutral-600">
                    {formatDateTimeBrasilia(activityAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-neutral-900">{lead.name}</p>
                      <LeadRecurringBadge
                        count={contactCount}
                        label={t('recurring_badge', { count: contactCount })}
                      />
                    </div>
                    <p className="text-xs text-neutral-500">{lead.phone ?? lead.email ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <LeadPriorityBadge
                      label={t(priorityKey)}
                      score={intent.score}
                      tier={intent.tier}
                    />
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{lead.city ?? '—'}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-neutral-700" title={itemsSummary}>
                    {itemsSummary}
                  </td>
                  <td className="px-4 py-3">
                    <LeadWhatsAppBadge compact label={whatsappLabel} status={whatsappStatus} />
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <p className="text-neutral-700">{lead.origin}</p>
                    {lead.utmSource ? (
                      <p className="mt-0.5 text-neutral-500">utm: {lead.utmSource}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-600">{t(kindKey)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                      {t(statusKey)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      className="font-medium text-primary hover:underline"
                      href={`/dashboard/leads/${lead.id}`}
                    >
                      {t('view_detail')}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminCard>
  );
}
