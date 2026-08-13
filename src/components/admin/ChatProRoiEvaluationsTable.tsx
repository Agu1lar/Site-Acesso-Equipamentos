import { Link } from '@/libs/I18nNavigation';
import { formatDateTimeBrasilia } from '@/lib/app-datetime';
import type { ChatProRoiDashboardEvaluation } from '@/lib/chatpro-roi-dashboard';

type ChatProRoiEvaluationsTableProps = {
  rows: ChatProRoiDashboardEvaluation[];
  latestEvaluationIdByLead: Record<number, number>;
  labels: {
    title: string;
    empty: string;
    colLead: string;
    colCampaign: string;
    colStage: string;
    colLikelihood: string;
    colPriority: string;
    colSummary: string;
    colEvaluatedAt: string;
    colMessages: string;
    colSuggestedStatus: string;
    colRevision: string;
    suggestedStatusHint: string;
    revisionCurrent: string;
    revisionPrevious: string;
    viewLead: string;
    viewHistory: string;
    stageLabels: Record<ChatProRoiDashboardEvaluation['stage'], string>;
    priorityLabels: Record<ChatProRoiDashboardEvaluation['followUpPriority'], string>;
    statusLabels: Record<NonNullable<ChatProRoiDashboardEvaluation['suggestedStatus']>, string>;
  };
};

/**
 * Lists recent Claude ROI evaluations for campaign leads.
 */
export function ChatProRoiEvaluationsTable(props: ChatProRoiEvaluationsTableProps) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-100 px-5 py-4">
        <h2 className="font-heading text-lg font-bold text-neutral-900">{props.labels.title}</h2>
      </div>

      {props.rows.length === 0 ? (
        <p className="px-5 py-8 text-sm text-neutral-500">{props.labels.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-5 py-3 font-medium">{props.labels.colLead}</th>
                <th className="px-5 py-3 font-medium">{props.labels.colCampaign}</th>
                <th className="px-5 py-3 font-medium">{props.labels.colStage}</th>
                <th className="px-5 py-3 font-medium">{props.labels.colLikelihood}</th>
                <th className="px-5 py-3 font-medium">{props.labels.colPriority}</th>
                <th className="px-5 py-3 font-medium">{props.labels.colMessages}</th>
                <th className="px-5 py-3 font-medium">{props.labels.colRevision}</th>
                <th className="px-5 py-3 font-medium">{props.labels.colSuggestedStatus}</th>
                <th className="px-5 py-3 font-medium">{props.labels.colEvaluatedAt}</th>
                <th className="px-5 py-3 font-medium">{props.labels.colSummary}</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {props.rows.map((row) => {
                const isLatest = props.latestEvaluationIdByLead[row.leadId] === row.id;

                return (
                <tr className="border-b border-neutral-100 align-top last:border-0" key={row.id}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-neutral-900">{row.leadName}</p>
                    <p className="text-xs text-neutral-500">#{row.leadId}</p>
                  </td>
                  <td className="max-w-[10rem] truncate px-5 py-3 text-neutral-700">
                    {row.utmCampaign?.trim() || '—'}
                  </td>
                  <td className="px-5 py-3 text-neutral-700">
                    {props.labels.stageLabels[row.stage]}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-neutral-700">{row.dealLikelihood}%</td>
                  <td className="px-5 py-3 text-neutral-700">
                    {props.labels.priorityLabels[row.followUpPriority]}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-neutral-700">{row.messageCount}</td>
                  <td className="px-5 py-3">
                    <span
                      className={
                        isLatest
                          ? 'inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary'
                          : 'inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600'
                      }
                    >
                      {isLatest ? props.labels.revisionCurrent : props.labels.revisionPrevious}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-neutral-700">
                    {row.suggestedStatus ? (
                      <span title={props.labels.suggestedStatusHint}>
                        {props.labels.statusLabels[row.suggestedStatus]}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-neutral-700">
                    {formatDateTimeBrasilia(row.evaluatedAt)}
                  </td>
                  <td className="max-w-sm px-5 py-3 text-neutral-600">
                    <p className="line-clamp-3" title={row.summary}>
                      {row.summary || '—'}
                    </p>
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      className="whitespace-nowrap font-medium text-primary hover:underline"
                      href={`/dashboard/leads/${row.leadId}`}
                    >
                      {isLatest ? props.labels.viewLead : props.labels.viewHistory}
                    </Link>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
