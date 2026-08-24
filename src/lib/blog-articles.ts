import 'server-only';

import { DICAS_ARTICLES } from '@/data/dicas-articles';
import {
  getPublishedBlogArticleBySlug as getPublishedBlogArticleBySlugFromDb,
  listPublishedBlogArticles as listPublishedBlogArticlesFromDb,
  listPublishedBlogSlugs as listPublishedBlogSlugsFromDb,
  listPublishedBlogSitemapEntries,
} from '@/lib/blog-articles-db';
import { sectionsToTiptapDoc } from '@/lib/blog-tiptap';
import { logger } from '@/libs/Logger';
import type { BlogArticle } from '@/types/blog-article';

export {
  listPublishedBlogSitemapEntries,
};

function legacyDicaToBlogArticle(article: (typeof DICAS_ARTICLES)[number]): BlogArticle {
  return {
    slug: article.slug,
    title: article.title,
    metaTitle: article.metaTitle,
    metaDescription: article.metaDescription,
    publishedAt: article.publishedAt,
    updatedAt: new Date(`${article.publishedAt}T12:00:00`).toISOString(),
    readingMinutes: article.readingMinutes,
    excerpt: article.excerpt,
    coverImageUrl: null,
    content: sectionsToTiptapDoc(article.sections),
    relatedLinks: article.relatedLinks,
    status: 'published',
  };
}

function legacyPublishedBlogArticles() {
  return DICAS_ARTICLES.map(legacyDicaToBlogArticle);
}

function logBlogFallback(error: unknown) {
  logger.warn('Public blog database unavailable; using legacy articles', {
    message: error instanceof Error ? error.message : String(error),
  });
}

/**
 * Maps slug to last modified date for sitemap.
 */
export async function getBlogLastModifiedBySlug() {
  const entries = await listPublishedBlogSitemapEntries();
  return new Map(
    entries.map((entry) => [
      entry.slug,
      entry.updatedAt ?? entry.publishedAt ?? new Date(),
    ] as const),
  );
}

/**
 * Returns all published slugs.
 */
export async function getAllBlogSlugs() {
  try {
    return await listPublishedBlogSlugsFromDb();
  } catch (error) {
    logBlogFallback(error);
    return DICAS_ARTICLES.map((article) => article.slug);
  }
}

/**
 * Returns one published article by slug.
 */
export async function getBlogArticleBySlug(slug: string) {
  try {
    return await getPublishedBlogArticleBySlugFromDb(slug);
  } catch (error) {
    logBlogFallback(error);
    return legacyPublishedBlogArticles().find((article) => article.slug === slug) ?? null;
  }
}

/**
 * Lists published articles for the public blog index.
 */
export async function listPublishedBlogArticles() {
  try {
    return await listPublishedBlogArticlesFromDb();
  } catch (error) {
    logBlogFallback(error);
    return legacyPublishedBlogArticles();
  }
}
