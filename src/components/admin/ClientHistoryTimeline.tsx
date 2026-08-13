import type { LeadRecord } from '@/lib/leads-admin';
import { AdminCard } from '@/components/admin/AdminCard';
import { ClientHistoryItem } from '@/components/admin/ClientHistoryItem';

type ClientHistoryTimelineProps = {
  leads: LeadRecord[];
  labels: {
    title: string;
    hint: string;
    kindQuote: string;
    kindCookie: string;
    viewLead: string;
    empty: string;
    statusLabels: Record<string, string>;
    statusFieldLabel: string;
    statusSaveLabel: string;
    statusSavedLabel: string;
    statusErrorMessage: string;
  };
};

export function ClientHistoryTimeline(props: ClientHistoryTimelineProps) {
  const { leads, labels } = props;

  if (leads.length === 0) {
    return (
      <AdminCard description={labels.hint} title={labels.title}>
        <p className="text-sm text-neutral-600">{labels.empty}</p>
      </AdminCard>
    );
  }

  return (
    <AdminCard description={labels.hint} title={labels.title}>
      <ul className="divide-y divide-neutral-100">
        {leads.map((lead) => (
          <ClientHistoryItem key={lead.id} labels={labels} lead={lead} />
        ))}
      </ul>
    </AdminCard>
  );
}
