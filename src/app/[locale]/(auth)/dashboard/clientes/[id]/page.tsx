import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ClientDeleteButton } from '@/components/admin/ClientDeleteButton';
import { ClientHistoryTimeline } from '@/components/admin/ClientHistoryTimeline';
import { AdminCard } from '@/components/admin/AdminCard';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Button } from '@/components/ui/Button';
import { formatDateTimeBrasilia } from '@/lib/app-datetime';
import { getClientById } from '@/lib/clients-admin';
import { requireDashboardAccess } from '@/lib/auth-roles';
import { LEAD_STATUSES } from '@/lib/lead-status';
import { resolveAppLocale } from '@/utils/locale';

type ClientDetailPageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata(props: ClientDetailPageProps): Promise<Metadata> {
  const { locale, id } = await props.params;
  const clientId = Number.parseInt(id, 10);
  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'ClientsPage',
  });

  if (Number.isNaN(clientId)) {
    return { title: t('meta_title') };
  }

  const data = await getClientById(clientId);
  return {
    title: data ? `${data.client.displayName} · ${t('meta_title')}` : t('meta_title'),
    description: t('meta_description'),
  };
}

export default async function ClientDetailPage(props: ClientDetailPageProps) {
  const { locale, id } = await props.params;
  setRequestLocale(resolveAppLocale(locale));

  const clientId = Number.parseInt(id, 10);
  if (Number.isNaN(clientId)) {
    notFound();
  }

  const data = await getClientById(clientId);
  if (!data) {
    notFound();
  }

  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'ClientsPage',
  });
  const tLeads = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'LeadsAdminPage',
  });

  const statusLabels = Object.fromEntries(
    LEAD_STATUSES.map((status) => [status, tLeads(`status_${status}`)]),
  );
  statusLabels.new = tLeads('status_new');

  const { client, leads } = data;
  const access = await requireDashboardAccess();
  const canManage = access.ok && access.role === 'admin';

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button href="/dashboard/clientes" size="sm" variant="outline">
          {t('back_to_list')}
        </Button>
        {canManage ? (
          <ClientDeleteButton
            clientId={client.id}
            displayName={client.displayName}
            email={client.email}
            googleSub={client.googleSub}
            phone={client.phone}
          />
        ) : null}
      </div>

      <AdminPageHeader
        description={t('detail_summary', { count: leads.length })}
        title={client.displayName}
      />

      <AdminCard title={t('section_profile')}>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              {t('field_email')}
            </dt>
            <dd className="mt-1 text-sm text-neutral-900">{client.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              {t('field_phone')}
            </dt>
            <dd className="mt-1 text-sm text-neutral-900">{client.phone ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              {t('field_company')}
            </dt>
            <dd className="mt-1 text-sm text-neutral-900">{client.company ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              {t('field_google')}
            </dt>
            <dd className="mt-1 text-sm text-neutral-900">
              {client.googleSub ? t('google_account_yes') : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              {t('field_first_seen')}
            </dt>
            <dd className="mt-1 text-sm text-neutral-900">
              {formatDateTimeBrasilia(client.firstSeenAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              {t('field_last_activity')}
            </dt>
            <dd className="mt-1 text-sm text-neutral-900">
              {formatDateTimeBrasilia(client.lastActivityAt)}
            </dd>
          </div>
        </dl>
      </AdminCard>

      <ClientHistoryTimeline
        leads={leads}
        labels={{
          title: t('section_history'),
          hint: t('history_hint'),
          kindQuote: tLeads('lead_kind_quote'),
          kindCookie: tLeads('lead_kind_cookie_consent'),
          viewLead: tLeads('view_detail'),
          empty: t('history_empty'),
          statusLabels,
          statusFieldLabel: tLeads('field_status'),
          statusSaveLabel: tLeads('status_save'),
          statusSavedLabel: tLeads('save_success'),
          statusErrorMessage: tLeads('status_update_error'),
        }}
      />
    </div>
  );
}
