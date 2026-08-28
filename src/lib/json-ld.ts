import type { BlogArticle } from '@/types/blog-article';
import type { FaqItem } from '@/data/faq';
import { brand } from '@/lib/brand';
import type { CategorySeoContent } from '@/lib/categories-seo';
import { getEquipmentSchemaDescription } from '@/lib/equipment-meta-description';
import type { Equipment, EquipmentCategory } from '@/types/equipment';
import { CATEGORY_LABELS } from '@/types/equipment';
import { getBaseUrl } from '@/utils/Helpers';

const SCHEMA_CONTEXT = 'https://schema.org';

type BreadcrumbItem = {
  name: string;
  path: string;
};

function entityId(path: string, fragment: string) {
  return `${getBaseUrl()}${path}${fragment}`;
}

/**
 * Resolves equipment image to an absolute URL for schema.org.
 */
function equipmentImageUrl(imagePath: string) {
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  const normalized = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  return `${getBaseUrl()}${normalized}`;
}

function postalAddress() {
  return {
    '@type': 'PostalAddress',
    streetAddress: brand.address.street,
    addressLocality: brand.address.city,
    addressRegion: brand.address.state,
    postalCode: brand.address.zip,
    addressCountry: 'BR',
  };
}

function buildAreaServedNodes() {
  return [
    ...brand.serviceAreaCities.map((name) => ({
      '@type': 'City' as const,
      name,
      containedInPlace: {
        '@type': 'State' as const,
        name: 'Minas Gerais',
      },
    })),
    {
      '@type': 'AdministrativeArea' as const,
      name: 'Região Metropolitana de Belo Horizonte',
      containedInPlace: {
        '@type': 'State' as const,
        name: 'Minas Gerais',
      },
    },
  ];
}

function organizationNode(baseUrl: string) {
  return {
    '@type': 'Organization',
    '@id': `${baseUrl}/#organization`,
    name: brand.name,
    legalName: brand.legalName,
    url: baseUrl,
    email: brand.email,
    telephone: `+55${brand.phone}`,
    foundingDate: String(brand.foundedYear),
    logo: {
      '@type': 'ImageObject',
      url: `${baseUrl}/assets/brand/logo-acesso-header.png`,
      width: 1002,
      height: 280,
    },
    image: `${baseUrl}/assets/brand/logo-acesso-header.png`,
    sameAs: [brand.instagramUrl, brand.linkedinUrl],
    address: postalAddress(),
  };
}

function localBusinessNode(baseUrl: string) {
  return {
    '@type': 'LocalBusiness',
    '@id': `${baseUrl}/#localbusiness`,
    name: brand.name,
    legalName: brand.legalName,
    url: baseUrl,
    telephone: `+55${brand.phone}`,
    email: brand.email,
    image: `${baseUrl}/opengraph-image`,
    priceRange: '$$',
    parentOrganization: { '@id': `${baseUrl}/#organization` },
    address: postalAddress(),
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '07:30',
        closes: '17:15',
      },
    ],
    areaServed: buildAreaServedNodes(),
    geo: {
      '@type': 'GeoCoordinates',
      latitude: -19.9167,
      longitude: -43.9345,
    },
  };
}

function webSiteNode(baseUrl: string) {
  return {
    '@type': 'WebSite',
    '@id': `${baseUrl}/#website`,
    url: baseUrl,
    name: brand.name,
    description: `Locação de equipamentos para construção civil em ${brand.seoRegion}.`,
    inLanguage: 'pt-BR',
    publisher: { '@id': `${baseUrl}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/equipamentos?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Site-wide @graph: Organization, LocalBusiness (NAP) and WebSite with SearchAction.
 */
export function buildMarketingGraphJsonLd() {
  const baseUrl = getBaseUrl();

  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': [organizationNode(baseUrl), localBusinessNode(baseUrl), webSiteNode(baseUrl)],
  };
}

/**
 * @deprecated Prefer buildMarketingGraphJsonLd. Kept for tests and backward compatibility.
 */
export function buildLocalBusinessJsonLd() {
  const baseUrl = getBaseUrl();
  const node = localBusinessNode(baseUrl);
  return {
    '@context': SCHEMA_CONTEXT,
    ...node,
  };
}

/**
 * BreadcrumbList for category, equipment and institutional pages.
 */
function buildBreadcrumbListJsonLd(items: BreadcrumbItem[]) {
  const baseUrl = getBaseUrl();

  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${baseUrl}${item.path}`,
    })),
  };
}

/**
 * Product schema for equipment rental (price on request — no numeric price).
 */
export function buildProductJsonLd(equipment: Equipment, imagePath?: string | string[] | null) {
  const baseUrl = getBaseUrl();
  const path = `/equipamentos/${equipment.slug}`;
  const url = `${baseUrl}${path}`;
  const imagePaths = Array.isArray(imagePath)
    ? imagePath
    : imagePath
      ? [imagePath]
      : [];

  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'Product',
    '@id': entityId(path, '#product'),
    name: equipment.name,
    description: getEquipmentSchemaDescription(equipment),
    category: CATEGORY_LABELS[equipment.category],
    url,
    sku: equipment.slug,
    ...(imagePaths.length > 0
      ? { image: imagePaths.map((pathItem) => equipmentImageUrl(pathItem)) }
      : {}),
    brand: {
      '@type': 'Brand',
      name: brand.name,
    },
    offers: {
      '@type': 'Offer',
      '@id': entityId(path, '#offer'),
      url,
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
      description: 'Valor de locação sob consulta com a equipe comercial.',
      seller: { '@id': `${baseUrl}/#organization` },
    },
  };
}

/**
 * Equipment detail @graph: Product + BreadcrumbList.
 */
export function buildEquipmentPageJsonLd(equipment: Equipment, imagePath?: string | string[] | null) {
  const categoryLabel = CATEGORY_LABELS[equipment.category];

  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': [
      buildProductJsonLd(equipment, imagePath),
      buildBreadcrumbListJsonLd([
        { name: 'Início', path: '/' },
        { name: 'Equipamentos', path: '/equipamentos' },
        { name: categoryLabel, path: `/categorias/${equipment.category}` },
        { name: equipment.name, path: `/equipamentos/${equipment.slug}` },
      ]),
    ],
  };
}

/**
 * Category landing @graph: CollectionPage, BreadcrumbList and ItemList.
 */
export function buildCategoryPageJsonLd(options: {
  slug: EquipmentCategory;
  seo: CategorySeoContent;
  equipment: Equipment[];
}) {
  const baseUrl = getBaseUrl();
  const path = `/categorias/${options.slug}`;
  const pageUrl = `${baseUrl}${path}`;
  const listId = `${pageUrl}#itemlist`;

  const itemList = {
    '@type': 'ItemList',
    '@id': listId,
    name: `Catálogo — ${CATEGORY_LABELS[options.slug]}`,
    numberOfItems: options.equipment.length,
    itemListElement: options.equipment.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: `${baseUrl}/equipamentos/${item.slug}`,
    })),
  };

  const collectionPage = {
    '@type': 'CollectionPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: options.seo.h1,
    description: options.seo.metaDescription,
    inLanguage: 'pt-BR',
    isPartOf: { '@id': `${baseUrl}/#website` },
    about: {
      '@type': 'Thing',
      name: CATEGORY_LABELS[options.slug],
    },
    breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
    mainEntity: { '@id': listId },
  };

  const breadcrumb = {
    ...buildBreadcrumbListJsonLd([
      { name: 'Início', path: '/' },
      { name: 'Equipamentos', path: '/equipamentos' },
      { name: CATEGORY_LABELS[options.slug], path },
    ]),
    '@id': `${pageUrl}#breadcrumb`,
  };

  const graph: Record<string, unknown>[] = [collectionPage, breadcrumb, itemList];

  if (options.seo.faqs && options.seo.faqs.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${pageUrl}#faq`,
      url: pageUrl,
      inLanguage: 'pt-BR',
      isPartOf: { '@id': `${baseUrl}/#website` },
      mainEntity: options.seo.faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    });
  }

  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': graph,
  };
}

/**
 * Equipment catalog page: CollectionPage + ItemList for full fleet.
 */
export function buildEquipmentCatalogJsonLd(equipment: Equipment[]) {
  const baseUrl = getBaseUrl();
  const path = '/equipamentos';
  const pageUrl = `${baseUrl}${path}`;
  const listId = `${pageUrl}#itemlist`;

  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: 'Catálogo de equipamentos para locação',
        description:
          'Frota completa de equipamentos para construção civil em Belo Horizonte e região metropolitana.',
        inLanguage: 'pt-BR',
        isPartOf: { '@id': `${baseUrl}/#website` },
        mainEntity: { '@id': listId },
      },
      buildBreadcrumbListJsonLd([
        { name: 'Início', path: '/' },
        { name: 'Equipamentos', path },
      ]),
      {
        '@type': 'ItemList',
        '@id': listId,
        numberOfItems: equipment.length,
        itemListElement: equipment.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          url: `${baseUrl}/equipamentos/${item.slug}`,
        })),
      },
    ],
  };
}

/**
 * FAQPage schema aligned with visible accordion content.
 */
export function buildFaqPageJsonLd(items: FaqItem[]) {
  const baseUrl = getBaseUrl();
  const path = '/faq';

  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': [
      {
        '@type': 'FAQPage',
        '@id': `${baseUrl}${path}#faq`,
        url: `${baseUrl}${path}`,
        inLanguage: 'pt-BR',
        isPartOf: { '@id': `${baseUrl}/#website` },
        mainEntity: items.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
      buildBreadcrumbListJsonLd([
        { name: 'Início', path: '/' },
        { name: 'Perguntas frequentes', path },
      ]),
    ],
  };
}

/**
 * BlogPosting schema for a /dicas article.
 */
export function buildDicaArticleJsonLd(article: BlogArticle) {
  const baseUrl = getBaseUrl();
  const path = `/dicas/${article.slug}`;
  const url = `${baseUrl}${path}`;

  const blogPosting: Record<string, unknown> = {
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    headline: article.title,
    description: article.metaDescription,
    url,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt.slice(0, 10),
    inLanguage: 'pt-BR',
    author: { '@id': `${baseUrl}/#organization` },
    publisher: { '@id': `${baseUrl}/#organization` },
    isPartOf: { '@id': `${baseUrl}/#website` },
    mainEntityOfPage: url,
  };

  if (article.coverImageUrl) {
    blogPosting.image = equipmentImageUrl(article.coverImageUrl);
  }

  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': [
      blogPosting,
      buildBreadcrumbListJsonLd([
        { name: 'Início', path: '/' },
        { name: 'Blog', path: '/dicas' },
        { name: article.title, path },
      ]),
    ],
  };
}

/**
 * CollectionPage schema for /dicas index.
 */
export function buildDicasIndexJsonLd(articles: BlogArticle[]) {
  const baseUrl = getBaseUrl();
  const path = '/dicas';
  const url = `${baseUrl}${path}`;

  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#collection`,
        name: 'Blog — locação de equipamentos',
        description:
          'Artigos sobre plataformas elevatórias, concretagem, andaimes, segurança e inovação em obras em Belo Horizonte.',
        url,
        inLanguage: 'pt-BR',
        isPartOf: { '@id': `${baseUrl}/#website` },
      },
      buildBreadcrumbListJsonLd([
        { name: 'Início', path: '/' },
        { name: 'Blog', path },
      ]),
      {
        '@type': 'ItemList',
        numberOfItems: articles.length,
        itemListElement: articles.map((article, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: article.title,
          url: `${baseUrl}/dicas/${article.slug}`,
        })),
      },
    ],
  };
}

/**
 * Course schema for aerial platform training page.
 */
export function buildTrainingCourseJsonLd() {
  const baseUrl = getBaseUrl();
  const path = '/treinamento-plataformas-aereas';
  const url = `${baseUrl}${path}`;

  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': [
      {
        '@type': 'Course',
        '@id': `${url}#course`,
        name: 'Treinamento em plataformas elevatórias',
        description:
          'Capacitação para operação segura de plataformas elevatórias (plataforma aérea), alinhada à NR-18 e trabalho em altura.',
        url,
        inLanguage: 'pt-BR',
        provider: { '@id': `${baseUrl}/#organization` },
        areaServed: buildAreaServedNodes(),
        offers: {
          '@type': 'Offer',
          url: `${baseUrl}/orcamento`,
          priceCurrency: 'BRL',
          availability: 'https://schema.org/InStock',
          description: 'Orçamento e turmas sob consulta.',
          seller: { '@id': `${baseUrl}/#organization` },
        },
      },
      buildBreadcrumbListJsonLd([
        { name: 'Início', path: '/' },
        { name: 'Treinamento em plataformas elevatórias', path },
      ]),
    ],
  };
}
