import type { RegiaoCategoriaContent } from '@/data/regiao-categoria';
import { getBaseUrl } from '@/utils/Helpers';

const SCHEMA_CONTEXT = 'https://schema.org';

/**
 * WebPage + Service + FAQ + Breadcrumb for a city × category long-tail page.
 */
export function buildRegiaoCategoriaPageJsonLd(content: RegiaoCategoriaContent) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${content.path}`;

  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: content.h1,
        description: content.metaDescription,
        inLanguage: 'pt-BR',
        isPartOf: { '@id': `${baseUrl}/#website` },
        about: { '@id': `${url}#service` },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: `${baseUrl}${content.regiao.heroImage}`,
        },
      },
      {
        '@type': 'Service',
        '@id': `${url}#service`,
        name: content.h1,
        description: content.metaDescription,
        provider: { '@id': `${baseUrl}/#organization` },
        areaServed: {
          '@type': 'City',
          name: content.regiao.name,
          containedInPlace: {
            '@type': 'AdministrativeArea',
            name: 'Minas Gerais',
          },
        },
        serviceType: `Locação de ${content.categoryLabel.toLowerCase()}`,
        url,
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: content.faqs.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Início',
            item: `${baseUrl}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Regiões',
            item: `${baseUrl}/regioes`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: content.regiao.name,
            item: `${baseUrl}/regioes/${content.citySlug}`,
          },
          {
            '@type': 'ListItem',
            position: 4,
            name: content.categoryLabel,
            item: url,
          },
        ],
      },
    ],
  };
}
