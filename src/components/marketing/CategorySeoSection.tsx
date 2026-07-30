import { ExpandableParagraphs } from '@/components/marketing/ExpandableParagraphs';
import type { CategorySeoFaq } from '@/lib/categories-seo';

type CategorySeoSectionProps = {
  faqs?: CategorySeoFaq[];
  faqTitle?: string;
  paragraphs: string[];
  readMoreLabel: string;
};

/**
 * SEO copy for category landings: first paragraph visible, rest behind native details.
 * Optional FAQ uses the same details pattern so crawlers see full answers in the DOM.
 */
export function CategorySeoSection(props: CategorySeoSectionProps) {
  if (props.paragraphs.length === 0 && (!props.faqs || props.faqs.length === 0)) {
    return null;
  }

  return (
    <section
      aria-label={props.readMoreLabel}
      className="mt-10 border-t border-neutral-200 pt-8 sm:mt-12 sm:pt-10"
    >
      {props.paragraphs.length > 0 ? (
        <ExpandableParagraphs paragraphs={props.paragraphs} readMoreLabel={props.readMoreLabel} />
      ) : null}

      {props.faqs && props.faqs.length > 0 ? (
        <div className="mt-8">
          {props.faqTitle ? (
            <h2 className="font-heading text-lg font-bold text-neutral-900 sm:text-xl">
              {props.faqTitle}
            </h2>
          ) : null}
          <div className="mt-3 divide-y divide-neutral-200 border-t border-neutral-200">
            {props.faqs.map((faq) => (
              <details className="group py-3" key={faq.question}>
                <summary className="cursor-pointer list-none text-sm font-semibold text-neutral-900 marker:content-none hover:text-primary [&::-webkit-details-marker]:hidden">
                  {faq.question}
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600 sm:text-base">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
