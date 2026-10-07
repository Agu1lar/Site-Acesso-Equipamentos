#!/usr/bin/env node
/**
 * Upserts the IA / safety blog article into Neon (published).
 * Usage: dotenv -c -- npx tsx scripts/seed-blog-ia-article.mjs
 */
import { Client } from 'pg';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const { BLOG_IA_PREVER_ACIDENTES, BLOG_IA_PREVER_ACIDENTES_READING_MINUTES } = await import(
  '../src/data/blog-ia-prever-acidentes.ts'
);

const article = BLOG_IA_PREVER_ACIDENTES;
const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

await client.connect();

try {
  const result = await client.query(
    `
    INSERT INTO blog_articles (
      slug,
      title,
      excerpt,
      meta_title,
      meta_description,
      cover_image_url,
      content,
      related_links,
      status,
      published_at,
      reading_minutes,
      updated_by,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, 'published', $9, $10, 'seed-ia-article', NOW()
    )
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title,
      excerpt = EXCLUDED.excerpt,
      meta_title = EXCLUDED.meta_title,
      meta_description = EXCLUDED.meta_description,
      cover_image_url = EXCLUDED.cover_image_url,
      content = EXCLUDED.content,
      related_links = EXCLUDED.related_links,
      status = 'published',
      published_at = COALESCE(blog_articles.published_at, EXCLUDED.published_at),
      reading_minutes = EXCLUDED.reading_minutes,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW(),
      deleted_at = NULL
    RETURNING id, slug, reading_minutes, status
    `,
    [
      article.slug,
      article.title,
      article.excerpt,
      article.metaTitle,
      article.metaDescription,
      article.coverImageUrl,
      JSON.stringify(article.content),
      JSON.stringify(article.relatedLinks),
      new Date(article.publishedAt),
      BLOG_IA_PREVER_ACIDENTES_READING_MINUTES,
    ],
  );

  console.log('Upserted blog article:', result.rows[0]);
} finally {
  await client.end();
}
