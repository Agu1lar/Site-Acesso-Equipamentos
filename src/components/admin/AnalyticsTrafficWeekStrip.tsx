type AnalyticsTrafficWeekStripProps = {
  weekLabel: string;
  title: string;
  hint: string;
  totalLabel: string;
  paidLabel: string;
  organicLabel: string;
  directLabel: string;
  total: number;
  paid: number;
  organic: number;
  direct: number;
};

/**
 * Compact number + label for one traffic channel.
 */
function ChannelStat(props: { value: number; label: string; tone: string }) {
  return (
    <div className="min-w-[4.5rem] text-center">
      <p className={`font-heading text-3xl font-bold leading-none tabular-nums ${props.tone}`}>
        {props.value}
      </p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-neutral-600">
        {props.label}
      </p>
    </div>
  );
}

/**
 * Weekly lead counters split by traffic channel on the operational dashboard.
 */
export function AnalyticsTrafficWeekStrip(props: AnalyticsTrafficWeekStripProps) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-sky-50/90 to-white px-5 py-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {props.weekLabel}
          </p>
          <p className="font-heading text-base font-bold text-neutral-900">{props.title}</p>
          <p className="mt-1 text-xs leading-snug text-neutral-500">{props.hint}</p>
        </div>
        <div className="flex flex-wrap items-end gap-5 sm:gap-8">
          <ChannelStat label={props.totalLabel} tone="text-neutral-900" value={props.total} />
          <ChannelStat label={props.paidLabel} tone="text-primary" value={props.paid} />
          <ChannelStat label={props.organicLabel} tone="text-emerald-700" value={props.organic} />
          <ChannelStat label={props.directLabel} tone="text-neutral-700" value={props.direct} />
        </div>
      </div>
    </div>
  );
}
