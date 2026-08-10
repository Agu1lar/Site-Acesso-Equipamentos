import type { JSONContent } from '@tiptap/core';
import * as z from 'zod';

export const BlogAiRequestSchema = z.object({
  topic: z.string().trim().min(10).max(600),
});

const generatedImageSchema = z.object({
  url: z.string().startsWith('/equipamentos/'),
  alt: z.string().trim().min(5).max(220),
});

const generatedRelatedLinkSchema = z.object({
  label: z.string().trim().min(2).max(120),
  href: z.string().startsWith('/').max(500),
});

export const ClaudeBlogDraftSchema = z.object({
  title: z.string().trim().min(10).max(300),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
    .max(120),
  excerpt: z.string().trim().min(30).max(500),
  metaTitle: z.string().trim().min(10).max(200),
  metaDescription: z.string().trim().min(20).max(320),
  coverImageUrl: z.string(),
  contentMarkup: z.string().trim().min(500),
  images: z.array(generatedImageSchema).max(4),
  relatedLinks: z.array(generatedRelatedLinkSchema).max(4),
});

export type GeneratedBlogDraft = Omit<
  z.infer<typeof ClaudeBlogDraftSchema>,
  'contentMarkup' | 'images'
> & {
  content: JSONContent;
};
