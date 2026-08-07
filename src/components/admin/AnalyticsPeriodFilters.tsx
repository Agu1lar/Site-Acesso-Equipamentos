import { getTranslations } from 'next-intl/server';
import {
  buildAnalyticsFilterQuery,
  currentMonthToDateRange,
  previousMonthToDateRange,
  previousPeriodRange,
} from '@/lib/analytics-period';
import { currentWeekRange, lastDaysRange, previousWeekRange } from '@/lib/leads-date-presets';
import { Link } from '@/libs/I18nNavigation';
import { AdminFilterPanel } from '@/components/admin/AdminFilterPanel';

type AnalyticsPeriodFiltersProps = {
  dateFrom?: string;
  dateTo?: string;
  compareDateFrom?: string;
  compareDateTo?: string;
  section?: string;
};

/**
 * Primary + comparison date ranges for the analytics dashboard (Ads-style).
 */
export async function AnalyticsPeriodFilters(props: AnalyticsPeriodFiltersProps) {
  const t = await getTranslations('AnalyticsAdminPage');
  const range7 = lastDaysRange(7);
  const range7Compare = previousPeriodRange(range7.dateFrom, range7.dateTo);
  const range30 = lastDaysRange(30);
  const range30Compare = previousPeriodRange(range30.dateFrom, range30.dateTo);
  const thisMonth = currentMonthToDateRange();
  const lastMonth = previousMonthToDateRange();
  const thisWeek = currentWeekRange();
  const lastWeek = previousWeekRange();

  const section = props.section?.trim();
  const sectionQuery = section ? { section } : {};

  const href7 = `/dashboard/analytics${buildAnalyticsFilterQuery({
    ...range7,
    compareDateFrom: range7Compare.dateFrom,
    compareDateTo: range7Compare.dateTo,
    ...sectionQuery,
  })}`;
  const href30 = `/dashboard/analytics${buildAnalyticsFilterQuery({
    ...range30,
    compareDateFrom: range30Compare.dateFrom,
    compareDateTo: range30Compare.dateTo,
    ...sectionQuery,
  })}`;
  const hrefMonthCompare = `/dashboard/analytics${buildAnalyticsFilterQuery({
    ...thisMonth,
    compareDateFrom: lastMonth.dateFrom,
    compareDateTo: lastMonth.dateTo,
    ...sectionQuery,
  })}`;
  const hrefWeekCompare = `/dashboard/analytics${buildAnalyticsFilterQuery({
    ...thisWeek,
    compareDateFrom: lastWeek.dateFrom,
    compareDateTo: lastWeek.dateTo,
    ...sectionQuery,
  })}`;

  const presetClassName =
    'rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:border-primary/30 hover:text-primary';

  return (
    <AdminFilterPanel>
      <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" method="get">
        {section ? <input name="section" type="hidden" value={section} /> : null}
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
          <span className="text-sm font-medium text-neutral-600">{t('filter_period_label')}</span>
          <Link className={presetClassName} href={href7}>
            {t('filter_last_7_days')}
          </Link>
          <Link className={presetClassName} href={href30}>
            {t('filter_last_30_days')}
          </Link>
          <Link className={presetClassName} href={hrefMonthCompare}>
            {t('filter_this_month_vs_last')}
          </Link>
          <Link className={presetClassName} href={hrefWeekCompare}>
            {t('filter_this_week_vs_last')}
          </Link>
        </div>

        <p className="text-sm text-neutral-600 sm:col-span-2 lg:col-span-4">{t('filter_default_convention')}</p>

        <fieldset className="grid gap-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 sm:col-span-2 lg:col-span-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold text-neutral-800">
            {t('filter_period_primary_title')}
          </legend>
          <p className="text-sm text-neutral-600 sm:col-span-2">{t('filter_period_primary_desc')}</p>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700" htmlFor="dateFrom">
              {t('filter_date_from')}
            </label>
            <input
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              defaultValue={props.dateFrom ?? ''}
              id="dateFrom"
              name="dateFrom"
              required
              type="date"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-neutral-700" htmlFor="dateTo">
              {t('filter_date_to')}
            </label>
            <input
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              defaultValue={props.dateTo ?? ''}
              id="dateTo"
              name="dateTo"
              required
              type="date"
            />
          </div>
        </fieldset>

        <fieldset className="grid gap-4 rounded-xl border border-neutral-200 bg-white p-4 sm:col-span-2 lg:col-span-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold text-neutral-800">
            {t('filter_compare_section_title')}
          </legend>
          <p className="text-sm text-neutral-600 sm:col-span-2">{t('filter_compare_section_desc')}</p>
          <p className="text-sm text-neutral-600 sm:col-span-2">{t('filter_compare_any_period_hint')}</p>

          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-neutral-700"
              htmlFor="compareDateFrom"
            >
              {t('filter_compare_date_from')}
            </label>
            <input
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              defaultValue={props.compareDateFrom ?? ''}
              id="compareDateFrom"
              name="compareDateFrom"
              required
              type="date"
            />
          </div>
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-neutral-700"
              htmlFor="compareDateTo"
            >
              {t('filter_compare_date_to')}
            </label>
            <input
              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              defaultValue={props.compareDateTo ?? ''}
              id="compareDateTo"
              name="compareDateTo"
              required
              type="date"
            />
          </div>
        </fieldset>

        <div className="flex items-end sm:col-span-2 lg:col-span-2">
          <button
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover"
            type="submit"
          >
            {t('filter_apply')}
          </button>
        </div>
      </form>
    </AdminFilterPanel>
  );
}
