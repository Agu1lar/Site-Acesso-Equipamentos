import Image from 'next/image';
import type { SolucaoContent } from '@/data/solucoes';
import { Link } from '@/libs/I18nNavigation';

type SolucaoSegmentGridProps = {
  solucoes: SolucaoContent[];
  ctaLabel: string;
  className?: string;
};

/**
 * Photo + copy segment cards for home and /solucoes hub.
 */
export function SolucaoSegmentGrid(props: SolucaoSegmentGridProps) {
  return (
    <ul
      className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 ${props.className ?? ''}`}
    >
      {props.solucoes.map((solucao, index) => (
        <li key={solucao.slug}>
          <Link
            className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-neutral-200 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_18px_48px_-20px_rgba(196,30,36,0.35)]"
            href={`/solucoes/${solucao.slug}`}
          >
            <div className="relative aspect-[16/10] overflow-hidden bg-neutral-100">
              <Image
                alt={solucao.heroAlt}
                className="object-cover brightness-[1.06] contrast-[1.02] saturate-[1.04] transition duration-700 group-hover:scale-[1.04]"
                fill
                priority={index < 3}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                src={solucao.heroImage}
              />
            </div>

            <div className="flex flex-1 flex-col gap-2 border-t border-neutral-100 px-5 pt-5 pb-6">
              <h3 className="font-heading text-lg font-bold text-neutral-900 group-hover:text-primary sm:text-xl">
                {solucao.name}
              </h3>
              <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-neutral-600">
                {solucao.tagline}
              </p>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-primary">
                {props.ctaLabel}
                <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
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
