import Image from 'next/image';
import { focusLabel, type RegiaoContent } from '@/data/regioes';
import { Link } from '@/libs/I18nNavigation';

type RegiaoCityCardProps = {
  regiao: RegiaoContent;
  ctaLabel: string;
  imagePriority?: boolean;
  imageSizes?: string;
  /** Compact variant hides the tagline for tighter grids (e.g. nearby cities). */
  compact?: boolean;
};

/**
 * Bright, Mills-inspired city card used on the /regioes hub and nearby lists.
 * Photo has no dark overlay; the focus badge sits on a white pill for contrast.
 */
export function RegiaoCityCard(props: RegiaoCityCardProps) {
  const imageSizes =
    props.imageSizes ?? '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';

  return (
    <Link
      className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-neutral-200 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_18px_48px_-20px_rgba(196,30,36,0.35)]"
      href={`/regioes/${props.regiao.slug}`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-neutral-100">
        <Image
          alt={props.regiao.heroAlt}
          className="object-cover brightness-[1.08] contrast-[1.02] saturate-[1.05] transition duration-700 group-hover:scale-[1.04]"
          fill
          priority={props.imagePriority}
          sizes={imageSizes}
          src={props.regiao.heroImage}
        />
        <span className="absolute top-3 left-3 inline-flex items-center rounded-full bg-white/95 px-3 py-1 text-[10px] font-bold tracking-[0.14em] text-primary uppercase shadow-sm ring-1 ring-black/5">
          {focusLabel(props.regiao.focus)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 border-t border-neutral-100 px-5 pt-5 pb-6">
        <h3 className="font-heading text-lg font-bold text-neutral-900 group-hover:text-primary sm:text-xl">
          {props.regiao.name}
        </h3>
        {props.compact ? null : (
          <p className="line-clamp-2 flex-1 text-sm leading-relaxed text-neutral-600">
            {props.regiao.tagline}
          </p>
        )}
        <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold text-primary">
          {props.ctaLabel}
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </div>
    </Link>
  );
}
