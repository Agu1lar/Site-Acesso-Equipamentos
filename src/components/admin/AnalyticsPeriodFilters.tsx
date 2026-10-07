'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  analyticsPeriodDayCount,
  buildAnalyticsFilterQuery,
  currentMonthToDateRange,
  previousPeriodRange,
} from '@/lib/analytics-period';
import {
  formatBrasiliaDatePt,
  formatBrasiliaDateRangePt,
  maskBrasiliaDatePt,
  parseBrasiliaDatePt,
} from '@/lib/app-datetime';
import { currentWeekRange, lastDaysRange } from '@/lib/leads-date-presets';
import { Link } from '@/libs/I18nNavigation';
import { AdminFilterPanel } from '@/components/admin/AdminFilterPanel';

type AnalyticsPeriodFiltersProps = {
  dateFrom: string;
  dateTo: string;
  compareDateFrom?: string;
  compareDateTo?: string;
  comparisonMode: 'auto' | 'custom';
  section?: string;
};

function presetClassName(active: boolean) {
  if (active) {
    return 'rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary shadow-sm';
  }
  return 'rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:border-primary/30 hover:text-primary';
}

function compareModeClassName(active: boolean) {
  if (active) {
    return 'rounded-xl border border-primary bg-primary/5 px-4 py-3 text-left shadow-sm';
  }
  return 'rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-primary/30';
}

function BrazilianDateField(props: {
  disabled?: boolean;
  displayValue: string;
  errorMessage: string;
  formatHint: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const invalid = props.displayValue.length === 10 && !parseBrasiliaDatePt(props.displayValue);
  const hintId = `${props.id}-hint`;

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-neutral-700" htmlFor={props.id}>
        {props.label}
      </label>
      <input
        aria-describedby={hintId}
        aria-invalid={invalid}
        autoComplete="off"
        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm tabular-nums shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 aria-invalid:border-red-500 aria-invalid:ring-red-100 disabled:bg-neutral-100 disabled:text-neutral-600"
        disabled={props.disabled}
        id={props.id}
        inputMode="numeric"
        onChange={(event) => props.onChange(maskBrasiliaDatePt(event.currentTarget.value))}
        pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}"
        placeholder={props.placeholder}
        required
        title={props.errorMessage}
        type="text"
        value={props.displayValue}
      />
      <p
        className={`mt-1 text-xs ${invalid ? 'font-medium text-red-600' : 'text-neutral-500'}`}
        id={hintId}
      >
        {invalid ? props.errorMessage : props.formatHint}
      </p>
    </div>
  );
}

/**
 * Primary period plus an optional comparison range for the analytics dashboard.
 */
export function AnalyticsPeriodFilters(props: AnalyticsPeriodFiltersProps) {
  const t = useTranslations('AnalyticsAdminPage');
  const [compareCustom, setCompareCustom] = useState(props.comparisonMode === 'custom');
  const initialAutoCompare = previousPeriodRange(props.dateFrom, props.dateTo);
  const [dateFromDisplay, setDateFromDisplay] = useState(formatBrasiliaDatePt(props.dateFrom));
  const [dateToDisplay, setDateToDisplay] = useState(formatBrasiliaDatePt(props.dateTo));
  const [compareFromDisplay, setCompareFromDisplay] = useState(
    formatBrasiliaDatePt(props.compareDateFrom || initialAutoCompare.dateFrom),
  );
  const [compareToDisplay, setCompareToDisplay] = useState(
    formatBrasiliaDatePt(props.compareDateTo || initialAutoCompare.dateTo),
  );
  const [rangeError, setRangeError] = useState<'primary' | 'comparison' | null>(null);
  const range7 = lastDaysRange(7);
  const range30 = lastDaysRange(30);
  const thisMonth = currentMonthToDateRange();
  const thisWeek = currentWeekRange();
  const parsedDateFrom = parseBrasiliaDatePt(dateFromDisplay);
  const parsedDateTo = parseBrasiliaDatePt(dateToDisplay);
  const primaryRangeValid = Boolean(
    parsedDateFrom && parsedDateTo && parsedDateFrom <= parsedDateTo,
  );
  const autoCompare = primaryRangeValid && parsedDateFrom && parsedDateTo
    ? previousPeriodRange(parsedDateFrom, parsedDateTo)
    : initialAutoCompare;
  const parsedCompareFrom = parseBrasiliaDatePt(compareFromDisplay);
  const parsedCompareTo = parseBrasiliaDatePt(compareToDisplay);
  const activeCompareFrom = compareCustom ? parsedCompareFrom : autoCompare.dateFrom;
  const activeCompareTo = compareCustom ? parsedCompareTo : autoCompare.dateTo;
  const primaryDays = primaryRangeValid && parsedDateFrom && parsedDateTo
    ? analyticsPeriodDayCount(parsedDateFrom, parsedDateTo)
    : null;
  const comparisonDays = activeCompareFrom && activeCompareTo
    && activeCompareFrom <= activeCompareTo
    ? analyticsPeriodDayCount(activeCompareFrom, activeCompareTo)
    : null;
  const section = props.section?.trim();
  const sectionQuery = section ? { section } : {};

  const presets = [
    { id: '7', label: t('filter_last_7_days'), range: range7 },
    { id: '30', label: t('filter_last_30_days'), range: range30 },
    { id: 'month', label: t('filter_this_month'), range: thisMonth },
    { id: 'week', label: t('filter_this_week'), range: thisWeek },
  ];

  return (
    <AdminFilterPanel>
      <form
        className="grid gap-4"
        lang="pt-BR"
        method="get"
        onSubmit={(event) => {
          if (!parsedDateFrom || !parsedDateTo) {
            event.preventDefault();
            setRangeError(null);
            return;
          }
          if (parsedDateFrom > parsedDateTo) {
            event.preventDefault();
            setRangeError('primary');
            return;
          }
          if (compareCustom && (!parsedCompareFrom || !parsedCompareTo)) {
            event.preventDefault();
            setRangeError(null);
            return;
          }
          if (compareCustom && parsedCompareFrom && parsedCompareTo
            && parsedCompareFrom > parsedCompareTo) {
            event.preventDefault();
            setRangeError('comparison');
            return;
          }
          setRangeError(null);
        }}
      >
        {section ? <input name="section" type="hidden" value={section} /> : null}
        <input name="dateFrom" type="hidden" value={parsedDateFrom ?? ''} />
        <input name="dateTo" type="hidden" value={parsedDateTo ?? ''} />
        {compareCustom ? (
          <>
            <input name="compareDateFrom" type="hidden" value={parsedCompareFrom ?? ''} />
            <input name="compareDateTo" type="hidden" value={parsedCompareTo ?? ''} />
          </>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-neutral-600">{t('filter_period_label')}</span>
          {presets.map((preset) => {
            const active = props.dateFrom === preset.range.dateFrom && props.dateTo === preset.range.dateTo
              && props.comparisonMode === 'auto';
            return (
              <Link
                className={presetClassName(active)}
                href={`/dashboard/analytics${buildAnalyticsFilterQuery({
                  ...preset.range,
                  ...sectionQuery,
                })}`}
                key={preset.id}
              >
                {preset.label}
              </Link>
            );
          })}
        </div>

        <p className="text-sm text-neutral-600">{t('filter_default_convention')}</p>

        <fieldset className="grid gap-4 rounded-xl border border-neutral-200 bg-white p-4">
          <legend className="px-1 text-sm font-semibold text-neutral-800">
            {t('filter_compare_periods_title')}
          </legend>
          <p className="text-sm text-neutral-600">{t('filter_compare_periods_desc')}</p>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              aria-pressed={!compareCustom}
              className={compareModeClassName(!compareCustom)}
              onClick={() => setCompareCustom(false)}
              type="button"
            >
              <span className="block text-sm font-semibold text-neutral-900">
                {t('filter_compare_auto')}
              </span>
              <span className="mt-1 block text-xs text-neutral-600">
                {formatBrasiliaDateRangePt(autoCompare.dateFrom, autoCompare.dateTo)}
              </span>
            </button>
            <button
              aria-pressed={compareCustom}
              className={compareModeClassName(compareCustom)}
              onClick={() => {
                if (!compareCustom) {
                  setCompareFromDisplay(formatBrasiliaDatePt(autoCompare.dateFrom));
                  setCompareToDisplay(formatBrasiliaDatePt(autoCompare.dateTo));
                }
                setCompareCustom(true);
              }}
              type="button"
            >
              <span className="block text-sm font-semibold text-neutral-900">
                {t('filter_compare_custom')}
              </span>
              <span className="mt-1 block text-xs text-neutral-600">
                {t('filter_compare_custom_hint')}
              </span>
            </button>
          </div>

          <div className="grid items-stretch gap-3 sm:grid-cols-2">
            <section className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-neutral-900">
                  {t('filter_preview_primary_label')}
                </h3>
                {primaryDays !== null ? (
                  <span className="text-xs text-neutral-500">
                    {t('filter_period_days', { count: primaryDays })}
                  </span>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <BrazilianDateField
                  displayValue={dateFromDisplay}
                  errorMessage={t('filter_date_invalid')}
                  formatHint={t('filter_date_format_hint')}
                  id="dateFromDisplay"
                  label={t('filter_date_from')}
                  onChange={setDateFromDisplay}
                  placeholder={t('filter_date_placeholder')}
                />
                <BrazilianDateField
                  displayValue={dateToDisplay}
                  errorMessage={t('filter_date_invalid')}
                  formatHint={t('filter_date_format_hint')}
                  id="dateToDisplay"
                  label={t('filter_date_to')}
                  onChange={setDateToDisplay}
                  placeholder={t('filter_date_placeholder')}
                />
              </div>
              {rangeError === 'primary' ? (
                <p className="mt-3 text-sm font-medium text-red-600" role="alert">
                  {t('filter_range_invalid')}
                </p>
              ) : null}
            </section>

            <section className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-neutral-900">
                  {t('filter_preview_comparison_label')}
                </h3>
                {comparisonDays !== null ? (
                  <span className="text-xs text-neutral-500">
                    {t('filter_period_days', { count: comparisonDays })}
                  </span>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <BrazilianDateField
                  disabled={!compareCustom}
                  displayValue={compareCustom
                    ? compareFromDisplay
                    : formatBrasiliaDatePt(autoCompare.dateFrom)}
                  errorMessage={t('filter_date_invalid')}
                  formatHint={compareCustom
                    ? t('filter_date_format_hint')
                    : t('filter_compare_auto_hint')}
                  id="compareDateFromDisplay"
                  label={t('filter_date_from')}
                  onChange={setCompareFromDisplay}
                  placeholder={t('filter_date_placeholder')}
                />
                <BrazilianDateField
                  disabled={!compareCustom}
                  displayValue={compareCustom
                    ? compareToDisplay
                    : formatBrasiliaDatePt(autoCompare.dateTo)}
                  errorMessage={t('filter_date_invalid')}
                  formatHint={compareCustom
                    ? t('filter_date_format_hint')
                    : t('filter_compare_auto_hint')}
                  id="compareDateToDisplay"
                  label={t('filter_date_to')}
                  onChange={setCompareToDisplay}
                  placeholder={t('filter_date_placeholder')}
                />
              </div>

              {rangeError === 'comparison' ? (
                <p className="mt-3 text-sm font-medium text-red-600" role="alert">
                  {t('filter_range_invalid')}
                </p>
              ) : null}
            </section>
          </div>

          {primaryRangeValid && parsedDateFrom && parsedDateTo && primaryDays !== null
            && activeCompareFrom && activeCompareTo && comparisonDays !== null ? (
              <div className="rounded-lg border border-primary/20 bg-primary-light/20 px-4 py-3">
                <p className="text-sm font-semibold text-neutral-900">
                  {t('filter_compare_sentence', {
                    primary: formatBrasiliaDateRangePt(parsedDateFrom, parsedDateTo),
                    comparison: formatBrasiliaDateRangePt(activeCompareFrom, activeCompareTo),
                  })}
                </p>
                {primaryDays !== comparisonDays ? (
                  <p className="mt-2 text-sm font-medium text-amber-800" role="status">
                    {t('filter_period_mismatch_warning')}
                  </p>
                ) : null}
              </div>
            ) : null}
        </fieldset>

        <div>
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
