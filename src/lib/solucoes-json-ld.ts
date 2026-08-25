import type { SolucaoContent } from '@/data/solucoes';
import { getBaseUrl } from '@/utils/Helpers';

const SCHEMA_CONTEXT = 'https://schema.org';

/**
 * WebPage + Service + FAQ + Breadcrumb for a solution segment landing.
 * @param solucao Segment content for schema.org nodes.
 * @returns JSON-LD graph for the solution page.
 */
export function buildSolucaoPageJsonLd(solucao: SolucaoContent) {
  const baseUrl = getBaseUrl();
  const path = `/solucoes/${solucao.slug}`;
  const url = `${baseUrl}${path}`;

  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: solucao.h1,
        description: solucao.metaDescription,
        inLanguage: 'pt-BR',
        isPartOf: { '@id': `${baseUrl}/#website` },
        about: { '@id': `${url}#service` },
      },
      {
        '@type': 'Service',
        '@id': `${url}#service`,
        name: solucao.h1,
        description: solucao.metaDescription,
        provider: { '@id': `${baseUrl}/#organization` },
        serviceType: solucao.name,
        areaServed: {
          '@type': 'AdministrativeArea',
          name: 'Região Metropolitana de Belo Horizonte',
        },
        url,
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: solucao.faqs.map((item) => ({
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
            name: 'Soluções',
            item: `${baseUrl}/solucoes`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: solucao.name,
            item: url,
          },
        ],
      },
    ],
  };
}

/**
 * CollectionPage for the /solucoes hub.
 * @param solucoes Ordered segment list for ItemList schema.
 * @returns JSON-LD graph for the solutions index.
 */
export function buildSolucoesIndexJsonLd(solucoes: SolucaoContent[]) {
  const baseUrl = getBaseUrl();
  const path = '/solucoes';
  const url = `${baseUrl}${path}`;

  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#webpage`,
        url,
        name: 'Soluções por segmento — Acesso Equipamentos',
        description:
          'Locação de equipamentos por segmento: mineração, indústria, construção civil, logística e mais na RMBH.',
        inLanguage: 'pt-BR',
        isPartOf: { '@id': `${baseUrl}/#website` },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: solucoes.map((solucao, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: solucao.name,
            url: `${baseUrl}/solucoes/${solucao.slug}`,
          })),
        },
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
            name: 'Soluções',
            item: url,
          },
        ],
      },
    ],
  };
}
