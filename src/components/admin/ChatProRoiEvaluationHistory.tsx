import { formatDateTimeBrasilia } from '@/lib/app-datetime';
import type { ChatProRoiDashboardEvaluation } from '@/lib/chatpro-roi-dashboard-types';

type ChatProRoiEvaluationHistoryLabels = {
  title: string;
  colStage: string;
  colLikelihood: string;
  colMessages: string;
  colSummary: string;
  colSuggestedStatus: string;
  colEvaluatedAt: string;
  colEstimatedValue: string;
  suggestedStatusHint: string;
  formatEstimatedValue: (value: number) => string;
  stageLabels: Record<ChatProRoiDashboardEvaluation['stage'], string>;
  statusLabels: Record<NonNullable<ChatProRoiDashboardEvaluation['suggestedStatus']>, string>;
};

type ChatProRoiEvaluationHistoryProps = {
  previous: ChatProRoiDashboardEvaluation[];
  labels: ChatProRoiEvaluationHistoryLabels;
};

/**
 * Lists prior Claude ROI evaluations for the same lead below the current one.
 */
export function ChatProRoiEvaluationHistory(props: ChatProRoiEvaluationHistoryProps) {
  if (props.previous.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-neutral-800">{props.labels.title}</h3>
      <ul className="space-y-2">
        {props.previous.map((row) => (
          <li key={row.id}>
            <details className="rounded-lg border border-neutral-200 bg-white">
              <summary className="cursor-pointer list-none px-3 py-2 text-sm marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="font-medium text-neutral-900">
                  {formatDateTimeBrasilia(row.evaluatedAt)}
                </span>
                <span className="text-neutral-500"> · </span>
                <span className="text-neutral-700">{props.labels.stageLabels[row.stage]}</span>
                <span className="text-neutral-500"> · </span>
                <span className="tabular-nums text-neutral-700">{row.dealLikelihood}%</span>
                <span className="text-neutral-500"> · </span>
                <span className="text-neutral-600">
                  {row.messageCount} {props.labels.colMessages.toLowerCase()}
                </span>
              </summary>
              <dl className="grid gap-2 border-t border-neutral-200 px-3 py-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-neutral-500">{props.labels.colStage}</dt>
                  <dd>{props.labels.stageLabels[row.stage]}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">{props.labels.colLikelihood}</dt>
                  <dd className="tabular-nums">{row.dealLikelihood}%</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">{props.labels.colMessages}</dt>
                  <dd className="tabular-nums">{row.messageCount}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">{props.labels.colEvaluatedAt}</dt>
                  <dd>{formatDateTimeBrasilia(row.evaluatedAt)}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">{props.labels.colSuggestedStatus}</dt>
                  <dd>
                    {row.suggestedStatus ? (
                      <span title={props.labels.suggestedStatusHint}>
                        {props.labels.statusLabels[row.suggestedStatus]}
                      </span>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                {row.estimatedMonthlyValueBrl !== null && row.estimatedMonthlyValueBrl > 0 ? (
                  <div>
                    <dt className="text-neutral-500">{props.labels.colEstimatedValue}</dt>
                    <dd>{props.labels.formatEstimatedValue(row.estimatedMonthlyValueBrl)}</dd>
                  </div>
                ) : null}
                <div className="sm:col-span-2">
                  <dt className="text-neutral-500">{props.labels.colSummary}</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-neutral-700">{row.summary || '—'}</dd>
                </div>
              </dl>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
