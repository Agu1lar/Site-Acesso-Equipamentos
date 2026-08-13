import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard';
import type { AnalyticsDashboardLabels } from '@/components/admin/AnalyticsDashboard';
import { AnalyticsLoadFailure } from '@/components/admin/AnalyticsLoadFailure';
import { AnalyticsPeriodFilters } from '@/components/admin/AnalyticsPeriodFilters';
import { AnalyticsSectionNav } from '@/components/admin/AnalyticsSectionNav';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { getOperationalDashboard, probeAnalyticsDashboard } from '@/lib/analytics-admin';
import type { OperationalDashboard } from '@/lib/analytics-admin-types';
import { parseAnalyticsDashboardFailure } from '@/lib/analytics-dashboard-errors';
import { parseAnalyticsSection } from '@/lib/analytics-sections';
import { resolveAppLocale } from '@/utils/locale';
import { logger } from '@/libs/Logger';

type AnalyticsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    section?: string;
    dateFrom?: string;
    dateTo?: string;
    compareDateFrom?: string;
    compareDateTo?: string;
  }>;
};

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: AnalyticsPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'AnalyticsAdminPage',
  });
  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

async function buildDashboardLabels(
  locale: string,
  dashboard: OperationalDashboard,
): Promise<AnalyticsDashboardLabels> {
  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'AnalyticsAdminPage',
  });

  return {
    sections: {
      'visao-geral': t('section_overview'),
      conversao: t('section_conversion'),
      catalogo: t('section_catalog'),
      trafego: t('section_traffic'),
      comportamento: t('section_behavior'),
      executivo: t('section_executive'),
    },
    section_intros: {
      'visao-geral': t('section_overview_intro'),
      conversao: t('section_conversion_intro'),
      catalogo: t('section_catalog_intro'),
      trafego: t('section_traffic_intro'),
      comportamento: t('section_behavior_intro'),
      executivo: t('section_executive_intro'),
    },
    meaning_toggle: t('meaning_toggle'),
    meaning_hide: t('meaning_hide'),
    data_types: {
      count: t('data_type_count'),
      rate: t('data_type_rate'),
      ranking: t('data_type_ranking'),
      funnel: t('data_type_funnel'),
      timeseries: t('data_type_timeseries'),
      breakdown: t('data_type_breakdown'),
      table: t('data_type_table'),
    },
    notes_title: t('notes_title'),
    posthog_visits_hint: t('posthog_visits_hint'),
    sprint12_posthog_hint: t('sprint12_posthog_hint'),
    whatsapp_tracking_hint: t('whatsapp_tracking_hint'),
    schema_pending_hint: t('schema_pending_hint'),
    empty_data: t('empty_data'),
    delta_vs_custom_period: t('delta_vs_custom_period'),
    delta_vs_auto_previous: t('delta_vs_auto_previous'),
    whatsapp_hero_title: t('whatsapp_hero_title'),
    whatsapp_hero_period: t('whatsapp_hero_period'),
    whatsapp_hero_clicks_label: t('whatsapp_hero_clicks_label', { count: dashboard.whatsappClicks }),
    whatsapp_hero_consent_label: t('whatsapp_hero_consent_label', {
      withConsent: dashboard.whatsappClicksWithConsent,
      total: dashboard.whatsappClicks,
    }),
    whatsapp_hero_empty_hint: t('whatsapp_hero_empty_hint'),
    whatsapp_hero_rate: t('whatsapp_hero_rate'),
    whatsapp_hero_previous_period: t('whatsapp_hero_previous_period', {
      count: dashboard.whatsappClicksPrevious,
    }),
    hint_kpi_whatsapp: t('hint_kpi_whatsapp'),
    kpi_page_views: t('kpi_page_views'),
    hint_kpi_page_views: t('hint_kpi_page_views'),
    kpi_whatsapp: t('kpi_whatsapp'),
    kpi_leads: t('kpi_leads'),
    hint_kpi_leads: t('hint_kpi_leads'),
    kpi_phone: t('kpi_phone'),
    hint_kpi_phone: t('hint_kpi_phone'),
    kpi_cookie_consent_leads: t('kpi_cookie_consent_leads', { count: dashboard.cookieConsentLeads }),
    kpi_whatsapp_rate: t('kpi_whatsapp_rate'),
    chart_conversion_funnel: t('chart_conversion_funnel'),
    hint_chart_conversion_funnel: t('hint_chart_conversion_funnel'),
    chart_lead_reply_funnel: t('chart_lead_reply_funnel'),
    hint_chart_lead_reply_funnel: t('hint_chart_lead_reply_funnel'),
    funnel_step_visits: t('funnel_step_visits'),
    funnel_step_equipment_views: t('funnel_step_equipment_views'),
    funnel_step_add_to_quote: t('funnel_step_add_to_quote'),
    funnel_step_quote_submits: t('funnel_step_quote_submits'),
    funnel_step_whatsapp_clicks: t('funnel_step_whatsapp_clicks'),
    funnel_step_leads: t('funnel_step_leads'),
    funnel_step_whatsapp_replied: t('funnel_step_whatsapp_replied'),
    funnel_step_won: t('funnel_step_won'),
    funnel_rate_from_top: t('funnel_rate_from_top'),
    funnel_rate_from_previous: t('funnel_rate_from_previous'),
    quote_abandon_summary: t('quote_abandon_summary'),
    chart_quote_abandon: t('chart_quote_abandon'),
    chart_top_pages: t('chart_top_pages'),
    hint_chart_top_pages: t('hint_chart_top_pages'),
    col_page: t('col_page'),
    col_views: t('col_views'),
    col_avg_active_time: t('col_avg_active_time'),
    col_whatsapp: t('col_whatsapp'),
    col_leads: t('col_leads'),
    chart_top_equipment_views: t('chart_top_equipment_views'),
    hint_chart_top_equipment_views: t('hint_chart_top_equipment_views'),
    chart_search_terms: t('chart_search_terms'),
    hint_chart_search_terms: t('hint_chart_search_terms'),
    chart_scroll_depth: t('chart_scroll_depth'),
    hint_chart_scroll_depth: t('hint_chart_scroll_depth'),
    chart_category_filters: t('chart_category_filters'),
    hint_chart_category_filters: t('hint_chart_category_filters'),
    chart_whatsapp_origin: t('chart_whatsapp_origin'),
    hint_chart_whatsapp_origin: t('hint_chart_whatsapp_origin'),
    chart_phone_origin: t('chart_phone_origin'),
    hint_chart_phone_origin: t('hint_chart_phone_origin'),
    chart_traffic_source: t('chart_traffic_source'),
    hint_chart_traffic_source: t('hint_chart_traffic_source'),
    chart_top_equipment_whatsapp: t('chart_top_equipment_whatsapp'),
    hint_chart_top_equipment_whatsapp: t('hint_chart_top_equipment_whatsapp'),
    chart_top_equipment_leads: t('chart_top_equipment_leads'),
    hint_chart_top_equipment_leads: t('hint_chart_top_equipment_leads'),
    chart_landing_pages: t('chart_landing_pages'),
    hint_chart_landing_pages: t('hint_chart_landing_pages'),
    chart_device: t('chart_device'),
    hint_chart_device: t('hint_chart_device'),
    chart_daily_series: t('chart_daily_series'),
    hint_chart_daily_series: t('hint_chart_daily_series'),
    col_date: t('col_date'),
    col_page_views_short: t('col_page_views_short'),
    chart_leads_by_city: t('chart_leads_by_city'),
    hint_chart_leads_by_city: t('hint_chart_leads_by_city'),
    chart_top_quoted_equipment: t('chart_top_quoted_equipment'),
    hint_chart_top_quoted_equipment: t('hint_chart_top_quoted_equipment'),
    chart_top_categories: t('chart_top_categories'),
    hint_chart_top_categories: t('hint_chart_top_categories'),
    executive_export_title: t('executive_export_title'),
    executive_export_body: t('executive_export_body'),
    executive_export_button: t('executive_export_button'),
    campaign: {
      title: t('chart_campaign_performance'),
      hint: t('hint_chart_campaign_performance'),
      dailyTitle: t('chart_campaign_daily'),
      dailyHint: t('hint_chart_campaign_daily'),
      empty: t('empty_data'),
      colCampaign: t('col_campaign'),
      colSource: t('col_source'),
      colMedium: t('col_medium'),
      colWhatsapp: t('col_whatsapp'),
      colWhatsappReplied: t('col_whatsapp_replied'),
      colTotalLeads: t('col_total_leads'),
      colQuoteLeads: t('col_quote_leads'),
      colGoogleLeads: t('col_google_leads'),
      colGclid: t('col_gclid'),
      colDate: t('col_date'),
      colLeads: t('col_leads'),
      viewLeads: t('view_campaign_leads'),
      comparePrevious: t('campaign_compare_previous'),
      statusNew: t('status_new_short'),
      statusContacted: t('status_contacted_short'),
      statusQuoted: t('status_quoted_short'),
      statusWon: t('status_won_short'),
      statusLost: t('status_lost_short'),
      statusArchived: t('status_archived_short'),
      statusOther: t('status_other_short'),
    },
    equipmentConversion: {
      title: t('chart_equipment_conversion'),
      hint: t('chart_equipment_conversion_hint'),
      colEquipment: t('col_equipment'),
      colViews: t('col_views'),
      colWhatsapp: t('col_whatsapp'),
      colLeads: t('col_leads'),
      colLeadRate: t('col_lead_rate'),
      colEngagementRate: t('col_engagement_rate'),
    },
  };
}

export default async function AnalyticsAdminPage(props: AnalyticsPageProps) {
  const { locale } = await props.params;
  const searchParams = await props.searchParams;
  setRequestLocale(resolveAppLocale(locale));
  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'AnalyticsAdminPage',
  });

  const activeSection = parseAnalyticsSection(searchParams.section);
  const filters = {
    dateFrom: searchParams.dateFrom,
    dateTo: searchParams.dateTo,
    compareDateFrom: searchParams.compareDateFrom,
    compareDateTo: searchParams.compareDateTo,
  };

  let dashboard;
  try {
    dashboard = await getOperationalDashboard(filters);
  } catch (error) {
    const failure = parseAnalyticsDashboardFailure(error);
    logger.error('Analytics dashboard page load failed', failure);

    let probe;
    try {
      probe = await probeAnalyticsDashboard(filters);
    } catch (probeError) {
      logger.warn('Analytics probe failed after page load error', {
        message: probeError instanceof Error ? probeError.message : String(probeError),
      });
    }

    return (
      <AnalyticsLoadFailure
        debugToggle={t('load_error_debug_toggle')}
        description={t('meta_description')}
        failure={failure}
        loadError={t('load_error')}
        loadErrorStep={
          failure.stepId
            ? t('load_error_step', { step: failure.stepLabel ?? failure.stepId })
            : undefined
        }
        probe={probe}
        probeOkHint={t('load_error_probe_ok_hint')}
        smokeTestHint={t('smoke_test_hint')}
        title={t('title')}
      />
    );
  }

  const headerDescription =
    dashboard.comparisonMode === 'custom'
      ? t('period_comparison_summary', {
          from: dashboard.period.dateFrom,
          to: dashboard.period.dateTo,
          compareFrom: dashboard.comparisonPeriod.dateFrom,
          compareTo: dashboard.comparisonPeriod.dateTo,
        })
      : t('period_summary_with_auto_compare', {
          from: dashboard.period.dateFrom,
          to: dashboard.period.dateTo,
          compareFrom: dashboard.comparisonPeriod.dateFrom,
          compareTo: dashboard.comparisonPeriod.dateTo,
        });

  const exportParams = new URLSearchParams();
  exportParams.set('dateFrom', dashboard.period.dateFrom);
  exportParams.set('dateTo', dashboard.period.dateTo);
  const exportHref = `/api/admin/leads/export?${exportParams.toString()}`;
  const labels = await buildDashboardLabels(locale, dashboard);

  return (
    <div className="space-y-8">
      <AdminPageHeader description={headerDescription} title={t('title')} />

      <Suspense fallback={<div className="h-11 animate-pulse rounded-full bg-neutral-100" />}>
        <AnalyticsSectionNav activeSection={activeSection} labels={labels.sections} />
      </Suspense>

      <AnalyticsPeriodFilters
        compareDateFrom={searchParams.compareDateFrom ?? dashboard.comparisonPeriod.dateFrom}
        compareDateTo={searchParams.compareDateTo ?? dashboard.comparisonPeriod.dateTo}
        dateFrom={searchParams.dateFrom ?? dashboard.period.dateFrom}
        dateTo={searchParams.dateTo ?? dashboard.period.dateTo}
        section={activeSection}
      />

      <Suspense fallback={null}>
        <AnalyticsDashboard
          activeSection={activeSection}
          dashboard={dashboard}
          exportHref={exportHref}
          labels={labels}
        />
      </Suspense>
    </div>
  );
}
