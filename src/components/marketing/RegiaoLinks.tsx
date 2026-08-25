import { Link } from '@/libs/I18nNavigation';
import type { RegiaoContent } from '@/data/regioes';

type RegiaoLinksProps = {
  title: string;
  regioes: RegiaoContent[];
  className?: string;
};

/**
 * Compact city link chips for category and equipment interlinking.
 * @param props Region chips title, list and optional className.
 * @returns Region link section, or null when the list is empty.
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
        {props.regioes.map((regiao) => (
          <li key={regiao.slug}>
            <Link
              className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
              href={`/regioes/${regiao.slug}`}
            >
              {regiao.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
