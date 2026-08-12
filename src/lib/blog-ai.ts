import 'server-only';
import imageManifest from '@/data/equipment-image-manifest.json';
import { storeAdminSvgMarkup } from '@/lib/admin-image-upload';
import { sanitizeClaudeSvg } from '@/lib/blog-ai-svg';
import {
  createBlogEditorImage,
  parseBlogTagMarkup,
  remapImageTagsAfterImageChange,
  type BlogEditorImage,
} from '@/lib/blog-tag-markup';
import { Env } from '@/libs/Env';
import { ClaudeBlogDraftSchema } from '@/validations/blog-ai';
import type { ClaudeBlogImageSlot, GeneratedBlogDraft } from '@/validations/blog-ai';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_GENERATED_IMAGES = 3;
const MAX_EQUIPMENT_IMAGES = 2;
const MAX_CATALOG_FOR_PROMPT = 20;

export const CLAUDE_BLOG_TAG_CONTRACT = `
FORMATO OBRIGATÓRIO DE contentMarkup:
- Escreva parágrafos como texto puro e separe cada bloco com uma linha em branco.
- Título de seção: [h2]Texto[/h2]. Subtítulo: [h3]Texto[/h3]. Sempre feche a tag.
- Destaque inline: [negrito]texto[/negrito] ou [italico]texto[/italico].
- Link inline: [link url="/caminho-permitido"]texto clicável[/link]. A tag de fechamento é obrigatória.
- Lista com marcadores, exatamente assim:
[lista]
- Primeiro item
- Segundo item
[/lista]
- Lista numerada, exatamente assim:
[lista-numerada]
1. Primeiro item
2. Segundo item
[/lista-numerada]
- Bloco destacado: [citacao]Síntese ou orientação sem atribuição inventada[/citacao].
- Imagem: use [img1], [img2], [img3] e [img4] isoladamente em uma linha. Os números devem ser sequenciais, começar em 1, corresponder à ordem do array images e aparecer uma única vez cada.
- Botão final: [botao url="/orcamento"]Solicitar orçamento[/botao].
- Não use Markdown (#, **, crases), HTML, H1, tabelas, tags não listadas ou atributos adicionais.
`.trim();

const imageEntries = Object.entries(imageManifest).map(([slug, url]) => ({ slug, url }));
const allowedImageUrls = new Set(imageEntries.map((image) => image.url));
const allowedRelatedPaths = new Set([
  '/contato',
  '/equipamentos',
  '/orcamento',
  '/treinamento-plataformas-aereas',
]);

function buildClaudeOutputSchema(imageSource: 'none' | 'catalog') {
  const useCatalogImages = imageSource === 'catalog';

  return {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Título claro e específico do artigo.' },
      slug: {
        type: 'string',
        description: 'Slug em minúsculas, sem acentos e separado somente por hífens.',
      },
      excerpt: { type: 'string', description: 'Resumo editorial entre 150 e 300 caracteres.' },
      metaTitle: { type: 'string', description: 'Título SEO entre 45 e 60 caracteres.' },
      metaDescription: {
        type: 'string',
        description: 'Descrição SEO entre 120 a 155 caracteres.',
      },
      coverImageIndex: {
        type: 'integer',
        description: useCatalogImages
          ? 'Índice zero-based da foto de capa do catálogo no array images.'
          : 'Use 0. Sem imagens neste modo — a capa será enviada no painel.',
      },
      contentMarkup: { type: 'string', description: CLAUDE_BLOG_TAG_CONTRACT },
      images: {
        type: 'array',
        description: useCatalogImages
          ? '2 a 4 fotos reais do catálogo (type=equipment) com URLs exatas informadas.'
          : 'Sempre vazio. Não inclua SVG, fotos do site nem prompts de imagem.',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['equipment'],
              description: 'Foto real do catálogo informado.',
            },
            prompt: {
              type: 'string',
              description: 'Deixe vazio.',
            },
            url: {
              type: 'string',
              description: useCatalogImages
                ? 'URL exata do catálogo filtrado (obrigatório).'
                : 'Deixe vazio.',
            },
            svg: {
              type: 'string',
              description: 'Deixe vazio.',
            },
            alt: { type: 'string', description: 'Descrição objetiva da imagem em português.' },
          },
          required: ['type', 'prompt', 'url', 'svg', 'alt'],
          additionalProperties: false,
        },
      },
      relatedLinks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: 'Texto curto e contextual do link.' },
            href: { type: 'string', description: 'Caminho exato da lista de links permitidos.' },
          },
          required: ['label', 'href'],
          additionalProperties: false,
        },
      },
    },
    required: [
      'title',
      'slug',
      'excerpt',
      'metaTitle',
      'metaDescription',
      'coverImageIndex',
      'contentMarkup',
      'images',
      'relatedLinks',
    ],
    additionalProperties: false,
  } as const;
}

type ClaudeResponse = {
  content?: { type?: string; text?: string }[];
  error?: { message?: string };
  stop_reason?: string;
};

/**
 * Scores and returns a short equipment catalog subset relevant to the topic.
 * @param topic Editorial topic from the dashboard.
 * @param limit Maximum catalog lines for the prompt.
 */
export function filterEquipmentCatalogForTopic(topic: string, limit = MAX_CATALOG_FOR_PROMPT) {
  const tokens = topic
    .toLowerCase()
    .normalize('NFD')
    .replaceAll(/\p{M}/gu, '')
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length >= 3);

  if (tokens.length === 0) {
    return imageEntries.slice(0, limit);
  }

  const scored = imageEntries
    .map((image) => {
      const haystack = `${image.slug} ${image.url}`.toLowerCase();
      const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
      return { image, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.image.slug.localeCompare(b.image.slug));

  if (scored.length === 0) {
    return [];
  }

  return scored.slice(0, limit).map((entry) => entry.image);
}

function catalogLinesForPrompt(topic: string) {
  const filtered = filterEquipmentCatalogForTopic(topic);
  const list = filtered.length > 0 ? filtered : imageEntries.slice(0, MAX_CATALOG_FOR_PROMPT);
  return list.map((image) => `${image.slug}: ${image.url}`).join('\n');
}

function blogImageSystemInstructions(imageSource: 'none' | 'catalog') {
  if (imageSource === 'catalog') {
    return 'Imagens: use somente type=equipment com URLs exatas do catálogo informado (2 a 4 imagens quando pertinente). Use uma delas como capa (coverImageIndex). Se nenhuma imagem for realmente pertinente, use images vazio e coverImageIndex 0. Nunca use type=generated.';
  }
  return 'Imagens: deixe o array images vazio e não use tags [img]. A capa será enviada depois no painel. Nunca invente SVG nem use fotos do catálogo.';
}

function blogImageUserMessageBlock(topic: string, imageSource: 'none' | 'catalog') {
  if (imageSource === 'catalog') {
    return `Imagens disponíveis (use exclusivamente deste catálogo):\n${catalogLinesForPrompt(topic)}`;
  }
  return 'Não inclua imagens. O editor enviará a capa depois no painel.';
}

function isAllowedRelatedPath(href: string) {
  if (allowedRelatedPaths.has(href)) {
    return true;
  }
  if (!href.startsWith('/equipamentos/')) {
    return false;
  }
  const slug = href.slice('/equipamentos/'.length);
  return imageEntries.some((image) => image.slug === slug);
}

/**
 * Caps and sanitizes Claude image slots before materialization.
 * @param slots Raw slots from Claude.
 */
export function sanitizeClaudeImageSlots(
  slots: { type: 'generated' | 'equipment'; prompt?: string; url?: string; svg?: string; alt: string }[],
  options?: { allowGenerated?: boolean; allowEquipment?: boolean },
): ClaudeBlogImageSlot[] {
  const allowGenerated = options?.allowGenerated === true;
  const allowEquipment = options?.allowEquipment !== false;
  const result: ClaudeBlogImageSlot[] = [];
  let generatedCount = 0;
  let equipmentCount = 0;

  for (const slot of slots) {
    if (slot.type === 'generated') {
      if (!allowGenerated || generatedCount >= MAX_GENERATED_IMAGES) {
        continue;
      }
      const svg = sanitizeClaudeSvg(slot.svg ?? '');
      if (!svg) {
        continue;
      }
      result.push({ type: 'generated', svg, alt: slot.alt });
      generatedCount += 1;
      continue;
    }

    if (!allowEquipment || equipmentCount >= MAX_EQUIPMENT_IMAGES) {
      continue;
    }
    const url = slot.url?.trim() ?? '';
    if (!allowedImageUrls.has(url)) {
      continue;
    }
    result.push({ type: 'equipment', url, alt: slot.alt });
    equipmentCount += 1;
  }

  return result;
}

/**
 * Resolves generated SVG and equipment slots into editor image URLs.
 * @param options Sanitized slots and article slug.
 */
export async function materializeBlogImageSlots(options: {
  slots: ClaudeBlogImageSlot[];
  slug: string;
}): Promise<BlogEditorImage[]> {
  const resolved: BlogEditorImage[] = [];

  for (const slot of options.slots) {
    if (slot.type === 'equipment') {
      resolved.push(createBlogEditorImage(slot.url, slot.alt));
      continue;
    }

    const url = await storeAdminSvgMarkup(slot.svg, { slug: options.slug });
    resolved.push(createBlogEditorImage(url, slot.alt));
  }

  return resolved;
}

type ParsedClaudeBlogDraft = {
  title: string;
  slug: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  coverImageIndex: number;
  contentMarkup: string;
  imageSlots: ClaudeBlogImageSlot[];
  relatedLinks: GeneratedBlogDraft['relatedLinks'];
};

/**
 * Parses and secures Claude JSON before image materialization.
 * @param raw Untrusted structured output returned by Claude.
 */
export function parseClaudeBlogDraft(
  raw: unknown,
  options?: { allowGeneratedImages?: boolean; allowEquipmentImages?: boolean },
): ParsedClaudeBlogDraft {
  const parsed = ClaudeBlogDraftSchema.parse(raw);
  const imageSlots = sanitizeClaudeImageSlots(parsed.images, {
    allowGenerated: options?.allowGeneratedImages === true,
    allowEquipment: options?.allowEquipmentImages !== false,
  });
  const relatedLinks = parsed.relatedLinks.filter((link) => isAllowedRelatedPath(link.href));

  return {
    title: parsed.title,
    slug: parsed.slug,
    excerpt: parsed.excerpt,
    metaTitle: parsed.metaTitle,
    metaDescription: parsed.metaDescription,
    coverImageIndex: parsed.coverImageIndex,
    contentMarkup: parsed.contentMarkup,
    imageSlots,
    relatedLinks,
  };
}

/**
 * Builds the final editor draft from parsed text + resolved images.
 * @param parsed Parsed Claude draft.
 * @param images Materialized editor images aligned with `parsed.imageSlots`.
 */
export function buildGeneratedBlogDraft(
  parsed: ParsedClaudeBlogDraft,
  images: BlogEditorImage[],
): GeneratedBlogDraft {
  const kept = images.filter((image) => image.url);
  const preferredCover = images[parsed.coverImageIndex];
  const coverImageUrl = preferredCover?.url || kept[0]?.url || '';
  const content = parseBlogTagMarkup(
    remapImageTagsAfterImageChange(parsed.contentMarkup, images, kept),
    kept,
  );

  return {
    title: parsed.title,
    slug: parsed.slug,
    excerpt: parsed.excerpt,
    metaTitle: parsed.metaTitle,
    metaDescription: parsed.metaDescription,
    coverImageUrl,
    content,
    relatedLinks: parsed.relatedLinks,
  };
}

/**
 * Normalizes a Claude draft when image URLs are already final (tests / equipment-only).
 * Generated SVG slots are dropped in this sync path.
 * @param raw Untrusted structured output.
 */
export function normalizeClaudeBlogDraft(raw: unknown): GeneratedBlogDraft {
  const parsed = parseClaudeBlogDraft(raw, {
    allowGeneratedImages: false,
    allowEquipmentImages: true,
  });
  const equipmentSlots = parsed.imageSlots.filter(
    (slot): slot is Extract<ClaudeBlogImageSlot, { type: 'equipment' }> => slot.type === 'equipment',
  );
  const images = equipmentSlots.map((slot) => createBlogEditorImage(slot.url, slot.alt));

  return buildGeneratedBlogDraft(
    {
      ...parsed,
      imageSlots: equipmentSlots,
      coverImageIndex: Math.min(parsed.coverImageIndex, Math.max(images.length - 1, 0)),
    },
    images,
  );
}

/**
 * Generates a complete, unpublished blog draft with Claude.
 * Claude writes text, SEO and links. Catalog photos only when requested; otherwise the editor adds the cover.
 * @param topic Editorial direction supplied by the dashboard user.
 * @param options Image source preference from the admin UI.
 * @returns A validated draft ready for review.
 */
export async function generateBlogDraftWithClaude(
  topic: string,
  options: { imageSource?: 'none' | 'catalog' } = {},
): Promise<GeneratedBlogDraft> {
  if (!Env.ANTHROPIC_API_KEY) {
    throw new Error('anthropic_not_configured');
  }

  const imageSource = options.imageSource ?? 'none';
  const useCatalogImages = imageSource === 'catalog';

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
      'x-api-key': Env.ANTHROPIC_API_KEY,
    },
    body: JSON.stringify({
      model: Env.ANTHROPIC_MODEL,
      max_tokens: 6000,
      system: [
        'Você é editor sênior do blog da Acesso Equipamentos, locadora de equipamentos para construção civil em Minas Gerais.',
        'Produza conteúdo útil, responsável, original e em português do Brasil. Nunca invente normas, estatísticas, preços, especificações técnicas ou fatos atuais.',
        'O artigo deve ter introdução forte, de 5 a 8 seções H2, H3 quando necessário, listas úteis e conclusão com CTA contextual. Escreva entre 900 e 1.400 palavras.',
        'O título deve ser claro e específico. Use slug sem acentos, em minúsculas e separado por hífens. Meta title deve ter 45 a 60 caracteres, meta description de 120 a 155 e excerpt de 150 a 300.',
        'Preencha também slug, excerpt, metaTitle, metaDescription e relatedLinks.',
        blogImageSystemInstructions(imageSource),
        'Use apenas links internos da lista fornecida. Não transforme referências externas, normas ou fontes não fornecidas em links.',
        CLAUDE_BLOG_TAG_CONTRACT,
      ].join('\n\n'),
      messages: [
        {
          role: 'user',
          content: `Crie um artigo completo sobre: ${topic}\n\n${blogImageUserMessageBlock(topic, imageSource)}\n\nLinks internos permitidos: /orcamento, /equipamentos, /contato, /treinamento-plataformas-aereas e /equipamentos/{slug-exato-do-catálogo}.`,
        },
      ],
      output_config: {
        format: {
          type: 'json_schema',
          schema: buildClaudeOutputSchema(imageSource),
        },
      },
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const payload = (await response.json()) as ClaudeResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message || 'anthropic_request_failed');
  }
  if (payload.stop_reason === 'max_tokens') {
    throw new Error('anthropic_incomplete_response');
  }

  const text = payload.content?.find((block) => block.type === 'text')?.text;
  if (!text) {
    throw new Error('anthropic_empty_response');
  }

  const parsed = parseClaudeBlogDraft(JSON.parse(text) as unknown, {
    allowGeneratedImages: false,
    allowEquipmentImages: useCatalogImages,
  });
  const images = await materializeBlogImageSlots({
    slots: parsed.imageSlots,
    slug: parsed.slug,
  });

  return buildGeneratedBlogDraft(parsed, images);
}
