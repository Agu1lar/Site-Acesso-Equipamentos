import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { LeadChatProRoiSection } from '@/components/admin/LeadChatProRoiSection';
import { LeadCartItemsList } from '@/components/admin/LeadCartItemsList';
import { LeadContactHistory } from '@/components/admin/LeadContactHistory';
import { LeadWhatsAppBadge } from '@/components/admin/LeadWhatsAppBadge';
import { LeadNotesForm } from '@/components/admin/LeadNotesForm';
import { LeadPriorityBadge } from '@/components/admin/LeadPriorityBadge';
import { LeadRecurringBadge } from '@/components/admin/LeadRecurringBadge';
import { LeadStatusForm } from '@/components/admin/LeadStatusForm';
import { AdminCard } from '@/components/admin/AdminCard';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Button } from '@/components/ui/Button';
import { LEAD_STATUSES } from '@/lib/lead-status';
import type { LeadStatus } from '@/lib/lead-status';
import { resolveLeadWhatsAppStatus } from '@/lib/lead-whatsapp-status';
import { scoreLeadIntent } from '@/lib/lead-intent-score';
import { formatDateTimeBrasilia } from '@/lib/app-datetime';
import { formatLeadCartItems, getLeadById, listRelatedLeads, parseLeadCartItems } from '@/lib/leads-admin';
import { resolveAppLocale } from '@/utils/locale';

type LeadDetailPageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata(props: LeadDetailPageProps): Promise<Metadata> {
  const { locale, id } = await props.params;
  const lead = await getLeadById(Number.parseInt(id, 10));
  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'LeadsAdminPage',
  });
  return {
    title: lead ? t('detail_meta_title', { id: lead.id, name: lead.name }) : t('meta_title'),
  };
}

export default async function LeadDetailPage(props: LeadDetailPageProps) {
  const { locale, id } = await props.params;
  setRequestLocale(resolveAppLocale(locale));
  const t = await getTranslations({
    locale: resolveAppLocale(locale),
    namespace: 'LeadsAdminPage',
  });

  const leadId = Number.parseInt(id, 10);
  if (Number.isNaN(leadId)) {
    notFound();
  }

  const lead = await getLeadById(leadId);
  if (!lead) {
    notFound();
  }

  const relatedLeads = await listRelatedLeads(lead);
  const contactCount = relatedLeads.length;
  const cartItems = parseLeadCartItems(lead.itemsJson);
  const activityAt = lead.lastActivityAt ?? lead.createdAt;
  const statusLabels = Object.fromEntries(
    LEAD_STATUSES.map((status) => [status, t(`status_${status}` as 'status_new')]),
  ) as Record<LeadStatus, string>;
  const displayStatus = statusLabels[lead.status as LeadStatus] ?? lead.status;
  const intent = scoreLeadIntent(lead);
  const whatsappStatus = resolveLeadWhatsAppStatus(lead);
  const whatsappStatusLabel =
    whatsappStatus === 'replied'
      ? t('whatsapp_status_replied')
      : whatsappStatus === 'opened'
        ? t('whatsapp_status_opened')
        : whatsappStatus === 'blocked'
          ? t('whatsapp_status_blocked')
          : whatsappStatus === 'not_applicable'
            ? t('whatsapp_status_not_applicable')
            : t('whatsapp_status_unknown');
  const priorityKey =
    intent.tier === 'hot' ? 'priority_hot' : intent.tier === 'warm' ? 'priority_warm' : 'priority_cold';
  let rentalLabel = lead.rentalPeriod ?? '—';
  if (lead.rentalPeriod === 'diaria') {
    rentalLabel = t('rental_diaria');
  } else if (lead.rentalPeriod === 'semanal') {
    rentalLabel = t('rental_semanal');
  } else if (lead.rentalPeriod === 'mensal') {
    rentalLabel = t('rental_mensal');
  } else if (lead.rentalPeriod === 'ainda_nao_sei') {
    rentalLabel = t('rental_unknown');
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button href="/dashboard/leads" size="sm" variant="outline">
          {t('back_to_list')}
        </Button>
        {lead.clientId ? (
          <Button href={`/dashboard/clientes/${lead.clientId}`} size="sm" variant="outline">
            {t('view_client')}
          </Button>
        ) : null}
        <p className="text-sm text-neutral-500">
          {t('detail_id', { id: lead.id })} · {formatDateTimeBrasilia(activityAt, 'full')}
          {lead.lastActivityAt ? ` (${t('last_activity_label')})` : null}
        </p>
      </div>

      <AdminPageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {lead.name}
            <LeadRecurringBadge
              count={contactCount}
              label={t('recurring_badge', { count: contactCount })}
            />
            <LeadPriorityBadge label={t(priorityKey)} score={intent.score} tier={intent.tier} />
            <LeadWhatsAppBadge label={whatsappStatusLabel} status={whatsappStatus} />
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminCard title={t('section_contact')}>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-neutral-500">{t('field_email')}</dt>
              <dd>
                <a className="text-primary hover:underline" href={`mailto:${lead.email}`}>
                  {lead.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">{t('field_phone')}</dt>
              <dd>
                {lead.phone ? (
                  <a className="text-primary hover:underline" href={`tel:${lead.phone}`}>
                    {lead.phone}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            {lead.company ? (
              <div>
                <dt className="text-neutral-500">{t('field_company')}</dt>
                <dd>{lead.company}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-neutral-500">{t('field_city')}</dt>
              <dd>{lead.city ?? '—'}</dd>
            </div>
          </dl>
        </AdminCard>

        <AdminCard title={t('section_request')}>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-neutral-500">{t('field_rental_period')}</dt>
              <dd>{rentalLabel}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">{t('field_whatsapp')}</dt>
              <dd className="mt-1">
                <LeadWhatsAppBadge label={whatsappStatusLabel} status={whatsappStatus} />
                <p className="mt-1 text-xs text-neutral-500">{t(`whatsapp_status_hint_${whatsappStatus}`)}</p>
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">{t('field_origin')}</dt>
              <dd>{lead.origin}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">{t('col_kind')}</dt>
              <dd>
                {lead.leadKind === 'cookie_consent'
                  ? t('lead_kind_cookie_consent')
                  : t('lead_kind_quote')}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-neutral-500">{t('field_status')}</dt>
              <dd className="font-medium text-neutral-900">{displayStatus}</dd>
              <LeadStatusForm
                currentStatus={lead.status}
                errorMessage={t('status_update_error')}
                fieldLabel={t('field_status')}
                labels={statusLabels}
                leadId={lead.id}
                saveLabel={t('status_save')}
                savedLabel={t('save_success')}
              />
            </div>
            {lead.equipmentName ? (
              <div>
                <dt className="text-neutral-500">{t('field_equipment_summary')}</dt>
                <dd>{lead.equipmentName}</dd>
              </div>
            ) : null}
          </dl>
        </AdminCard>
      </div>

      {cartItems.length > 0 ? (
        <AdminCard title={t('section_cart')}>
          <LeadCartItemsList
            catalogNameNoteLabel={(name) => t('cart_catalog_name_note', { name })}
            itemsJson={lead.itemsJson}
            quantityLabel={(count) => t('quantity_label', { count })}
          />
        </AdminCard>
      ) : (
        <AdminCard title={t('section_cart')}>
          <p className="text-sm text-neutral-600">
            {(formatLeadCartItems(lead.itemsJson) || lead.equipmentName) ?? t('cart_empty')}
          </p>
        </AdminCard>
      )}

      {lead.utmSource ||
      lead.utmMedium ||
      lead.utmCampaign ||
      lead.gclid ||
      lead.referrer ||
      lead.landingPage ? (
        <AdminCard title={t('section_attribution')}>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {lead.utmSource ? (
              <div>
                <dt className="text-neutral-500">{t('field_utm_source')}</dt>
                <dd>{lead.utmSource}</dd>
              </div>
            ) : null}
            {lead.utmMedium ? (
              <div>
                <dt className="text-neutral-500">{t('field_utm_medium')}</dt>
                <dd>{lead.utmMedium}</dd>
              </div>
            ) : null}
            {lead.utmCampaign ? (
              <div>
                <dt className="text-neutral-500">{t('field_utm_campaign')}</dt>
                <dd>{lead.utmCampaign}</dd>
              </div>
            ) : null}
            {lead.utmContent ? (
              <div>
                <dt className="text-neutral-500">{t('field_utm_content')}</dt>
                <dd>{lead.utmContent}</dd>
              </div>
            ) : null}
            {lead.utmTerm ? (
              <div>
                <dt className="text-neutral-500">{t('field_utm_term')}</dt>
                <dd>{lead.utmTerm}</dd>
              </div>
            ) : null}
            {lead.gclid ? (
              <div className="sm:col-span-2">
                <dt className="text-neutral-500">{t('field_gclid')}</dt>
                <dd className="break-all font-mono text-xs">{lead.gclid}</dd>
              </div>
            ) : null}
            {lead.landingPage ? (
              <div className="sm:col-span-2">
                <dt className="text-neutral-500">{t('field_landing_page')}</dt>
                <dd className="break-all">{lead.landingPage}</dd>
              </div>
            ) : null}
            {lead.referrer ? (
              <div className="sm:col-span-2">
                <dt className="text-neutral-500">{t('field_referrer')}</dt>
                <dd className="break-all">{lead.referrer}</dd>
              </div>
            ) : null}
          </dl>
        </AdminCard>
      ) : null}

      <LeadChatProRoiSection lead={lead} />

      <LeadContactHistory currentLeadId={lead.id} relatedLeads={relatedLeads} />

      {lead.message ? (
        <AdminCard title={t('section_message')}>
          <p className="text-sm whitespace-pre-wrap text-neutral-700">{lead.message}</p>
        </AdminCard>
      ) : null}

      <AdminCard
        description={t('internal_notes_hint')}
        title={t('section_internal_notes')}
      >
        <LeadNotesForm
          errorMessage={t('notes_update_error')}
          fieldLabel={t('field_internal_notes')}
          initialNotes={lead.internalNotes ?? ''}
          leadId={lead.id}
          placeholder={t('internal_notes_placeholder')}
          saveLabel={t('notes_save')}
          savedLabel={t('save_success')}
        />
      </AdminCard>
    </div>
  );
}
