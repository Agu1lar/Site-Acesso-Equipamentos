import { describe, expect, it } from 'vitest';
import { DICAS_ARTICLES } from '@/data/dicas-articles';
import { sectionsToTiptapDoc } from '@/lib/blog-tiptap';
import { FAQ_ITEMS } from '@/data/faq';
import { brand } from '@/lib/brand';
import { getCategorySeo } from '@/lib/categories-seo';
import {
  buildCategoryPageJsonLd,
  buildEquipmentCatalogJsonLd,
  buildEquipmentPageJsonLd,
  buildDicaArticleJsonLd,
  buildDicasIndexJsonLd,
  buildFaqPageJsonLd,
  buildLocalBusinessJsonLd,
  buildMarketingGraphJsonLd,
  buildServiceJsonLd,
  buildTrainingCourseJsonLd,
} from '@/lib/json-ld';
import { getEquipmentSchemaDescription } from '@/lib/equipment-meta-description';
import type { Equipment } from '@/types/equipment';

const equipment: Equipment = {
  slug: 'betoneira',
  name: 'Betoneira',
  category: 'ferramentas-eletricas',
  shortDescription: 'Locação de betoneira em Belo Horizonte — sob consulta.',
  longDescription: 'Descrição longa.',
  specs: [],
  tags: [],
  featured: true,
  available: true,
};

describe('build marketing graph json-ld', () => {
  it('includes Organization, LocalBusiness and WebSite with SearchAction', () => {
    const json = buildMarketingGraphJsonLd();
    const graph = json['@graph'] as Record<string, unknown>[];

    expect(graph).toHaveLength(3);
    expect(graph.some((node) => node['@type'] === 'Organization')).toBeTruthy();
    expect(graph.some((node) => node['@type'] === 'LocalBusiness')).toBeTruthy();

    const organization = graph.find((node) => node['@type'] === 'Organization') as {
      logo?: { '@type'?: string; url?: string; width?: number; height?: number };
      image?: string;
    };
    expect(organization.logo?.['@type']).toBe('ImageObject');
    expect(organization.logo?.url).toContain('/assets/brand/logo-acesso-header.png');
    expect(organization.logo?.width).toBe(1002);
    expect(organization.logo?.height).toBe(280);
    expect(organization.image).toContain('/assets/brand/logo-acesso-header.png');

    const webSite = graph.find((node) => node['@type'] === 'WebSite') as {
      potentialAction?: { '@type'?: string };
    };
    expect(webSite?.potentialAction?.['@type']).toBe('SearchAction');
  });

  it('lists RMBH municipalities in LocalBusiness areaServed', () => {
    const json = buildMarketingGraphJsonLd();
    const graph = json['@graph'] as Record<string, unknown>[];
    const localBusiness = graph.find((node) => node['@type'] === 'LocalBusiness') as {
      areaServed?: { name?: string }[];
    };

    const cityNames = (localBusiness.areaServed ?? []).map((node) => node.name);
    expect(cityNames).toContain('Belo Horizonte');
    expect(cityNames).toContain('Contagem');
    expect(cityNames).toContain('Betim');
    expect(cityNames).toContain('Nova Lima');
  });
});

describe('build local business json-ld', () => {
  it('includes NAP fields aligned with brand', () => {
    // Deprecated export kept for backward compatibility in tests
    const json = buildLocalBusinessJsonLd();

    expect(json['@type']).toBe('LocalBusiness');
    expect(json.name).toBe(brand.name);
    expect(json.telephone).toBe(`+55${brand.phone}`);
    expect(json.email).toBe(brand.email);
  });
});

describe('build service json-ld', () => {
  it('maps equipment to Service schema with provider and serviceType', () => {
    const json = buildServiceJsonLd(equipment);

    expect(json['@type']).toBe('Service');
    expect(json.name).toBe('Betoneira');
    expect(json.description).toBe(getEquipmentSchemaDescription(equipment));
    expect(json.serviceType).toBe('Ferramentas elétricas');
    expect(json.provider).toMatchObject({ '@id': expect.stringContaining('#organization') });
    expect(json.offers).toBeUndefined();
  });

  it('includes absolute image URL when imagePath is provided', () => {
    const json = buildServiceJsonLd(equipment, '/equipamentos/betoneira.webp');

    expect(json.image).toEqual(['http://localhost:3000/equipamentos/betoneira.webp']);
  });

  it('keeps remote blob image URL unchanged', () => {
    const remote = 'https://example.public.blob.vercel-storage.com/betoneira.webp';
    const json = buildServiceJsonLd(equipment, remote);

    expect(json.image).toEqual([remote]);
  });

  it('omits image when imagePath is missing', () => {
    const json = buildServiceJsonLd(equipment);

    expect(json.image).toBeUndefined();
  });
});

describe('build equipment page json-ld', () => {
  it('combines Service and BreadcrumbList in a graph', () => {
    const json = buildEquipmentPageJsonLd(equipment, '/equipamentos/betoneira.webp');
    const graph = json['@graph'] as Record<string, unknown>[];

    expect(graph.some((node) => node['@type'] === 'Service')).toBeTruthy();
    expect(graph.some((node) => node['@type'] === 'BreadcrumbList')).toBeTruthy();
  });
});

describe('build category page json-ld', () => {
  it('exposes CollectionPage, BreadcrumbList and ItemList', () => {
    const seo = getCategorySeo('ferramentas-eletricas');
    const json = buildCategoryPageJsonLd({
      slug: 'ferramentas-eletricas',
      seo,
      equipment: [equipment],
    });
    const graph = json['@graph'] as Record<string, unknown>[];

    expect(graph.some((node) => node['@type'] === 'CollectionPage')).toBeTruthy();
    expect(graph.some((node) => node['@type'] === 'BreadcrumbList')).toBeTruthy();

    const itemList = graph.find((node) => node['@type'] === 'ItemList') as {
      numberOfItems?: number;
      itemListElement?: { url?: string; position?: number }[];
    };
    expect(itemList?.numberOfItems).toBe(1);
    expect(itemList?.itemListElement?.[0]?.url).toContain('/equipamentos/betoneira');
    expect(itemList?.itemListElement?.[0]?.position).toBe(1);
  });

  it('links CollectionPage to breadcrumb and item list entities', () => {
    const seo = getCategorySeo('ferramentas-eletricas');
    const json = buildCategoryPageJsonLd({
      slug: 'ferramentas-eletricas',
      seo,
      equipment: [equipment],
    });
    const graph = json['@graph'] as Record<string, unknown>[];

    const collectionPage = graph.find((node) => node['@type'] === 'CollectionPage') as {
      breadcrumb?: { '@id'?: string };
      mainEntity?: { '@id'?: string };
      name?: string;
    };
    const breadcrumb = graph.find((node) => node['@type'] === 'BreadcrumbList') as {
      '@id'?: string;
      itemListElement?: { name?: string }[];
    };

    expect(collectionPage?.name).toBe(seo.h1);
    expect(collectionPage?.breadcrumb?.['@id']).toContain('#breadcrumb');
    expect(collectionPage?.mainEntity?.['@id']).toContain('#itemlist');
    expect(breadcrumb?.['@id']).toContain('#breadcrumb');
    expect(breadcrumb?.itemListElement?.map((item) => item.name)).toStrictEqual([
      'Início',
      'Equipamentos',
      'Ferramentas elétricas',
    ]);
  });

  it('includes FAQPage when category SEO defines faqs', () => {
    const seo = getCategorySeo('plataformas-elevatorias');
    const json = buildCategoryPageJsonLd({
      slug: 'plataformas-elevatorias',
      seo,
      equipment: [equipment],
    });
    const graph = json['@graph'] as Record<string, unknown>[];
    const faqPage = graph.find((node) => node['@type'] === 'FAQPage') as {
      mainEntity?: { name?: string }[];
    };

    expect(seo.faqs?.length).toBeGreaterThan(0);
    expect(faqPage?.mainEntity?.length).toBe(seo.faqs?.length);
    expect(faqPage?.mainEntity?.[0]?.name).toContain('aluguel de plataforma elevatória');
  });
});

describe('build equipment catalog json-ld', () => {
  it('lists catalog items in ItemList', () => {
    const json = buildEquipmentCatalogJsonLd([equipment]);
    const graph = json['@graph'] as Record<string, unknown>[];
    const itemList = graph.find((node) => node['@type'] === 'ItemList') as {
      itemListElement?: unknown[];
    };

    expect(itemList?.itemListElement).toHaveLength(1);
  });
});

describe('build faq page json-ld', () => {
  it('maps FAQ items to Question entities', () => {
    const json = buildFaqPageJsonLd(FAQ_ITEMS.slice(0, 2));
    const graph = json['@graph'] as Record<string, unknown>[];
    const faq = graph.find((node) => node['@type'] === 'FAQPage') as {
      mainEntity?: unknown[];
    };

    expect(faq?.mainEntity).toHaveLength(2);
  });
});

describe('build training course json-ld', () => {
  it('includes Course schema with provider', () => {
    const json = buildTrainingCourseJsonLd();
    const graph = json['@graph'] as Record<string, unknown>[];

    expect(graph.some((node) => node['@type'] === 'Course')).toBeTruthy();
  });
});

describe('build dicas json-ld', () => {
  const legacyAsBlog = DICAS_ARTICLES.map((article) => ({
    slug: article.slug,
    title: article.title,
    metaTitle: article.metaTitle,
    metaDescription: article.metaDescription,
    publishedAt: article.publishedAt,
    updatedAt: `${article.publishedAt}T00:00:00.000Z`,
    readingMinutes: article.readingMinutes,
    excerpt: article.excerpt,
    coverImageUrl: null,
    content: sectionsToTiptapDoc(article.sections),
    relatedLinks: article.relatedLinks,
    status: 'published' as const,
  }));

  it('includes BlogPosting for article pages', () => {
    const json = buildDicaArticleJsonLd(legacyAsBlog[0]!);
    const graph = json['@graph'] as Record<string, unknown>[];

    expect(graph.some((node) => node['@type'] === 'BlogPosting')).toBeTruthy();
  });

  it('includes CollectionPage and ItemList for index', () => {
    const json = buildDicasIndexJsonLd(legacyAsBlog);
    const graph = json['@graph'] as Record<string, unknown>[];

    expect(graph.some((node) => node['@type'] === 'CollectionPage')).toBeTruthy();
    expect(graph.some((node) => node['@type'] === 'ItemList')).toBeTruthy();
  });
});
