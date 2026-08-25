import type { MetadataRoute } from 'next';
import { getAllBlogSlugs, getBlogLastModifiedBySlug } from '@/lib/blog-articles';
import { ALL_EQUIPMENT_CATEGORIES } from '@/lib/categories-seo';
import { getAllEquipment, getEquipmentSitemapLastModifiedBySlug } from '@/lib/equipment';
import { ALL_REGIAO_SLUGS } from '@/data/regioes';
import type { EquipmentCategory } from '@/types/equipment';
import { getBaseUrl } from '@/utils/Helpers';

/** Blog publish state changes must appear in sitemap without waiting for a rebuild. */
export const revalidate = 0;

/** Stable lastmod for institutional pages (update when content changes). */
const STATIC_ROUTE_LAST_MODIFIED: Record<string, Date> = {
  '': new Date('2026-06-08'),
  '/equipamentos': new Date('2026-06-08'),
  '/treinamento-plataformas-aereas': new Date('2026-05-21'),
  '/sobre': new Date('2026-05-21'),
  '/contato': new Date('2026-05-21'),
  '/orcamento': new Date('2026-05-21'),
  '/faq': new Date('2026-05-21'),
  '/dicas': new Date('2026-05-21'),
  '/privacidade': new Date('2026-05-21'),
  '/regioes': new Date('2026-08-25'),
  '/llms.txt': new Date('2026-06-15'),
  '/catalog.json': new Date('2026-06-15'),
};

function priorityForRoute(route: string) {
  if (route === '') {
    return 1;
  }
  if (route.startsWith('/categorias/') || route.startsWith('/regioes/')) {
    return 0.9;
  }
  if (
    route === '/equipamentos' ||
    route === '/orcamento' ||
    route === '/treinamento-plataformas-aereas' ||
    route === '/regioes'
  ) {
    return 0.85;
  }
  if (route.startsWith('/equipamentos/')) {
    return 0.7;
  }
  return 0.75;
}

function changeFrequencyForRoute(route: string): MetadataRoute.Sitemap[number]['changeFrequency'] {
  if (route === '') {
    return 'weekly';
  }
  if (route.startsWith('/equipamentos/')) {
    return 'monthly';
  }
  return 'weekly';
}

function maxDate(dates: Date[]) {
  if (dates.length === 0) {
    return undefined;
  }
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function categoryLastModified(
  equipmentLastModified: Map<string, Date>,
  slugsInCategory: string[],
) {
  const dates = slugsInCategory
    .map((slug) => equipmentLastModified.get(slug))
    .filter((date): date is Date => date instanceof Date);

  return maxDate(dates) ?? STATIC_ROUTE_LAST_MODIFIED['/equipamentos'];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();

  const staticRoutes = [
    '',
    '/equipamentos',
    '/treinamento-plataformas-aereas',
    '/sobre',
    '/contato',
    '/orcamento',
    '/faq',
    '/dicas',
    '/privacidade',
    '/regioes',
    '/llms.txt',
    '/catalog.json',
  ];

  const [catalog, equipmentLastModified, dicaLastModified, dicaSlugs] = await Promise.all([
    getAllEquipment(),
    getEquipmentSitemapLastModifiedBySlug(),
    getBlogLastModifiedBySlug(),
    getAllBlogSlugs(),
  ]);

  const slugsByCategory = new Map<EquipmentCategory, string[]>();
  for (const category of ALL_EQUIPMENT_CATEGORIES) {
    slugsByCategory.set(category, []);
  }
  for (const item of catalog) {
    slugsByCategory.get(item.category)?.push(item.slug);
  }

  const equipmentCatalogLastModified =
    maxDate(Array.from(equipmentLastModified.values())) ??
    STATIC_ROUTE_LAST_MODIFIED['/equipamentos'];

  const dicasIndexLastModified =
    maxDate(Array.from(dicaLastModified.values())) ?? STATIC_ROUTE_LAST_MODIFIED['/dicas'];

  const categoryRoutes = ALL_EQUIPMENT_CATEGORIES.map((slug) => `/categorias/${slug}`);
  const regiaoRoutes = ALL_REGIAO_SLUGS.map((slug) => `/regioes/${slug}`);
  const equipmentRoutes = catalog.map((item) => `/equipamentos/${item.slug}`);
  const dicaRoutes = dicaSlugs.map((slug) => `/dicas/${slug}`);
  const allRoutes = [
    ...staticRoutes,
    ...categoryRoutes,
    ...regiaoRoutes,
    ...equipmentRoutes,
    ...dicaRoutes,
  ];

  return allRoutes.map((route) => {
    let lastModified = STATIC_ROUTE_LAST_MODIFIED[route];

    if (route === '/equipamentos') {
      lastModified = equipmentCatalogLastModified;
    } else if (route === '/dicas') {
      lastModified = dicasIndexLastModified;
    } else if (route.startsWith('/equipamentos/')) {
      const slug = route.slice('/equipamentos/'.length);
      lastModified = equipmentLastModified.get(slug) ?? STATIC_ROUTE_LAST_MODIFIED['/equipamentos'];
    } else if (route.startsWith('/dicas/')) {
      const slug = route.slice('/dicas/'.length);
      lastModified = dicaLastModified.get(slug) ?? STATIC_ROUTE_LAST_MODIFIED['/dicas'];
    } else if (route.startsWith('/categorias/')) {
      const category = route.slice('/categorias/'.length) as EquipmentCategory;
      lastModified = categoryLastModified(
        equipmentLastModified,
        slugsByCategory.get(category) ?? [],
      );
    } else if (route.startsWith('/regioes')) {
      lastModified = STATIC_ROUTE_LAST_MODIFIED['/regioes'];
    }

    return {
      url: `${baseUrl}${route}`,
      lastModified,
      changeFrequency: changeFrequencyForRoute(route),
      priority: priorityForRoute(route),
    };
  });
}
