import { WhatsAppIcon } from '@/components/layout/SocialIcons';
import { Link } from '@/libs/I18nNavigation';

type AnalyticsWhatsappWeekStripProps = {
  clicks: number;
  weekLabel: string;
  title: string;
  clicksLabel: string;
  hint: string;
  formOpensLabel?: string;
  detailHref: string;
  detailLabel: string;
};

/**
 * Compact WhatsApp click counter for the weekly leads dashboard.
 */
export function AnalyticsWhatsappWeekStrip(props: AnalyticsWhatsappWeekStripProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-cta-whatsapp/25 bg-gradient-to-r from-emerald-50/90 to-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cta-whatsapp text-white"
        >
          <WhatsAppIcon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {props.weekLabel}
          </p>
          <p className="font-heading text-base font-bold text-neutral-900">{props.title}</p>
          <p className="mt-1 text-xs leading-snug text-neutral-500">{props.hint}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <div className="text-center sm:text-right">
          <p className="font-heading text-5xl font-bold leading-none tabular-nums text-cta-whatsapp">
            {props.clicks}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-neutral-600">
            {props.clicksLabel}
          </p>
          {props.formOpensLabel ? (
            <p className="mt-1 text-xs text-neutral-500">{props.formOpensLabel}</p>
          ) : null}
        </div>
        <Link
          className="text-sm font-semibold text-primary hover:underline"
          href={props.detailHref}
        >
          {props.detailLabel}
        </Link>
      </div>
    </div>
  );
}
