import { isRegiaoCategoriaCombo } from '@/data/regiao-categoria';
import type { RegiaoContent } from '@/data/regioes';
import { Link } from '@/libs/I18nNavigation';
import type { EquipmentCategory } from '@/types/equipment';

type RegiaoLinksProps = {
  title: string;
  regioes: RegiaoContent[];
  className?: string;
  /** When set, links to /regioes/{city}/{category} for S4 combos. */
  categorySlug?: EquipmentCategory;
};

/**
 * Compact city link chips for category and equipment interlinking.
 */
export function RegiaoLinks(props: RegiaoLinksProps) {
  if (props.regioes.length === 0) {
    return null;
  }

  return (
    <section className={props.className}>
      <h2 className="font-heading text-base font-semibold text-neutral-900 sm:text-lg">
        {props.title}
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {props.regioes.map((regiao) => {
          const href =
            props.categorySlug && isRegiaoCategoriaCombo(regiao.slug, props.categorySlug)
              ? `/regioes/${regiao.slug}/${props.categorySlug}`
              : `/regioes/${regiao.slug}`;
          return (
            <li key={regiao.slug}>
              <Link
                className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
                href={href}
              >
                {regiao.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
