'use client';

import { formatDateTimeBrasilia } from '@/lib/app-datetime';
import { formatLeadCartItems } from '@/lib/lead-cart';
import { LEAD_STATUSES, type LeadStatus } from '@/lib/lead-status';
import { LeadStatusForm } from '@/components/admin/LeadStatusForm';
import { Link } from '@/libs/I18nNavigation';

type ClientHistoryLead = {
  id: number;
  status: string;
  leadKind: string;
  origin: string;
  itemsJson: string | null;
  equipmentName: string | null;
  lastActivityAt: Date | null;
  createdAt: Date;
};

type ClientHistoryItemProps = {
  lead: ClientHistoryLead;
  labels: {
    kindQuote: string;
    kindCookie: string;
    viewLead: string;
    statusLabels: Record<string, string>;
    statusFieldLabel: string;
    statusSaveLabel: string;
    statusSavedLabel: string;
    statusErrorMessage: string;
  };
};

function activityDate(lead: ClientHistoryLead) {
  const value = lead.lastActivityAt ?? lead.createdAt;
  return value instanceof Date ? value : new Date(value);
}

export function ClientHistoryItem(props: ClientHistoryItemProps) {
  const { lead, labels } = props;
  const statusKey = LEAD_STATUSES.includes(lead.status as LeadStatus)
    ? lead.status
    : 'new';
  const statusLabel = labels.statusLabels[statusKey] ?? labels.statusLabels.new ?? lead.status;
  const kindLabel = lead.leadKind === 'cookie_consent' ? labels.kindCookie : labels.kindQuote;
  const summary = formatLeadCartItems(lead.itemsJson) || lead.equipmentName || lead.origin;

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-neutral-900">
            #{lead.id} · {formatDateTimeBrasilia(activityDate(lead))}
          </p>
          <span className="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
            {statusLabel}
          </span>
        </div>
        <p className="text-xs text-neutral-500">
          {kindLabel} · {lead.origin}
        </p>
        <p className="text-sm text-neutral-700">{summary}</p>
        <LeadStatusForm
          compact
          currentStatus={lead.status}
          errorMessage={labels.statusErrorMessage}
          fieldLabel={labels.statusFieldLabel}
          labels={labels.statusLabels as Record<LeadStatus, string>}
          leadId={lead.id}
          saveLabel={labels.statusSaveLabel}
          savedLabel={labels.statusSavedLabel}
        />
      </div>
      <Link
        className="shrink-0 text-sm font-medium text-primary hover:underline"
        href={`/dashboard/leads/${lead.id}`}
      >
        {labels.viewLead}
      </Link>
    </li>
  );
}
