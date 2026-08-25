import { SolucaoIcon } from '@/components/marketing/SolucaoIcon';
import type { SolucaoContent } from '@/data/solucoes';
import { Link } from '@/libs/I18nNavigation';

type SolucaoSegmentGridProps = {
  solucoes: SolucaoContent[];
  ctaLabel: string;
  className?: string;
};

/**
 * Mills-style clickable segment cards with drawn icons (home + /solucoes hub).
 */
export function SolucaoSegmentGrid(props: SolucaoSegmentGridProps) {
  return (
    <ul
      className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${props.className ?? ''}`}
    >
      {props.solucoes.map((solucao) => (
        <li key={solucao.slug}>
          <Link
            className="group flex h-full flex-col items-start gap-4 border border-neutral-200 bg-white p-6 transition duration-300 hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-[0_16px_40px_-22px_rgba(196,30,36,0.4)]"
            href={`/solucoes/${solucao.slug}`}
          >
            <span className="flex h-14 w-14 items-center justify-center bg-primary/[0.08] text-primary transition-colors group-hover:bg-primary group-hover:text-white">
              <SolucaoIcon className="h-9 w-9" slug={solucao.slug} />
            </span>
            <div className="flex flex-1 flex-col">
              <h3 className="font-heading text-lg font-bold text-neutral-900 group-hover:text-primary">
                {solucao.name}
              </h3>
              <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-neutral-600">
                {solucao.tagline}
              </p>
              <span className="mt-4 text-sm font-semibold text-primary">
                {props.ctaLabel}
                <span aria-hidden className="ml-1 transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
