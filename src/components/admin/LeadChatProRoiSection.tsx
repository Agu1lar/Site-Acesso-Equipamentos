import { getTranslations } from 'next-intl/server';
import { AdminCallout } from '@/components/admin/AdminCallout';
import { AdminCard } from '@/components/admin/AdminCard';
import { ChatProRoiEvaluationHistory } from '@/components/admin/ChatProRoiEvaluationHistory';
import { ChatProRoiFrozenBadge } from '@/components/admin/ChatProRoiFrozenBadge';
import { formatDateTimeBrasilia } from '@/lib/app-datetime';
import { listChatProRoiEvaluationsForLead } from '@/lib/chatpro-roi-dashboard';
import { isRoiJourneyFrozen, leadHasCampaignAttribution } from '@/lib/chatpro-roi-eligibility';
import type { LeadRecord } from '@/lib/leads-admin';
import { LEAD_STATUSES, type LeadStatus } from '@/lib/lead-status';
import { Link } from '@/libs/I18nNavigation';

type LeadChatProRoiSectionProps = {
  lead: LeadRecord;
};

/**
 * Shows the latest Claude ROI evaluation for a campaign lead on the detail page.
 */
export async function LeadChatProRoiSection(props: LeadChatProRoiSectionProps) {
  const lead = props.lead;
  const isCampaignLead = leadHasCampaignAttribution({
    id: lead.id,
    status: lead.status,
    gclid: lead.gclid,
    gbraid: lead.gbraid,
    wbraid: lead.wbraid,
    utmSource: lead.utmSource,
    utmMedium: lead.utmMedium,
    utmCampaign: lead.utmCampaign,
    whatsappRepliedAt: lead.whatsappRepliedAt,
    lastActivityAt: lead.lastActivityAt,
    createdAt: lead.createdAt,
  });

  const evaluations = await listChatProRoiEvaluationsForLead(lead.id, 10);

  if (!isCampaignLead && evaluations.length === 0) {
    return null;
  }

  const t = await getTranslations('ChatProRoiAdminPage');
  const tLead = await getTranslations('LeadsAdminPage');
  const latest = evaluations[0];

  const stageLabels = {
    inquiry: t('stage_inquiry'),
    negotiation: t('stage_negotiation'),
    proposal_sent: t('stage_proposal_sent'),
    contract_sent: t('stage_contract_sent'),
    closed_won: t('stage_closed_won'),
    closed_lost: t('stage_closed_lost'),
    stalled: t('stage_stalled'),
    unknown: t('stage_unknown'),
  };

  const priorityLabels = {
    low: t('priority_low'),
    medium: t('priority_medium'),
    high: t('priority_high'),
  };

  const statusLabels = Object.fromEntries(
    LEAD_STATUSES.map((status) => [status, tLead(`status_${status}` as 'status_new')]),
  ) as Record<LeadStatus, string>;

  const crmStatusLabel = statusLabels[lead.status as LeadStatus] ?? lead.status;
  const frozen = isRoiJourneyFrozen({
    status: lead.status,
    lastEvaluationStage: latest?.stage,
  });

  return (
    <AdminCard title={tLead('section_chatpro_roi')}>
      <div className="space-y-4">
        <AdminCallout title={t('beta_title')} variant="warning">
          <p className="text-sm">{tLead('chatpro_roi_detail_hint')}</p>
        </AdminCallout>

        {frozen ? (
          <div className="flex flex-wrap items-center gap-2">
            <ChatProRoiFrozenBadge hint={t('frozen_hint')} label={t('frozen_badge')} />
            <p className="text-sm text-neutral-600">{t('frozen_hint')}</p>
          </div>
        ) : null}

        {latest ? (
          <>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {t('history_current_label')}
            </p>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-neutral-500">{t('col_stage')}</dt>
              <dd className="font-medium text-neutral-900">{stageLabels[latest.stage]}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">{t('col_likelihood')}</dt>
              <dd className="font-medium text-neutral-900">{latest.dealLikelihood}%</dd>
            </div>
            <div>
              <dt className="text-neutral-500">{t('col_priority')}</dt>
              <dd>{priorityLabels[latest.followUpPriority]}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">{t('col_evaluated_at')}</dt>
              <dd>{formatDateTimeBrasilia(latest.evaluatedAt)}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">{t('col_messages')}</dt>
              <dd>{latest.messageCount}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">{tLead('field_status')} (CRM)</dt>
              <dd>{crmStatusLabel}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">{t('col_suggested_status')}</dt>
              <dd>
                {latest.suggestedStatus ? (
                  <span title={t('suggested_status_hint')}>
                    {statusLabels[latest.suggestedStatus]}
                  </span>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            {latest.estimatedMonthlyValueBrl !== null && latest.estimatedMonthlyValueBrl > 0 ? (
              <div>
                <dt className="text-neutral-500">{t('col_estimated_value')}</dt>
                <dd>
                  {t('estimated_value_brl', { value: latest.estimatedMonthlyValueBrl })}
                </dd>
              </div>
            ) : null}
            {latest.contractDetected ? (
              <div>
                <dt className="text-neutral-500">{tLead('chatpro_roi_contract_detected')}</dt>
                <dd>{tLead('chatpro_roi_yes')}</dd>
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <dt className="text-neutral-500">{t('col_summary')}</dt>
              <dd className="mt-1 whitespace-pre-wrap text-neutral-700">{latest.summary || '—'}</dd>
            </div>
            </dl>
            <ChatProRoiEvaluationHistory
              labels={{
                title: t('history_title'),
                colStage: t('col_stage'),
                colLikelihood: t('col_likelihood'),
                colMessages: t('col_messages'),
                colSummary: t('col_summary'),
                colSuggestedStatus: t('col_suggested_status'),
                colEvaluatedAt: t('col_evaluated_at'),
                colEstimatedValue: t('col_estimated_value'),
                suggestedStatusHint: t('suggested_status_hint'),
                formatEstimatedValue: (value) => t('estimated_value_brl', { value }),
                stageLabels,
                statusLabels,
              }}
              previous={evaluations.slice(1)}
            />
          </>
        ) : (
          <p className="text-sm text-neutral-600">{tLead('chatpro_roi_pending')}</p>
        )}

        <Link className="text-sm font-medium text-primary hover:underline" href="/dashboard/chatpro-roi">
          {tLead('chatpro_roi_open_panel')}
        </Link>
      </div>
    </AdminCard>
  );
}
