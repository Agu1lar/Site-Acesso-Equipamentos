import { Link } from '@/libs/I18nNavigation';

type SeoPillarCrossLinkProps = {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
  className?: string;
};

/**
 * Cross-link between SEO pillars (regiões ↔ soluções).
 */
export function SeoPillarCrossLink(props: SeoPillarCrossLinkProps) {
  return (
    <section className={`border-t border-neutral-200 bg-white ${props.className ?? ''}`}>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-2xl rounded-[var(--radius-card)] border border-neutral-200 bg-neutral-50 p-6 sm:p-8">
          <h2 className="font-heading text-xl font-bold text-neutral-900 sm:text-2xl">
            {props.title}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-neutral-600">{props.description}</p>
          <Link
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            href={props.href}
          >
            {props.linkLabel}
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
