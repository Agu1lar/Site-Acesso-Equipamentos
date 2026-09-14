import { getTranslations } from 'next-intl/server';
import { LeadsDatePresets } from '@/components/admin/LeadsDatePresets';
import { AdminFilterPanel } from '@/components/admin/AdminFilterPanel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { listCampaignFilterOptions } from '@/lib/campaign-analytics';
import { LEAD_STATUSES } from '@/lib/lead-status';
import type { LeadListFilters } from '@/lib/leads-admin';

type LeadsFiltersFormProps = {
  filters: LeadListFilters;
  basePath?: string;
};

export async function LeadsFiltersForm(props: LeadsFiltersFormProps) {
  const { filters, basePath = '/dashboard/leads/consulta' } = props;
  const t = await getTranslations('LeadsAdminPage');
  const campaignOptions = await listCampaignFilterOptions();

  return (
    <AdminFilterPanel title={t('filter_panel_title')}>
      <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" method="get">
        <div className="sm:col-span-2 lg:col-span-3">
          <LeadsDatePresets basePath={basePath} filters={filters} />
        </div>
        <Input
          defaultValue={filters.dateFrom ?? ''}
          id="dateFrom"
          label={t('filter_date_from')}
          name="dateFrom"
          type="date"
        />
        <Input
          defaultValue={filters.dateTo ?? ''}
          id="dateTo"
          label={t('filter_date_to')}
          name="dateTo"
          type="date"
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700" htmlFor="status">
            {t('filter_status')}
          </label>
          <select
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            defaultValue={filters.status ?? ''}
            id="status"
            name="status"
          >
            <option value="">{t('filter_all')}</option>
            {LEAD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`status_${status}`)}
              </option>
            ))}
          </select>
        </div>
        <Input
          defaultValue={filters.city ?? ''}
          id="city"
          label={t('filter_city')}
          name="city"
          placeholder={t('filter_city_placeholder')}
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700" htmlFor="origin">
            {t('filter_origin')}
          </label>
          <select
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            defaultValue={filters.origin ?? ''}
            id="origin"
            name="origin"
          >
            <option value="">{t('filter_all')}</option>
            <option value="paid">{t('origin_channel_paid')}</option>
            <option value="organic">{t('origin_channel_organic')}</option>
            <option value="direct">{t('origin_channel_direct')}</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700" htmlFor="campaignKey">
            {t('filter_campaign')}
          </label>
          <select
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            defaultValue={filters.campaignKey ?? ''}
            id="campaignKey"
            name="campaignKey"
          >
            <option value="">{t('filter_all')}</option>
            {campaignOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <Input
            defaultValue={filters.q ?? ''}
            id="q"
            label={t('filter_search')}
            name="q"
            placeholder={t('filter_search_placeholder')}
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
          <Button size="sm" type="submit">
            {t('filter_apply')}
          </Button>
          <Button href={basePath} size="sm" variant="outline">
            {t('filter_clear')}
          </Button>
        </div>
      </form>
    </AdminFilterPanel>
  );
}
