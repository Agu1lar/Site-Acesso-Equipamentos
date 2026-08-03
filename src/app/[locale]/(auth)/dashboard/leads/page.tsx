import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AnalyticsWhatsappWeekStrip } from '@/components/admin/AnalyticsWhatsappWeekStrip';
import { CommercialQueueSection } from '@/components/admin/CommercialQueueSection';
import { LeadsTable } from '@/components/admin/LeadsTable';
import { StaleLeadsAlert } from '@/components/admin/StaleLeadsAlert';
import { AdminCallout } from '@/components/admin/AdminCallout';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { archiveStaleCommercialLeads } from '@/lib/leads-auto-archive';
import { getOperationalDashboard } from '@/lib/analytics-admin';
import { Button } from '@/components/ui/Button';
import {
  buildContactOrderCounts,
  countWeekWhatsAppOpenedLeads,
  listCommercialQueue,
  listWeekOperationalLeads,
  WEEK_LEADS_DISPLAY_MAX,
} from '@/lib/leads-admin';
import { formatWeekRangeLabel, currentWeekRange } from '@/lib/leads-date-presets';
import { listStaleNewLeads } from '@/lib/leads-stale-alert';
import { Link } from '@/libs/I18nNavigation';
import { resolveAppLocale } from '@/utils/locale';

type LeadsPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: LeadsPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'LeadsAdminPage',
  });
  return {
    title: t('meta_title_week'),
    description: t('meta_description_week'),
  };
}

export default async function LeadsAdminPage(props: LeadsPageProps) {
  const { locale } = await props.params;
  setRequestLocale(resolveAppLocale(locale));
  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'LeadsAdminPage',
  });
  const tAnalytics = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'AnalyticsAdminPage',
  });

  const archivedCount = await archiveStaleCommercialLeads();
  const weekRange = currentWeekRange();

  const [queueResult, weekResult, staleLeads, weekMetrics, weekWhatsAppOpened] = await Promise.all([
    listCommercialQueue(),
    listWeekOperationalLeads(),
    listStaleNewLeads(),
    getOperationalDashboard({
      dateFrom: weekRange.dateFrom,
      dateTo: weekRange.dateTo,
    }),
    countWeekWhatsAppOpenedLeads(),
  ]);
  const contactOrderCounts = await buildContactOrderCounts(weekResult.leads);
  const weekLabel = formatWeekRangeLabel(weekResult.weekRange);
  const weekOverflow = Math.max(0, weekResult.total - weekResult.leads.length);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        actions={
          <Button href="/dashboard/leads/consulta" size="sm" variant="outline">
            {t('open_consulta_button')}
          </Button>
        }
        description={t('week_summary', {
          count: weekResult.total,
          week: weekLabel,
        })}
        title={t('title_week')}
      />

      <AnalyticsWhatsappWeekStrip
        clicks={weekMetrics.whatsappClicks}
        clicksLabel={tAnalytics('whatsapp_hero_clicks_label', {
          count: weekMetrics.whatsappClicks,
        })}
        detailHref="/dashboard/analytics"
        detailLabel={t('week_whatsapp_detail_link')}
        formOpensLabel={t('week_whatsapp_form_opens', { count: weekWhatsAppOpened })}
        hint={t('week_whatsapp_hint')}
        title={tAnalytics('whatsapp_hero_title')}
        weekLabel={weekLabel}
      />

      <StaleLeadsAlert summary={staleLeads} />

      {archivedCount > 0 ? (
        <AdminCallout variant="tip">
          {t('auto_archive_notice', { count: archivedCount })}
        </AdminCallout>
      ) : null}

      <CommercialQueueSection
        leads={queueResult.leads}
        total={queueResult.total}
        weekRange={queueResult.weekRange}
      />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-bold text-neutral-900">{t('week_table_title')}</h2>
            <p className="mt-1 text-sm text-neutral-600">
              {t('week_table_hint', { max: WEEK_LEADS_DISPLAY_MAX, week: weekLabel })}
            </p>
          </div>
        </div>

        <LeadsTable contactOrderCounts={contactOrderCounts} leads={weekResult.leads} />

        {weekOverflow > 0 ? (
          <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            {t('week_table_overflow', {
              shown: weekResult.leads.length,
              total: weekResult.total,
            })}{' '}
            <Link className="font-medium text-primary hover:underline" href="/dashboard/leads/consulta">
              {t('open_consulta_link')}
            </Link>
          </p>
        ) : null}
      </section>
    </div>
  );
}
