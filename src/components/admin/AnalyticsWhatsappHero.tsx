import { AdminMetricHelp } from '@/components/admin/AdminMetricHelp';
import { WhatsAppIcon } from '@/components/layout/SocialIcons';

type AnalyticsWhatsappHeroProps = {
  clicks: number;
  clicksWithConsentLabel?: string;
  clicksPrevious: number;
  delta: number;
  deltaLabel: string;
  pageViews: number;
  periodLabel: string;
  clicksLabel: string;
  emptyHint: string;
  rateLabel?: string;
  previousPeriodLabel: string;
  helpLabel: string;
  helpText: string;
  title: string;
};

/**
 * Prominent WhatsApp click counter for the analytics dashboard.
 */
export function AnalyticsWhatsappHero(props: AnalyticsWhatsappHeroProps) {
  const deltaPositive = props.delta >= 0;
  const whatsappRate =
    props.pageViews > 0 ? Math.round((props.clicks / props.pageViews) * 100) : undefined;

  return (
    <section className="rounded-2xl border border-cta-whatsapp/25 bg-gradient-to-br from-emerald-50/90 via-white to-white p-6 shadow-sm ring-1 ring-cta-whatsapp/10 sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cta-whatsapp text-white shadow-md shadow-cta-whatsapp/25"
          >
            <WhatsAppIcon className="h-8 w-8" />
          </div>
          <div className="min-w-0">
            <div className="flex items-start gap-2">
              <h2 className="font-heading text-xl font-bold text-neutral-900 sm:text-2xl">
                {props.title}
              </h2>
              <AdminMetricHelp label={props.helpLabel} text={props.helpText} />
            </div>
            <p className="mt-1 text-sm text-neutral-600">{props.periodLabel}</p>
            {props.clicks === 0 ? (
              <p className="mt-2 text-sm text-neutral-500">{props.emptyHint}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 lg:items-end">
          <p className="font-heading text-6xl font-bold leading-none tabular-nums text-cta-whatsapp sm:text-7xl">
            {props.clicks}
          </p>
          <p className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
            {props.clicksLabel}
          </p>
          {props.clicksWithConsentLabel ? (
            <p className="mt-1 text-sm text-neutral-600">{props.clicksWithConsentLabel}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-cta-whatsapp/15 pt-4 text-sm">
        <p className={`font-medium ${deltaPositive ? 'text-emerald-700' : 'text-red-600'}`}>
          {deltaPositive ? '+' : ''}
          {props.delta}% {props.deltaLabel}
        </p>
        {whatsappRate !== undefined && props.rateLabel ? (
          <p className="text-neutral-600">{props.rateLabel}</p>
        ) : null}
        <p className="text-neutral-500">{props.previousPeriodLabel}</p>
      </div>
    </section>
  );
}
