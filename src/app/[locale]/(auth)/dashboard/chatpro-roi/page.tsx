import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminCallout } from '@/components/admin/AdminCallout';
import { AdminKpiCard } from '@/components/admin/AdminKpiCard';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { ChatProRoiEvaluationsTable } from '@/components/admin/ChatProRoiEvaluationsTable';
import { getChatProRoiDashboardSummary } from '@/lib/chatpro-roi-dashboard';
import { Link } from '@/libs/I18nNavigation';
import { resolveAppLocale } from '@/utils/locale';

type ChatProRoiPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata(props: ChatProRoiPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'ChatProRoiAdminPage',
  });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function ChatProRoiAdminPage(props: ChatProRoiPageProps) {
  const { locale } = await props.params;
  const searchParams = await props.searchParams;
  setRequestLocale(resolveAppLocale(locale));
  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'ChatProRoiAdminPage',
  });
  const tLead = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'LeadsAdminPage',
  });

  const requestedPage = Number.parseInt(searchParams.page ?? '1', 10);
  const summary = await getChatProRoiDashboardSummary({
    limit: 30,
    page: Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  });

  const statusLabels = {
    new: tLead('status_new'),
    contacted: tLead('status_contacted'),
    quoted: tLead('status_quoted'),
    won: tLead('status_won'),
    lost: tLead('status_lost'),
  } as const;

  const stageLabels = {
    inquiry: t('stage_inquiry'),
    negotiation: t('stage_negotiation'),
    proposal_sent: t('stage_proposal_sent'),
    contract_sent: t('stage_contract_sent'),
    closed_won: t('stage_closed_won'),
    closed_lost: t('stage_closed_lost'),
    stalled: t('stage_stalled'),
    diverted: t('stage_diverted'),
    unknown: t('stage_unknown'),
  };

  const priorityLabels = {
    low: t('priority_low'),
    medium: t('priority_medium'),
    high: t('priority_high'),
  };

  return (
    <div className="space-y-8">
      <AdminPageHeader description={t('description')} title={t('title')} />

      <AdminCallout title={t('beta_title')} variant="warning">
        <p>{t('beta_body')}</p>
      </AdminCallout>

      {summary.schemaIncomplete ? (
        <AdminCallout variant="warning">{t('schema_pending_hint')}</AdminCallout>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <AdminKpiCard
          helpLabel={t('meaning_toggle')}
          helpText={t('hint_kpi_evaluations')}
          label={t('kpi_evaluations')}
          value={summary.totalEvaluations}
        />
        <AdminKpiCard
          helpLabel={t('meaning_toggle')}
          helpText={t('hint_kpi_pending')}
          accent="whatsapp"
          label={t('kpi_pending')}
          value={summary.pendingEvaluations}
        />
        <AdminKpiCard
          helpLabel={t('meaning_toggle')}
          helpText={t('hint_kpi_messages')}
          label={t('kpi_messages')}
          value={summary.totalMessages}
        />
        <AdminKpiCard
          helpLabel={t('meaning_toggle')}
          helpText={t('hint_kpi_outbox')}
          label={t('kpi_outbox')}
          value={summary.pendingOutboxEvents}
        />
        <AdminKpiCard
          helpLabel={t('meaning_toggle')}
          helpText={t('hint_kpi_closed_won')}
          accent="primary"
          label={t('kpi_closed_won')}
          value={summary.closedWonSignals}
        />
      </div>

      <ChatProRoiEvaluationsTable
        groups={summary.leadGroups}
        labels={{
          title: t('table_title'),
          empty: t('table_empty'),
          colLead: t('col_lead'),
          colCampaign: t('col_campaign'),
          colStage: t('col_stage'),
          colLikelihood: t('col_likelihood'),
          colPriority: t('col_priority'),
          colSummary: t('col_summary'),
          colEvaluatedAt: t('col_evaluated_at'),
          colMessages: t('col_messages'),
          colSuggestedStatus: t('col_suggested_status'),
          colVersions: t('col_versions'),
          suggestedStatusHint: t('suggested_status_hint'),
          versionsCount: t('versions_count'),
          historyToggle: t('history_toggle'),
          historyTitle: t('history_title'),
          frozenBadge: t('frozen_badge'),
          frozenHint: t('frozen_hint'),
          colEstimatedValue: t('col_estimated_value'),
          formatEstimatedValue: (value) => t('estimated_value_brl', { value }),
          viewLead: t('view_lead'),
          stageLabels,
          divertedWithPhone: (phone) => t('stage_diverted_with_phone', { phone }),
          priorityLabels,
          statusLabels,
        }}
      />

      {summary.totalPages > 1 ? (
        <nav
          aria-label={tLead('pagination_label')}
          className="flex flex-wrap items-center justify-between gap-4 text-sm"
        >
          <p className="text-neutral-600">
            {tLead('pagination_info', { page: summary.page, totalPages: summary.totalPages })}
          </p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: summary.totalPages }, (_, index) => index + 1).map((page) => (
              <Link
                aria-current={page === summary.page ? 'page' : undefined}
                className={page === summary.page
                  ? 'rounded-lg border border-primary bg-primary px-3 py-1.5 text-white'
                  : 'rounded-lg border border-neutral-200 px-3 py-1.5 hover:bg-background-muted'}
                href={`/dashboard/chatpro-roi?page=${page}`}
                key={page}
              >
                {page}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}

      <AdminCallout variant="tip">{t('worker_hint')}</AdminCallout>
    </div>
  );
}
