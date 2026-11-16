import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminCallout } from '@/components/admin/AdminCallout';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { formatBrasiliaDatePt } from '@/lib/app-datetime';
import { loadRoasPanel } from '@/lib/roas-panel-store';
import { resolveRoasChannel, resolveRoasRange, roasRatio, visibleRoasDays } from '@/lib/roas-panel';
import { PRIMARY_SELLERS } from '@/lib/commercial-seller';
import { resolveAppLocale } from '@/utils/locale';

type RoasPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ dateFrom?: string; dateTo?: string; channel?: string }>;
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Compact figure for the contract, later proposals, and LTV. */
function ReadingFigure(props: {
  label: string;
  value: string;
  hint: string;
  count: string;
  detail?: string;
  tone: 'primary' | 'neutral' | 'sum';
}) {
  const toneClass = {
    primary: 'border-primary/30 bg-primary/5',
    neutral: 'border-neutral-200 bg-neutral-50',
    sum: 'border-neutral-900/15 bg-neutral-900 text-white',
  }[props.tone];
  const hintClass = props.tone === 'sum' ? 'text-white/70' : 'text-neutral-500';

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className={`text-xs font-medium ${hintClass}`}>{props.label}</p>
      <p className="mt-0.5 font-heading text-xl font-bold tabular-nums">{props.value}</p>
      <p className={`text-xs ${hintClass}`}>{props.count}</p>
      {props.detail ? <p className={`text-xs ${hintClass}`}>{props.detail}</p> : null}
      <p className={`mt-1 text-xs leading-snug ${hintClass}`}>{props.hint}</p>
    </div>
  );
}

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
  const channel = resolveRoasChannel(searchParams.channel);
  const panel = await loadRoasPanel(range, channel);
  const originLabel = {
    paid: t('origin_paid'),
    organic: t('origin_organic'),
    direct: t('origin_direct'),
    referral: t('origin_referral'),
  };
  const selectedOrigin = panel.origins.find((origin) => origin.channel === channel);
  const laterBrl = Number((selectedOrigin?.ltvClosedBrl ?? 0).toFixed(2));
  const laterCount = selectedOrigin?.ltvClosed ?? 0;
  const contractClosedCount = selectedOrigin?.contractClosed ?? 0;
  const contractGeneratedCount = selectedOrigin?.contracts ?? 0;
  const contractGeneratedBrl = selectedOrigin?.contractBrl ?? 0;
  const showSum = Math.abs(panel.closedBrl + laterBrl - panel.ltvClosedBrl) < 0.05;
  const contractShare = showSum && panel.ltvClosedBrl > 0 ? (panel.closedBrl / panel.ltvClosedBrl) * 100 : 0;
  const ltvByDay = new Map(panel.ltvDays.map((day) => [day.date, day]));
  const activeDays = visibleRoasDays(panel.days, ltvByDay, range.dateTo);

  return (
    <div className="space-y-5">
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
        <label className="flex flex-col gap-1 text-sm text-neutral-700" htmlFor="channel">
          {t('origin_filter')}
          <select
            className="rounded-lg border border-neutral-300 px-3 py-2"
            defaultValue={channel}
            id="channel"
            name="channel"
          >
            <option value="paid">{t('origin_paid')}</option>
            <option value="organic">{t('origin_organic')}</option>
            <option value="direct">{t('origin_direct')}</option>
            <option value="referral">{t('origin_referral')}</option>
          </select>
        </label>
        <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white" type="submit">
          {t('filter')}
        </button>
      </form>

      {panel.schemaReady ? null : <AdminCallout variant="warning">{t('schema_pending')}</AdminCallout>}

      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-neutral-500">{t('kpi_roas')}</p>
            <p className="font-heading text-3xl font-bold tabular-nums text-neutral-900">
              {panel.roas === null ? t('pending_roas') : t('roas_value', { value: panel.roas.toFixed(2) })}
            </p>
            <p className="text-xs text-neutral-500">{t('reading_roas_hint')}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-medium text-neutral-500">{t('kpi_spend')}</p>
            <p className="text-lg font-semibold tabular-nums text-neutral-900">
              {panel.spendBrl === null ? t('pending_spend') : money.format(panel.spendBrl)}
            </p>
          </div>
        </div>
        {showSum && panel.ltvClosedBrl > 0 ? (
          <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-neutral-100" aria-hidden="true">
            <div className="bg-primary" style={{ width: `${contractShare}%` }} />
            <div className="bg-neutral-800" style={{ width: `${100 - contractShare}%` }} />
          </div>
        ) : null}
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <ReadingFigure
            count={t('reading_closed', { count: contractClosedCount })}
            detail={t('reading_generated', { count: contractGeneratedCount, value: money.format(contractGeneratedBrl) })}
            hint={t('reading_contract_hint')}
            label={t('reading_contract')}
            tone="primary"
            value={money.format(panel.closedBrl)}
          />
          <ReadingFigure
            count={t('reading_closed', { count: laterCount })}
            hint={t('reading_later_hint')}
            label={t('reading_later')}
            tone="neutral"
            value={money.format(laterBrl)}
          />
          <ReadingFigure
            count={t('reading_closed', { count: panel.ltvProposals })}
            hint={t('reading_ltv_hint')}
            label={t('kpi_ltv')}
            tone="sum"
            value={money.format(panel.ltvClosedBrl)}
          />
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          {t('reading_pipeline', { count: contractClosedCount, value: money.format(panel.closedBrl) })}
          {' '}
          {panel.updatedAt ? t('updated_at', { time: panel.updatedAt }) : t('updated_daily')}
        </p>
      </section>

      <section className="space-y-2">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">{t('segment_title')}</h2>
          <p className="text-xs text-neutral-500">{t('segment_hint')}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {([
            ['plataformas', t('segment_plataformas'), 'bg-primary'],
            ['guindastes', t('segment_guindastes'), 'bg-neutral-800'],
            ['andaimes', t('segment_andaimes'), 'bg-amber-500'],
            ['ferramentas', t('segment_ferramentas'), 'bg-emerald-600'],
          ] as const).map((item) => {
            const value = panel.segments[item[0]];
            const shareBase = panel.segments.plataformas + panel.segments.guindastes + panel.segments.andaimes + panel.segments.ferramentas;
            const share = shareBase > 0 ? (value / shareBase) * 100 : 0;
            return (
              <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2" key={item[0]}>
                <p className="text-xs font-medium text-neutral-500">{item[1]}</p>
                <p className="font-heading text-lg font-bold tabular-nums text-neutral-900">{money.format(value)}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <div className={`h-full ${item[2]}`} style={{ width: `${share}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        {panel.segments.pendingBrl > 0 ? (
          <p className="text-xs text-neutral-500">
            {t('segment_pending', { value: money.format(panel.segments.pendingBrl) })}
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">{t('seller_title')}</h2>
          <p className="text-xs text-neutral-500">{t('seller_hint')}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {PRIMARY_SELLERS.map((name) => {
            const row = panel.sellers.find((seller) => seller.name === name);
            return (
              <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2" key={name}>
                <p className="text-xs font-medium text-neutral-500">{name}</p>
                <p className="font-heading text-lg font-bold tabular-nums text-neutral-900">
                  {money.format(row?.closedBrl ?? 0)}
                </p>
                <p className="text-xs text-neutral-500">{t('reading_closed', { count: row?.proposals ?? 0 })}</p>
              </div>
            );
          })}
        </div>
        {panel.sellers.filter((seller) => !(PRIMARY_SELLERS as readonly string[]).includes(seller.name)).map((seller) => (
          <p className="text-xs text-neutral-600" key={seller.name}>
            {t('seller_other', { name: seller.name, value: money.format(seller.closedBrl), count: seller.proposals })}
          </p>
        ))}
        {panel.unassignedBrl > 0 ? (
          <p className="text-xs text-neutral-500">
            {t('seller_pending', { value: money.format(panel.unassignedBrl), count: panel.unassignedProposals })}
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">{t('origin_title')}</h2>
          <p className="text-xs text-neutral-500">{t('origin_description')}</p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-3 py-2 font-medium">{t('col_origin')}</th>
                <th className="px-3 py-2 font-medium">{t('col_contracts')}</th>
                <th className="px-3 py-2 font-medium">{t('col_contract_closed')}</th>
                <th className="px-3 py-2 font-medium">{t('col_ltv_closed')}</th>
                <th className="px-3 py-2 font-medium">{t('col_ltv_sum')}</th>
              </tr>
            </thead>
            <tbody>
              {panel.origins.filter((origin) => origin.channel === channel).map((origin) => {
                const openBrl = Number((origin.contractBrl - origin.contractClosedBrl).toFixed(2));
                return (
                  <tr className="border-t border-neutral-100" key={origin.channel}>
                    <td className="px-3 py-2">{originLabel[origin.channel]}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {origin.contractClosed}
                      {openBrl > 0 ? (
                        <span className="mt-0.5 block text-xs font-normal text-neutral-500">
                          {t('origin_open', { value: money.format(openBrl) })}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{money.format(origin.contractClosedBrl)}</td>
                    <td className="px-3 py-2 tabular-nums">{money.format(origin.ltvClosedBrl)}</td>
                    <td className="px-3 py-2 tabular-nums">{money.format(origin.contractClosedBrl + origin.ltvClosedBrl)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <details className="rounded-xl border border-neutral-200 bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-neutral-900">
          {t('days_summary', { count: activeDays.length })}
        </summary>
        <p className="px-4 pb-2 text-xs text-neutral-500">{t('days_hint')}</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-3 py-2 font-medium">{t('col_date')}</th>
                <th className="px-3 py-2 font-medium">{t('col_proposals')}</th>
                <th className="px-3 py-2 font-medium">{t('col_closed')}</th>
                <th className="px-3 py-2 font-medium">{t('kpi_ltv')}</th>
                <th className="px-3 py-2 font-medium">{t('col_spend')}</th>
                <th className="px-3 py-2 font-medium">{t('col_roas')}</th>
              </tr>
            </thead>
            <tbody>
              {activeDays.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-neutral-500" colSpan={6}>{t('empty')}</td>
                </tr>
              ) : (
                activeDays.map((day) => {
                  const dayRoas = roasRatio(day.closedBrl, day.spendBrl);
                  const ltv = ltvByDay.get(day.date);
                  const listedBrl = Number(day.proposalsDetail.reduce((sum, proposal) => sum + proposal.valor, 0).toFixed(2));
                  return (
                    <tr className="border-t border-neutral-100" key={day.date}>
                      <td className="px-3 py-2">{formatBrasiliaDatePt(day.date)}</td>
                      <td className="px-3 py-2">
                        <span className="tabular-nums">{day.proposalsDetail.length}</span>
                        {day.proposalsDetail.length > 0 ? (
                          <span className="block font-medium tabular-nums text-neutral-900">{money.format(listedBrl)}</span>
                        ) : null}
                        {day.proposalsDetail.length > 0 ? (
                          <span className="mt-1 flex flex-col gap-0.5 text-xs font-normal text-neutral-500">
                            {day.proposalsDetail.map((proposal) => (
                              <span key={`${day.date}-${proposal.numero}`}>
                                {t('day_proposal', { numero: proposal.numero, value: money.format(proposal.valor) })}
                                {proposal.closed ? null : ` · ${t('day_proposal_open')}`}
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{money.format(day.closedBrl)}</td>
                      <td className="px-3 py-2 tabular-nums">{money.format(ltv?.closedBrl ?? 0)}</td>
                      <td className="px-3 py-2 tabular-nums">{day.spendBrl === null ? t('pending_spend') : money.format(day.spendBrl)}</td>
                      <td className="px-3 py-2 tabular-nums">{dayRoas === null ? t('pending_roas') : t('roas_value', { value: dayRoas.toFixed(2) })}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
