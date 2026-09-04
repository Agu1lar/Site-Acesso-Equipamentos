import { Fragment } from 'react';
import { AdminDragScroll } from '@/components/admin/AdminDragScroll';
import { ChatProRoiEvaluationHistory } from '@/components/admin/ChatProRoiEvaluationHistory';
import { ChatProRoiFrozenBadge } from '@/components/admin/ChatProRoiFrozenBadge';
import { formatDateTimeBrasilia } from '@/lib/app-datetime';
import { isRoiJourneyFrozen } from '@/lib/chatpro-roi-eligibility';
import { formatRoiStageLabel } from '@/lib/chatpro-roi-diverted';
import type { ChatProRoiDashboardEvaluation } from '@/lib/chatpro-roi-dashboard-types';
import type { ChatProRoiLeadEvaluationGroup } from '@/lib/chatpro-roi-group';
import { Link } from '@/libs/I18nNavigation';

type ChatProRoiEvaluationsTableProps = {
  groups: ChatProRoiLeadEvaluationGroup[];
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
    colVersions: string;
    suggestedStatusHint: string;
    versionsCount: string;
    historyToggle: string;
    historyTitle: string;
    frozenBadge: string;
    frozenHint: string;
    colEstimatedValue: string;
    formatEstimatedValue: (value: number) => string;
    viewLead: string;
    stageLabels: Record<ChatProRoiDashboardEvaluation['stage'], string>;
    divertedWithPhone: (phone: string) => string;
    priorityLabels: Record<ChatProRoiDashboardEvaluation['followUpPriority'], string>;
    statusLabels: Record<NonNullable<ChatProRoiDashboardEvaluation['suggestedStatus']>, string>;
  };
};

const COLUMN_COUNT = 11;

/**
 * Lists one compact row per lead; prior evaluations stay collapsed under a toggle.
 */
export function ChatProRoiEvaluationsTable(props: ChatProRoiEvaluationsTableProps) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-100 px-5 py-4">
        <h2 className="font-heading text-lg font-bold text-neutral-900">{props.labels.title}</h2>
      </div>

      {props.groups.length === 0 ? (
        <p className="px-5 py-8 text-sm text-neutral-500">{props.labels.empty}</p>
      ) : (
        <AdminDragScroll>
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-500">
                <th className="px-5 py-3 font-medium">{props.labels.colLead}</th>
                <th className="px-5 py-3 font-medium">{props.labels.colCampaign}</th>
                <th className="px-5 py-3 font-medium">{props.labels.colStage}</th>
                <th className="px-5 py-3 font-medium">{props.labels.colLikelihood}</th>
                <th className="px-5 py-3 font-medium">{props.labels.colPriority}</th>
                <th className="px-5 py-3 font-medium">{props.labels.colMessages}</th>
                <th className="px-5 py-3 font-medium">{props.labels.colVersions}</th>
                <th className="px-5 py-3 font-medium">{props.labels.colSuggestedStatus}</th>
                <th className="px-5 py-3 font-medium">{props.labels.colEvaluatedAt}</th>
                <th className="px-5 py-3 font-medium">{props.labels.colSummary}</th>
                <th className="sticky right-0 z-10 bg-neutral-50/95 px-5 py-3 font-medium shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.18)]" />
              </tr>
            </thead>
            <tbody>
              {props.groups.map((group) => {
                const row = group.latest;
                const versionTotal = group.previous.length + 1;
                const previousCount = group.previous.length;
                const frozen = isRoiJourneyFrozen({
                  status: row.leadStatus,
                  lastEvaluationStage: row.stage,
                });

                return (
                  <Fragment key={group.leadId}>
                    <tr className="group border-b border-neutral-100 align-top hover:bg-neutral-50/80">
                      <td className="px-5 py-3">
                        <p className="font-medium text-neutral-900">{row.leadName}</p>
                        <p className="text-xs text-neutral-500">#{row.leadId}</p>
                        {frozen ? (
                          <p className="mt-1">
                            <ChatProRoiFrozenBadge
                              hint={props.labels.frozenHint}
                              label={props.labels.frozenBadge}
                            />
                          </p>
                        ) : null}
                      </td>
                      <td className="max-w-[10rem] truncate px-5 py-3 text-neutral-700">
                        {row.utmCampaign?.trim() || '—'}
                      </td>
                      <td className="px-5 py-3 text-neutral-700">
                        {formatRoiStageLabel({
                          stage: row.stage,
                          divertedToPhone: row.divertedToPhone,
                          stageLabels: props.labels.stageLabels,
                          divertedWithPhone: props.labels.divertedWithPhone,
                        })}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-neutral-700">
                        {row.dealLikelihood}%
                      </td>
                      <td className="px-5 py-3 text-neutral-700">
                        {props.labels.priorityLabels[row.followUpPriority]}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-neutral-700">{row.messageCount}</td>
                      <td className="px-5 py-3 tabular-nums text-neutral-700">
                        {props.labels.versionsCount.replace('{count}', String(versionTotal))}
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
                      <td className="sticky right-0 z-10 bg-white px-5 py-3 shadow-[-8px_0_12px_-8px_rgba(0,0,0,0.18)] group-hover:bg-neutral-50">
                        <Link
                          className="whitespace-nowrap font-medium text-primary hover:underline"
                          href={`/dashboard/leads/${row.leadId}`}
                        >
                          {props.labels.viewLead}
                        </Link>
                      </td>
                    </tr>
                    {previousCount > 0 ? (
                      <tr className="border-b border-neutral-100 bg-neutral-50/60 last:border-0">
                        <td className="px-5 py-2" colSpan={COLUMN_COUNT}>
                          <details className="group">
                            <summary className="cursor-pointer list-none text-sm font-medium text-primary marker:content-none hover:underline [&::-webkit-details-marker]:hidden">
                              {props.labels.historyToggle.replace('{count}', String(previousCount))}
                            </summary>
                            <div className="mt-3 max-w-3xl pb-2">
                              <ChatProRoiEvaluationHistory
                                labels={{
                                  title: props.labels.historyTitle,
                                  colStage: props.labels.colStage,
                                  colLikelihood: props.labels.colLikelihood,
                                  colMessages: props.labels.colMessages,
                                  colSummary: props.labels.colSummary,
                                  colSuggestedStatus: props.labels.colSuggestedStatus,
                                  colEvaluatedAt: props.labels.colEvaluatedAt,
                                  colEstimatedValue: props.labels.colEstimatedValue,
                                  suggestedStatusHint: props.labels.suggestedStatusHint,
                                  formatEstimatedValue: props.labels.formatEstimatedValue,
                                  stageLabels: props.labels.stageLabels,
                                  divertedWithPhone: props.labels.divertedWithPhone,
                                  statusLabels: props.labels.statusLabels,
                                }}
                                previous={group.previous}
                              />
                            </div>
                          </details>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </AdminDragScroll>
      )}
    </section>
  );
}
