import { Link } from '@/libs/I18nNavigation';

export type MarketingBreadcrumbItem = {
  label: string;
  href?: string;
};

type MarketingBreadcrumbProps = {
  items: MarketingBreadcrumbItem[];
  className?: string;
};

/**
 * Visible breadcrumb trail for marketing pages (aligned with JSON-LD where present).
 */
export function MarketingBreadcrumb(props: MarketingBreadcrumbProps) {
  if (props.items.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={`text-xs text-neutral-600 sm:text-sm ${props.className ?? ''}`}
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        {props.items.map((item, index) => {
          const isLast = index === props.items.length - 1;
          return (
            <li className="flex items-center gap-1.5" key={`${item.label}-${index}`}>
              {index > 0 ? (
                <span aria-hidden className="text-neutral-300">
                  /
                </span>
              ) : null}
              {item.href && !isLast ? (
                <Link className="hover:text-primary" href={item.href}>
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? 'font-medium text-neutral-900' : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
