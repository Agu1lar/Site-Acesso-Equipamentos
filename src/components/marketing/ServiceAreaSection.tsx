import { CITY_NAME_TO_REGIAO_SLUG } from '@/data/regioes';
import { brand } from '@/lib/brand';
import { Link } from '@/libs/I18nNavigation';

type ServiceAreaSectionProps = {
  title: string;
  eyebrow: string;
  primaryLabel: string;
  /** Pill after city list — e.g. national coverage hint. */
  moreLabel?: string;
  /** Link to /regioes hub. */
  hubLinkLabel?: string;
  /** Defaults to brand.serviceAreaCities (same list as LocalBusiness schema). */
  cities?: readonly string[];
  /** Highlighted municipality — usually Belo Horizonte (sede). */
  primaryCity?: string;
  className?: string;
};

function MapPinIcon() {
  return (
    <svg aria-hidden className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M12 21s7-4.5 7-11a7 7 0 10-14 0c0 6.5 7 11 7 11z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
      />
      <circle cx="12" cy="10" r="2.25" strokeWidth={1.75} />
    </svg>
  );
}

/**
 * Visual block for local SEO — municipalities served around Belo Horizonte.
 * @param props Section copy, optional city list and hub link label.
 * @returns Service-area section with city pills linked to /regioes when available.
 */
export function ServiceAreaSection(props: ServiceAreaSectionProps) {
  const cities = props.cities ?? brand.serviceAreaCities;
  const primaryCity = props.primaryCity ?? brand.address.city;

  return (
    <section
      aria-labelledby="service-area-title"
      className={`border-y border-primary/15 bg-gradient-to-b from-primary-light/50 via-primary-light/20 to-surface ${props.className ?? ''}`}
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start lg:gap-12 xl:grid-cols-[minmax(0,26rem)_1fr]">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold tracking-wider text-primary uppercase">
              <MapPinIcon />
              {props.eyebrow}
            </p>
            <h2
              className="mt-3 font-heading text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl"
              id="service-area-title"
            >
              {props.title}
            </h2>
            {props.hubLinkLabel ? (
              <p className="mt-4">
                <Link
                  className="text-sm font-semibold text-primary hover:underline"
                  href="/regioes"
                >
                  {props.hubLinkLabel}
                </Link>
              </p>
            ) : null}
          </div>

          <ul className="flex flex-wrap gap-2 lg:justify-end">
            {cities.map((city) => {
              const isPrimary = city === primaryCity;
              const slug = CITY_NAME_TO_REGIAO_SLUG[city];
              const pillClass = `inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium shadow-sm transition-colors ${
                isPrimary
                  ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'border-neutral-200/90 bg-white text-neutral-800 hover:border-primary/40 hover:text-primary'
              }`;

              return (
                <li key={city}>
                  {slug ? (
                    <Link className={pillClass} href={`/regioes/${slug}`}>
                      {isPrimary ? <MapPinIcon /> : null}
                      <span>{city}</span>
                      {isPrimary ? (
                        <span className="rounded-full border border-white/70 px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                          {props.primaryLabel}
                        </span>
                      ) : null}
                    </Link>
                  ) : (
                    <span className={pillClass}>
                      {isPrimary ? <MapPinIcon /> : null}
                      <span>{city}</span>
                      {isPrimary ? (
                        <span className="rounded-full border border-white/70 px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase">
                          {props.primaryLabel}
                        </span>
                      ) : null}
                    </span>
                  )}
                </li>
              );
            })}
            {props.moreLabel ? (
              <li>
                <span className="inline-flex items-center rounded-full border border-dashed border-primary/50 bg-primary/5 px-3.5 py-1.5 text-sm font-semibold text-primary shadow-sm">
                  {props.moreLabel}
                </span>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </section>
  );
}
