'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logAdminActivity } from '@/lib/admin-activity';
import { adminListFiltersSuffix, returnPathFromFormData } from '@/lib/admin-return-path';
import { requireDashboardAccess } from '@/lib/auth-roles';
import {
  getBlogArticleAdminById,
  getBlogArticleAdminBySlug,
  isBlogSlugAvailable,
  publishBlogArticleBySlug,
  saveBlogArticle,
  unpublishBlogArticleBySlug,
} from '@/lib/blog-articles-db';
import {
  BlogAdminFormSchema,
  isBlogArticleSeoReady,
  parseBlogContentJson,
  parseRelatedLinksJson,
} from '@/validations/blog-admin';

function revalidateBlogPaths(slug: string) {
  revalidatePath('/dicas', 'layout');
  revalidatePath(`/dicas/${slug}`, 'page');
  revalidatePath('/sitemap.xml');
  revalidatePath('/dashboard/dicas');
}

function redirectToBlogEdit(slug: string, error: 'validation' | 'slug' | 'seo', formData: FormData) {
  const filters = adminListFiltersSuffix(formData);
  const base = `/dashboard/dicas/${slug}/edit?error=${error}`;
  redirect(filters ? `${base}&${filters.slice(1)}` : base);
}

/**
 * Saves or publishes a blog article from admin form.
 */
export async function saveBlogArticleAction(formData: FormData) {
  const access = await requireDashboardAccess();
  if (!access.ok) {
    redirect('/unauthorized');
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = BlogAdminFormSchema.safeParse(raw);
  if (!parsed.success) {
    const fallbackSlug = String(raw.slug ?? '').trim();
    if (fallbackSlug) {
      redirectToBlogEdit(fallbackSlug, 'validation', formData);
    }
    redirect('/dashboard/dicas?error=validation');
  }

  const articleId = parsed.data.articleId;
  const existing = articleId ? await getBlogArticleAdminById(articleId) : null;
  const available = await isBlogSlugAvailable(parsed.data.slug, articleId);
  if (!available) {
    redirectToBlogEdit(parsed.data.slug, 'slug', formData);
  }

  let status: 'draft' | 'published' = 'draft';
  if (parsed.data.intent === 'publish') {
    status = 'published';
  } else if (parsed.data.intent === 'unpublish') {
    status = 'draft';
  } else if (existing) {
    status = existing.status === 'published' ? 'published' : 'draft';
  }

  if (status === 'published' && !isBlogArticleSeoReady(parsed.data)) {
    redirectToBlogEdit(parsed.data.slug, 'seo', formData);
  }

  const content = parseBlogContentJson(parsed.data.contentJson);
  const relatedLinks = parseRelatedLinksJson(parsed.data.relatedLinksJson);

  const saved = await saveBlogArticle(
    {
      slug: parsed.data.slug,
      title: parsed.data.title,
      excerpt: parsed.data.excerpt,
      metaTitle: parsed.data.metaTitle,
      metaDescription: parsed.data.metaDescription,
      coverImageUrl: parsed.data.coverImageUrl?.trim() || null,
      content,
      relatedLinks,
      status,
    },
    access.userId,
    articleId,
  );

  await logAdminActivity({
    userId: access.userId,
    action: parsed.data.intent === 'publish' ? 'publish_blog_article' : 'save_blog_article',
    entityType: 'blog_article',
    entitySlug: saved.slug,
    details: `status=${saved.status}`,
  });

  revalidateBlogPaths(saved.slug);
  if (existing && existing.slug !== saved.slug) {
    revalidateBlogPaths(existing.slug);
  }
  const filters = adminListFiltersSuffix(formData);
  redirect(`/dashboard/dicas/${saved.slug}/edit${filters}`);
}

/**
 * Unpublishes a blog article (tirar do ar).
 */
export async function unpublishBlogArticleAction(formData: FormData) {
  const access = await requireDashboardAccess();
  if (!access.ok) {
    redirect('/unauthorized');
  }

  const slug = String(formData.get('slug') ?? '').trim();
  if (!slug) {
    redirect('/dashboard/dicas');
  }

  const article = await unpublishBlogArticleBySlug(slug, access.userId);
  if (!article) {
    redirect('/dashboard/dicas');
  }

  await logAdminActivity({
    userId: access.userId,
    action: 'unpublish_blog_article',
    entityType: 'blog_article',
    entitySlug: slug,
  });

  revalidateBlogPaths(slug);
  const filters = adminListFiltersSuffix(formData);
  redirect(returnPathFromFormData(formData, `/dashboard/dicas/${slug}/edit${filters}`));
}

/**
 * Publishes a draft from the list page.
 */
export async function publishBlogArticleAction(formData: FormData) {
  const access = await requireDashboardAccess();
  if (!access.ok) {
    redirect('/unauthorized');
  }

  const slug = String(formData.get('slug') ?? '').trim();
  if (!slug) {
    redirect('/dashboard/dicas');
  }

  const draft = await getBlogArticleAdminBySlug(slug);
  if (!draft) {
    redirect('/dashboard/dicas');
  }

  if (!isBlogArticleSeoReady(draft)) {
    redirect(`/dashboard/dicas/${slug}/edit?error=seo`);
  }

  const article = await publishBlogArticleBySlug(slug, access.userId);
  if (!article) {
    redirect('/dashboard/dicas');
  }

  await logAdminActivity({
    userId: access.userId,
    action: 'publish_blog_article',
    entityType: 'blog_article',
    entitySlug: slug,
  });

  revalidateBlogPaths(slug);
  redirect(returnPathFromFormData(formData, '/dashboard/dicas'));
}
