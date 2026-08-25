import type { SolucaoContent } from '@/data/solucoes';
import { Link } from '@/libs/I18nNavigation';

type SolucaoLinksProps = {
  title: string;
  solucoes: SolucaoContent[];
  className?: string;
};

/**
 * Compact solution segment chips for category and equipment interlinking.
 */
export function SolucaoLinks(props: SolucaoLinksProps) {
  if (props.solucoes.length === 0) {
    return null;
  }

  return (
    <section className={props.className}>
      <h2 className="font-heading text-base font-semibold text-neutral-900 sm:text-lg">
        {props.title}
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {props.solucoes.map((solucao) => (
          <li key={solucao.slug}>
            <Link
              className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-sm font-medium text-neutral-800 shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
              href={`/solucoes/${solucao.slug}`}
            >
              {solucao.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
