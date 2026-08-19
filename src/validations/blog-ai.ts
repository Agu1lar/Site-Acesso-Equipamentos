import type { JSONContent } from '@tiptap/core';
import * as z from 'zod';

export const BlogAiRequestSchema = z.object({
  topic: z.string().trim().min(10).max(600),
  /** Default: no images. Use `catalog` only when explicitly requested. */
  imageSource: z.enum(['none', 'catalog']).default('none'),
});

export type BlogAiImageSource = z.infer<typeof BlogAiRequestSchema>['imageSource'];

/** Raw image slot as returned by Claude (empty strings allowed). */
export const ClaudeBlogImageSlotRawSchema = z.object({
  type: z.enum(['generated', 'equipment']),
  prompt: z.string().max(900).default(''),
  url: z.string().max(500).default(''),
  svg: z.string().max(40_000).default(''),
  alt: z.string().trim().max(220).default(''),
});

export type ClaudeBlogImageSlotRaw = z.infer<typeof ClaudeBlogImageSlotRawSchema>;

export type ClaudeBlogImageSlot =
  | { type: 'generated'; svg: string; alt: string }
  | { type: 'equipment'; url: string; alt: string };

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
  /** Zero-based index into `images` for the cover. */
  coverImageIndex: z.number().int().min(0).max(3),
  contentMarkup: z.string().trim().min(200),
  images: z.array(ClaudeBlogImageSlotRawSchema).max(4),
  relatedLinks: z.array(generatedRelatedLinkSchema).max(4),
});

export type GeneratedBlogDraft = {
  title: string;
  slug: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  coverImageUrl: string;
  content: JSONContent;
  relatedLinks: z.infer<typeof generatedRelatedLinkSchema>[];
};
