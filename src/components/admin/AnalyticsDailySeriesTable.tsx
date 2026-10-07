import type { DailyConversionRow } from '@/lib/analytics-executive-types';
import { formatBrasiliaDatePt } from '@/lib/app-datetime';

type AnalyticsDailySeriesTableProps = {
  rows: DailyConversionRow[];
  emptyLabel: string;
  colDate: string;
  colPageViews: string;
  colWhatsapp: string;
  colLeads: string;
};

/**
 * Tabular daily conversion series for the executive section.
 */
export function AnalyticsDailySeriesTable(props: AnalyticsDailySeriesTableProps) {
  if (props.rows.length === 0) {
    return <p className="text-sm text-neutral-500">{props.emptyLabel}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-neutral-200 text-neutral-600">
          <tr>
            <th className="px-3 py-2 font-semibold">{props.colDate}</th>
            <th className="px-3 py-2 font-semibold">{props.colPageViews}</th>
            <th className="px-3 py-2 font-semibold">{props.colWhatsapp}</th>
            <th className="px-3 py-2 font-semibold">{props.colLeads}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {props.rows.map((row) => (
            <tr className="hover:bg-neutral-50/80" key={row.date}>
              <td className="px-3 py-2 whitespace-nowrap font-medium text-neutral-900">
                {formatBrasiliaDatePt(row.date)}
              </td>
              <td className="px-3 py-2 tabular-nums text-neutral-700">{row.pageViews}</td>
              <td className="px-3 py-2 tabular-nums text-neutral-700">{row.whatsappClicks}</td>
              <td className="px-3 py-2 tabular-nums text-neutral-700">{row.quoteSubmits}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
