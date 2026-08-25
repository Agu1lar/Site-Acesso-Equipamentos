import type { RegiaoContent } from '@/data/regioes';
import { getBaseUrl } from '@/utils/Helpers';

const SCHEMA_CONTEXT = 'https://schema.org';

/**
 * WebPage + Service + FAQ + Breadcrumb for a city region landing.
 * @param regiao Region content used to build schema.org graph nodes.
 * @returns JSON-LD graph for the city page.
 */
export function buildRegiaoPageJsonLd(regiao: RegiaoContent) {
  const baseUrl = getBaseUrl();
  const path = `/regioes/${regiao.slug}`;
  const url = `${baseUrl}${path}`;

  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: regiao.h1,
        description: regiao.metaDescription,
        inLanguage: 'pt-BR',
        isPartOf: { '@id': `${baseUrl}/#website` },
        about: { '@id': `${url}#service` },
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: `${baseUrl}${regiao.heroImage}`,
        },
      },
      {
        '@type': 'Service',
        '@id': `${url}#service`,
        name: regiao.h1,
        description: regiao.metaDescription,
        provider: { '@id': `${baseUrl}/#organization` },
        areaServed: {
          '@type': 'City',
          name: regiao.name,
          containedInPlace: {
            '@type': 'AdministrativeArea',
            name: 'Minas Gerais',
          },
        },
        serviceType: 'Locação de equipamentos para construção civil',
        url,
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: regiao.faqs.map((item) => ({
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
            name: regiao.name,
            item: url,
          },
        ],
      },
    ],
  };
}

/**
 * CollectionPage for the /regioes hub.
 * @param regioes Ordered list of city pages for ItemList schema.
 * @returns JSON-LD graph for the regions index.
 */
export function buildRegioesIndexJsonLd(regioes: RegiaoContent[]) {
  const baseUrl = getBaseUrl();
  const path = '/regioes';
  const url = `${baseUrl}${path}`;

  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#webpage`,
        url,
        name: 'Regiões atendidas — Acesso Equipamentos',
        description:
          'Locação de equipamentos na região metropolitana de Belo Horizonte: cidades atendidas, logística e orçamento rápido.',
        inLanguage: 'pt-BR',
        isPartOf: { '@id': `${baseUrl}/#website` },
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: regioes.map((regiao, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: regiao.name,
            url: `${baseUrl}/regioes/${regiao.slug}`,
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
            name: 'Regiões',
            item: url,
          },
        ],
      },
    ],
  };
}
