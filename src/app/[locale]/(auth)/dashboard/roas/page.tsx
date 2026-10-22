import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminCallout } from '@/components/admin/AdminCallout';
import { AdminKpiCard } from '@/components/admin/AdminKpiCard';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { formatBrasiliaDatePt } from '@/lib/app-datetime';
import { loadRoasPanel } from '@/lib/roas-panel-store';
import { resolveRoasRange, roasRatio } from '@/lib/roas-panel';
import { resolveAppLocale } from '@/utils/locale';

type RoasPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>;
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export async function generateMetadata(props: RoasPageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'RoasAdminPage',
  });

  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function RoasPage(props: RoasPageProps) {
  const { locale } = await props.params;
  const searchParams = await props.searchParams;
  setRequestLocale(resolveAppLocale(locale));
  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'RoasAdminPage',
  });
  const range = resolveRoasRange(searchParams);
  const panel = await loadRoasPanel(range);

  return (
    <div className="space-y-8">
      <AdminPageHeader description={t('description')} title={t('title')} />

      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-sm text-neutral-700" htmlFor="dateFrom">
          {t('date_from')}
          <input
            className="rounded-lg border border-neutral-300 px-3 py-2"
            defaultValue={range.dateFrom}
            id="dateFrom"
            name="dateFrom"
            type="date"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700" htmlFor="dateTo">
          {t('date_to')}
          <input
            className="rounded-lg border border-neutral-300 px-3 py-2"
            defaultValue={range.dateTo}
            id="dateTo"
            name="dateTo"
            type="date"
          />
        </label>
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white" type="submit">
          {t('filter')}
        </button>
      </form>

      {panel.schemaReady ? null : <AdminCallout variant="warning">{t('schema_pending')}</AdminCallout>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminKpiCard label={t('kpi_closed')} value={money.format(panel.closedBrl)} />
        <AdminKpiCard label={t('kpi_proposals')} value={panel.proposals} />
        <AdminKpiCard label={t('kpi_spend')} value={panel.spendBrl === null ? t('pending_spend') : money.format(panel.spendBrl)} />
        <AdminKpiCard accent="primary" label={t('kpi_roas')} value={panel.roas === null ? t('pending_roas') : t('roas_value', { value: panel.roas.toFixed(2) })} />
      </div>

      <p className="text-sm text-neutral-500">
        {panel.updatedAt ? t('updated_at', { time: panel.updatedAt }) : t('updated_daily')}
      </p>

      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-neutral-600">
            <tr>
              <th className="px-4 py-3 font-medium">{t('col_date')}</th>
              <th className="px-4 py-3 font-medium">{t('col_proposals')}</th>
              <th className="px-4 py-3 font-medium">{t('col_closed')}</th>
              <th className="px-4 py-3 font-medium">{t('col_spend')}</th>
              <th className="px-4 py-3 font-medium">{t('col_roas')}</th>
            </tr>
          </thead>
          <tbody>
            {panel.days.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-neutral-500" colSpan={5}>{t('empty')}</td>
              </tr>
            ) : (
              panel.days.map((day) => {
                const dayRoas = roasRatio(day.closedBrl, day.spendBrl);
                return (
                  <tr className="border-t border-neutral-100" key={day.date}>
                    <td className="px-4 py-3">{formatBrasiliaDatePt(day.date)}</td>
                    <td className="px-4 py-3 tabular-nums">{day.proposals}</td>
                    <td className="px-4 py-3 tabular-nums">{money.format(day.closedBrl)}</td>
                    <td className="px-4 py-3 tabular-nums">{day.spendBrl === null ? t('pending_spend') : money.format(day.spendBrl)}</td>
                    <td className="px-4 py-3 tabular-nums">{dayRoas === null ? t('pending_roas') : t('roas_value', { value: dayRoas.toFixed(2) })}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
