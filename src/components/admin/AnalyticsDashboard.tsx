'use client';

import { Link } from '@/libs/I18nNavigation';
import { AnalyticsBarTable } from '@/components/admin/AnalyticsBarTable';
import { AnalyticsConversionFunnel } from '@/components/admin/AnalyticsConversionFunnel';
import { AnalyticsDailySeriesTable } from '@/components/admin/AnalyticsDailySeriesTable';
import { AnalyticsMetricSection } from '@/components/admin/AnalyticsMetricSection';
import { AnalyticsTopPagesTable } from '@/components/admin/AnalyticsTopPagesTable';
import { AnalyticsWhatsappHero } from '@/components/admin/AnalyticsWhatsappHero';
import { AdminCallout } from '@/components/admin/AdminCallout';
import { AdminKpiCard } from '@/components/admin/AdminKpiCard';
import type { OperationalDashboard } from '@/lib/analytics-admin-types';
import { percentChange } from '@/lib/analytics-percent';
import type { AnalyticsSectionId } from '@/lib/analytics-sections';

export type AnalyticsDashboardLabels = {
  sections: Record<AnalyticsSectionId, string>;
  section_intros: Record<AnalyticsSectionId, string>;
  meaning_toggle: string;
  meaning_hide: string;
  data_types: {
    count: string;
    rate: string;
    ranking: string;
    funnel: string;
    timeseries: string;
    breakdown: string;
    table: string;
  };
  notes_title: string;
  posthog_visits_hint: string;
  sprint12_posthog_hint: string;
  whatsapp_tracking_hint: string;
  schema_pending_hint: string;
  empty_data: string;
  delta_vs_custom_period: string;
  delta_vs_auto_previous: string;
  whatsapp_hero_title: string;
  whatsapp_hero_period: string;
  whatsapp_hero_clicks_label: string;
  whatsapp_hero_consent_label: string;
  whatsapp_hero_empty_hint: string;
  whatsapp_hero_rate: string;
  whatsapp_hero_previous_period: string;
  hint_kpi_whatsapp: string;
  kpi_page_views: string;
  hint_kpi_page_views: string;
  kpi_whatsapp: string;
  kpi_leads: string;
  hint_kpi_leads: string;
  kpi_phone: string;
  hint_kpi_phone: string;
  kpi_cookie_consent_leads: string;
  kpi_whatsapp_rate: string;
  chart_conversion_funnel: string;
  hint_chart_conversion_funnel: string;
  chart_lead_reply_funnel: string;
  hint_chart_lead_reply_funnel: string;
  funnel_step_visits: string;
  funnel_step_equipment_views: string;
  funnel_step_add_to_quote: string;
  funnel_step_quote_submits: string;
  funnel_step_whatsapp_clicks: string;
  funnel_step_leads: string;
  funnel_step_whatsapp_replied: string;
  funnel_step_won: string;
  funnel_rate_from_top: string;
  funnel_rate_from_previous: string;
  quote_abandon_summary: string;
  chart_quote_abandon: string;
  chart_top_pages: string;
  hint_chart_top_pages: string;
  col_page: string;
  col_views: string;
  col_avg_active_time: string;
  col_whatsapp: string;
  col_leads: string;
  chart_top_equipment_views: string;
  hint_chart_top_equipment_views: string;
  chart_search_terms: string;
  hint_chart_search_terms: string;
  chart_scroll_depth: string;
  hint_chart_scroll_depth: string;
  chart_category_filters: string;
  hint_chart_category_filters: string;
  chart_whatsapp_origin: string;
  hint_chart_whatsapp_origin: string;
  chart_phone_origin: string;
  hint_chart_phone_origin: string;
  chart_traffic_source: string;
  hint_chart_traffic_source: string;
  chart_top_equipment_whatsapp: string;
  hint_chart_top_equipment_whatsapp: string;
  chart_top_equipment_leads: string;
  hint_chart_top_equipment_leads: string;
  chart_landing_pages: string;
  hint_chart_landing_pages: string;
  chart_device: string;
  hint_chart_device: string;
  chart_daily_series: string;
  hint_chart_daily_series: string;
  col_page_views_short: string;
  chart_leads_by_city: string;
  hint_chart_leads_by_city: string;
  chart_top_quoted_equipment: string;
  hint_chart_top_quoted_equipment: string;
  chart_top_categories: string;
  hint_chart_top_categories: string;
  executive_export_title: string;
  executive_export_body: string;
  executive_export_button: string;
};

type AnalyticsDashboardProps = {
  dashboard: OperationalDashboard;
  activeSection: AnalyticsSectionId;
  labels: AnalyticsDashboardLabels;
  exportHref: string;
};

export function AnalyticsDashboard(props: AnalyticsDashboardProps) {
  const { dashboard: d, labels: t, activeSection } = props;
  const executive = d.executive ?? {
    dailySeries: [],
    leadsByCity: [],
    topQuotedEquipment: [],
    topCategories: [],
  };
  const metricUi = {
    meaningToggleLabel: t.meaning_toggle,
    meaningHideLabel: t.meaning_hide,
  };
  const dataTypes = t.data_types;

  const deltaLabel =
    d.comparisonMode === 'custom'
      ? t.delta_vs_custom_period
          .replace('{from}', d.comparisonPeriod.dateFrom)
          .replace('{to}', d.comparisonPeriod.dateTo)
      : t.delta_vs_auto_previous
          .replace('{from}', d.comparisonPeriod.dateFrom)
          .replace('{to}', d.comparisonPeriod.dateTo);

  const visitsDelta = percentChange(d.pageViews, d.pageViewsPrevious);
  const whatsappDelta = percentChange(d.whatsappClicks, d.whatsappClicksPrevious);
  const phoneDelta = percentChange(d.phoneClicks, d.phoneClicksPrevious);
  const leadsDelta = percentChange(d.quoteSubmits, d.quoteSubmitsPrevious);
  const whatsappRate =
    d.pageViews > 0 ? Math.round((d.whatsappClicks / d.pageViews) * 100) : 0;

  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed text-neutral-600">{t.section_intros[activeSection]}</p>

      {d.schemaIncomplete ? (
        <AdminCallout variant="warning">{t.schema_pending_hint}</AdminCallout>
      ) : null}

      {activeSection === 'visao-geral' ? (
        <div className="space-y-6">
          <details className="rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
            <summary className="cursor-pointer text-sm font-semibold text-neutral-800">
              {t.notes_title}
            </summary>
            <div className="mt-3 space-y-2 text-sm text-neutral-600">
              {d.posthogHint ? <p>{t.posthog_visits_hint}</p> : null}
              {d.posthogHint ? <p>{t.sprint12_posthog_hint}</p> : null}
              {d.whatsappClicks === 0 ? <p>{t.whatsapp_tracking_hint}</p> : null}
            </div>
          </details>

          <AnalyticsWhatsappHero
            clicks={d.whatsappClicks}
            clicksLabel={t.whatsapp_hero_clicks_label}
            clicksPrevious={d.whatsappClicksPrevious}
            clicksWithConsentLabel={t.whatsapp_hero_consent_label
              .replace('{withConsent}', String(d.whatsappClicksWithConsent))
              .replace('{total}', String(d.whatsappClicks))}
            delta={whatsappDelta}
            deltaLabel={deltaLabel}
            emptyHint={t.whatsapp_hero_empty_hint}
            helpLabel={t.meaning_toggle}
            helpText={t.hint_kpi_whatsapp}
            pageViews={d.pageViews}
            periodLabel={t.whatsapp_hero_period
              .replace('{from}', d.period.dateFrom)
              .replace('{to}', d.period.dateTo)}
            previousPeriodLabel={t.whatsapp_hero_previous_period}
            rateLabel={
              d.pageViews > 0
                ? t.whatsapp_hero_rate.replace('{rate}', String(whatsappRate))
                : undefined
            }
            title={t.whatsapp_hero_title}
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminKpiCard
              delta={visitsDelta}
              deltaLabel={deltaLabel}
              helpLabel={t.meaning_toggle}
              helpText={t.hint_kpi_page_views}
              label={t.kpi_page_views}
              value={d.pageViews}
            />
            <AdminKpiCard
              accent="whatsapp"
              delta={whatsappDelta}
              deltaLabel={deltaLabel}
              helpLabel={t.meaning_toggle}
              helpText={t.hint_kpi_whatsapp}
              label={t.kpi_whatsapp}
              value={d.whatsappClicks}
            />
            <AdminKpiCard
              accent="primary"
              delta={leadsDelta}
              deltaLabel={deltaLabel}
              helpLabel={t.meaning_toggle}
              helpText={t.hint_kpi_leads}
              label={t.kpi_leads}
              value={d.quoteSubmits}
            />
            <AdminKpiCard
              accent="neutral"
              delta={phoneDelta}
              deltaLabel={deltaLabel}
              helpLabel={t.meaning_toggle}
              helpText={t.hint_kpi_phone}
              label={t.kpi_phone}
              value={d.phoneClicks}
            />
          </div>

          {(d.cookieConsentLeads > 0 || d.pageViews > 0) && (
            <div className="flex flex-wrap gap-4 text-sm text-neutral-600">
              {d.cookieConsentLeads > 0 ? (
                <span>
                  {t.kpi_cookie_consent_leads}
                </span>
              ) : null}
              {d.pageViews > 0 ? (
                <span>{t.kpi_whatsapp_rate.replace('{rate}', String(whatsappRate))}</span>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {activeSection === 'conversao' ? (
        <div className="space-y-6">
          <AnalyticsConversionFunnel
            dataType="funnel"
            dataTypeLabel={dataTypes.funnel}
            emptyLabel={t.empty_data}
            meaning={t.hint_chart_conversion_funnel}
            rateFromPreviousLabel={t.funnel_rate_from_previous}
            rateFromTopLabel={t.funnel_rate_from_top}
            stepLabels={{
              visits: t.funnel_step_visits,
              equipment_views: t.funnel_step_equipment_views,
              add_to_quote: t.funnel_step_add_to_quote,
              quote_submits: t.funnel_step_quote_submits,
              whatsapp_clicks: t.funnel_step_whatsapp_clicks,
            }}
            steps={d.conversionFunnel}
            title={t.chart_conversion_funnel}
            {...metricUi}
          />

          <AnalyticsConversionFunnel
            dataType="funnel"
            dataTypeLabel={dataTypes.funnel}
            emptyLabel={t.empty_data}
            meaning={t.hint_chart_lead_reply_funnel}
            rateFromPreviousLabel={t.funnel_rate_from_previous}
            rateFromTopLabel={t.funnel_rate_from_top}
            stepLabels={{
              leads: t.funnel_step_leads,
              whatsapp_replied: t.funnel_step_whatsapp_replied,
              won: t.funnel_step_won,
            }}
            steps={d.leadReplyFunnel}
            title={t.chart_lead_reply_funnel}
            {...metricUi}
          />

          <AnalyticsMetricSection
            dataType="rate"
            dataTypeLabel={dataTypes.rate}
            meaning={t.hint_chart_conversion_funnel}
            title={t.chart_quote_abandon}
            {...metricUi}
          >
            <p className="text-sm text-neutral-700">
              {t.quote_abandon_summary
                .replace('{add}', String(d.quoteAbandon.addToQuote))
                .replace('{submits}', String(d.quoteAbandon.quoteSubmits))
                .replace('{abandons}', String(d.quoteAbandon.quoteAbandons))
                .replace('{rate}', String(d.quoteAbandon.abandonRate))}
            </p>
          </AnalyticsMetricSection>

          <AnalyticsBarTable
            dataType="ranking"
            dataTypeLabel={dataTypes.ranking}
            emptyLabel={t.empty_data}
            meaning={t.hint_chart_landing_pages}
            rows={d.landingPages}
            title={t.chart_landing_pages}
            {...metricUi}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <AnalyticsBarTable
              dataType="breakdown"
              dataTypeLabel={dataTypes.breakdown}
              emptyLabel={t.empty_data}
              meaning={t.hint_chart_whatsapp_origin}
              rows={d.whatsappByOrigin}
              title={t.chart_whatsapp_origin}
              {...metricUi}
            />
            <AnalyticsBarTable
              dataType="breakdown"
              dataTypeLabel={dataTypes.breakdown}
              emptyLabel={t.empty_data}
              meaning={t.hint_chart_phone_origin}
              rows={d.phoneByOrigin}
              title={t.chart_phone_origin}
              {...metricUi}
            />
          </div>
        </div>
      ) : null}

      {activeSection === 'catalogo' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <AnalyticsBarTable
            dataType="ranking"
            dataTypeLabel={dataTypes.ranking}
            emptyLabel={t.empty_data}
            meaning={t.hint_chart_top_equipment_views}
            rows={d.topEquipmentViews}
            title={t.chart_top_equipment_views}
            {...metricUi}
          />
          <AnalyticsBarTable
            dataType="ranking"
            dataTypeLabel={dataTypes.ranking}
            emptyLabel={t.empty_data}
            meaning={t.hint_chart_top_equipment_whatsapp}
            rows={d.topEquipmentWhatsapp}
            title={t.chart_top_equipment_whatsapp}
            {...metricUi}
          />
          <AnalyticsBarTable
            dataType="ranking"
            dataTypeLabel={dataTypes.ranking}
            emptyLabel={t.empty_data}
            meaning={t.hint_chart_top_equipment_leads}
            rows={d.topEquipmentLeads}
            title={t.chart_top_equipment_leads}
            {...metricUi}
          />
          <AnalyticsBarTable
            dataType="ranking"
            dataTypeLabel={dataTypes.ranking}
            emptyLabel={t.empty_data}
            meaning={t.hint_chart_search_terms}
            rows={d.topSearchTerms}
            title={t.chart_search_terms}
            {...metricUi}
          />
          <AnalyticsBarTable
            dataType="breakdown"
            dataTypeLabel={dataTypes.breakdown}
            emptyLabel={t.empty_data}
            meaning={t.hint_chart_category_filters}
            rows={d.topCategoryFilters}
            title={t.chart_category_filters}
            {...metricUi}
          />
        </div>
      ) : null}

      {activeSection === 'trafego' ? (
        <div className="space-y-6">
          <AnalyticsTopPagesTable
            colAvgTime={t.col_avg_active_time}
            colPage={t.col_page}
            colViews={t.col_views}
            dataType="table"
            dataTypeLabel={dataTypes.table}
            emptyLabel={t.empty_data}
            meaning={t.hint_chart_top_pages}
            rows={d.topPages}
            title={t.chart_top_pages}
            {...metricUi}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <AnalyticsBarTable
              dataType="breakdown"
              dataTypeLabel={dataTypes.breakdown}
              emptyLabel={t.empty_data}
              meaning={t.hint_chart_traffic_source}
              rows={d.trafficBySource}
              title={t.chart_traffic_source}
              {...metricUi}
            />
            <AnalyticsBarTable
              dataType="breakdown"
              dataTypeLabel={dataTypes.breakdown}
              emptyLabel={t.empty_data}
              meaning={t.hint_chart_device}
              rows={d.deviceSplit}
              title={t.chart_device}
              {...metricUi}
            />
          </div>
        </div>
      ) : null}

      {activeSection === 'comportamento' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <AnalyticsBarTable
            dataType="breakdown"
            dataTypeLabel={dataTypes.breakdown}
            emptyLabel={t.empty_data}
            meaning={t.hint_chart_scroll_depth}
            rows={d.scrollDepth}
            title={t.chart_scroll_depth}
            {...metricUi}
          />
        </div>
      ) : null}

      {activeSection === 'executivo' ? (
        <div className="space-y-6">
          <AnalyticsMetricSection
            dataType="timeseries"
            dataTypeLabel={dataTypes.timeseries}
            meaning={t.hint_chart_daily_series}
            title={t.chart_daily_series}
            {...metricUi}
          >
            <AnalyticsDailySeriesTable
              colDate={t.col_date}
              colLeads={t.col_leads}
              colPageViews={t.col_page_views_short}
              colWhatsapp={t.col_whatsapp}
              emptyLabel={t.empty_data}
              rows={executive.dailySeries}
            />
          </AnalyticsMetricSection>

          <div className="grid gap-4 lg:grid-cols-2">
            <AnalyticsBarTable
              dataType="ranking"
              dataTypeLabel={dataTypes.ranking}
              emptyLabel={t.empty_data}
              meaning={t.hint_chart_leads_by_city}
              rows={executive.leadsByCity}
              title={t.chart_leads_by_city}
              {...metricUi}
            />
            <AnalyticsBarTable
              dataType="ranking"
              dataTypeLabel={dataTypes.ranking}
              emptyLabel={t.empty_data}
              meaning={t.hint_chart_top_quoted_equipment}
              rows={executive.topQuotedEquipment}
              title={t.chart_top_quoted_equipment}
              {...metricUi}
            />
            <AnalyticsBarTable
              dataType="ranking"
              dataTypeLabel={dataTypes.ranking}
              emptyLabel={t.empty_data}
              meaning={t.hint_chart_top_categories}
              rows={executive.topCategories}
              title={t.chart_top_categories}
              {...metricUi}
            />
          </div>

          <AnalyticsMetricSection
            dataType="table"
            dataTypeLabel={dataTypes.table}
            meaning={t.executive_export_body}
            title={t.executive_export_title}
            {...metricUi}
          >
            <Link
              className="inline-flex rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
              href={props.exportHref}
            >
              {t.executive_export_button}
            </Link>
          </AnalyticsMetricSection>
        </div>
      ) : null}
    </div>
  );
}
