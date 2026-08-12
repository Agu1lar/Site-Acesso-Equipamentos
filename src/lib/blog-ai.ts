import 'server-only';
import imageManifest from '@/data/equipment-image-manifest.json';
import {
  createAndStoreBlogAiImage,
  isOpenAiImageConfigured,
} from '@/lib/blog-ai-images';
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

function buildClaudeOutputSchema(imageSource: 'generated' | 'catalog') {
  const generatedOnly = imageSource === 'generated';

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
        description: generatedOnly
          ? 'Índice zero-based da capa gerada no array images (sempre 0).'
          : 'Índice zero-based da foto de capa do catálogo no array images.',
      },
      contentMarkup: { type: 'string', description: CLAUDE_BLOG_TAG_CONTRACT },
      images: {
        type: 'array',
        description: generatedOnly
          ? '1 capa gerada (type=generated) + até 2 ilustrações editoriais geradas. Proibido type=equipment ou URLs do site.'
          : '2 a 4 fotos reais do catálogo (type=equipment) com URLs exatas informadas. Proibido type=generated.',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: generatedOnly ? ['generated'] : ['equipment'],
              description: generatedOnly
                ? 'Sempre generated — imagem editorial criada por IA a partir do prompt.'
                : 'Sempre equipment — foto real do catálogo informado.',
            },
            prompt: {
              type: 'string',
              description: generatedOnly
                ? 'Brief visual detalhado em inglês para OpenAI Images (obrigatório).'
                : 'Deixe vazio quando type=equipment.',
            },
            url: {
              type: 'string',
              description: generatedOnly
                ? 'Sempre vazio — a URL será gerada depois.'
                : 'URL exata do catálogo filtrado (obrigatório).',
            },
            alt: { type: 'string', description: 'Descrição objetiva da imagem em português.' },
          },
          required: ['type', 'prompt', 'url', 'alt'],
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

function catalogLinesForPrompt(topic: string, options?: { includeSampleWhenEmpty?: boolean }) {
  const filtered = filterEquipmentCatalogForTopic(topic);
  const list =
    filtered.length > 0
      ? filtered
      : options?.includeSampleWhenEmpty
        ? imageEntries.slice(0, MAX_CATALOG_FOR_PROMPT)
        : [];
  if (list.length === 0) {
    return '(nenhum equipamento claramente relacionado — use images vazio se necessário)';
  }
  return list.map((image) => `${image.slug}: ${image.url}`).join('\n');
}

function blogImageSystemInstructions(imageSource: 'generated' | 'catalog') {
  if (imageSource === 'catalog') {
    return 'Imagens: use somente type=equipment com URLs exatas do catálogo informado (2 a 4 imagens quando pertinente). Use uma delas como capa (coverImageIndex). Se nenhuma imagem for realmente pertinente, use images vazio e coverImageIndex 0. Nunca use type=generated.';
  }
  return 'Imagens: use somente type=generated (capa + até 2 ilustrações editoriais). O prompt deve ser um brief visual detalhado em inglês. Nunca use type=equipment nem URLs do catálogo. coverImageIndex deve apontar para a capa gerada (geralmente 0).';
}

function blogImageUserMessageBlock(topic: string, imageSource: 'generated' | 'catalog') {
  if (imageSource === 'catalog') {
    return `Imagens disponíveis (use exclusivamente deste catálogo):\n${catalogLinesForPrompt(topic, { includeSampleWhenEmpty: true })}`;
  }
  return 'Imagens: serão geradas por IA a partir dos prompts type=generated — não use fotos do catálogo.';
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
  slots: { type: 'generated' | 'equipment'; prompt?: string; url?: string; alt: string }[],
  options?: { allowGenerated?: boolean; allowEquipment?: boolean },
): ClaudeBlogImageSlot[] {
  const allowGenerated = options?.allowGenerated !== false;
  const allowEquipment = options?.allowEquipment !== false;
  const result: ClaudeBlogImageSlot[] = [];
  let generatedCount = 0;
  let equipmentCount = 0;

  for (const slot of slots) {
    if (slot.type === 'generated') {
      if (!allowGenerated || generatedCount >= MAX_GENERATED_IMAGES) {
        continue;
      }
      const prompt = slot.prompt?.trim() ?? '';
      if (prompt.length < 20) {
        continue;
      }
      result.push({ type: 'generated', prompt, alt: slot.alt });
      generatedCount += 1;
      continue;
    }

    if (equipmentCount >= MAX_EQUIPMENT_IMAGES) {
      continue;
    }
    if (!allowEquipment) {
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

function isCatalogImageUrl(url: string) {
  return url.startsWith('/equipamentos/') || allowedImageUrls.has(url);
}

/**
 * Ensures generated mode has AI slots only and a valid cover index.
 * @param parsed Parsed draft after sanitization.
 * @param topic Editorial topic for fallback prompts.
 */
export function ensureGeneratedImageSlots(parsed: ParsedClaudeBlogDraft, topic: string) {
  const generatedOnly = parsed.imageSlots.filter(
    (slot): slot is Extract<ClaudeBlogImageSlot, { type: 'generated' }> => slot.type === 'generated',
  );

  if (generatedOnly.length === 0) {
    generatedOnly.push({
      type: 'generated',
      prompt: `Editorial cover image about ${topic.slice(0, 200)} on a Brazilian construction site`,
      alt: `Ilustração editorial sobre ${parsed.title.slice(0, 80)}`,
    });
  }

  parsed.imageSlots = generatedOnly;
  parsed.coverImageIndex = 0;
}

/**
 * Returns true when every resolved image URL is from the site equipment catalog.
 * @param urls Image URLs to inspect.
 */
export function urlsAreCatalogOnly(urls: string[]) {
  const kept = urls.filter(Boolean);
  return kept.length > 0 && kept.every((url) => isCatalogImageUrl(url));
}

/**
 * Resolves generated + equipment slots into editor image URLs (same order as slots).
 * Failed generations become empty URLs and are dropped when building TipTap content.
 * @param options Sanitized slots and article slug.
 */
export async function materializeBlogImageSlots(options: {
  slots: ClaudeBlogImageSlot[];
  slug: string;
  generatedOnly?: boolean;
}): Promise<BlogEditorImage[]> {
  const resolved: BlogEditorImage[] = [];

  for (const slot of options.slots) {
    if (slot.type === 'equipment') {
      if (options.generatedOnly) {
        continue;
      }
      resolved.push(createBlogEditorImage(slot.url, slot.alt));
      continue;
    }

    if (!isOpenAiImageConfigured()) {
      resolved.push(createBlogEditorImage('', slot.alt));
      continue;
    }

    try {
      const url = await createAndStoreBlogAiImage({
        prompt: slot.prompt,
        slug: options.slug,
      });
      resolved.push(createBlogEditorImage(url, slot.alt));
    } catch (error) {
      if (options.generatedOnly) {
        throw error;
      }
      resolved.push(createBlogEditorImage('', slot.alt));
    }
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
    allowGenerated: options?.allowGeneratedImages !== false,
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
 * Generated slots are dropped in this sync path.
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
 * Default images are AI-generated (OpenAI). Catalog photos only when imageSource is `catalog`.
 * @param topic Editorial direction supplied by the dashboard user.
 * @param options Image source preference from the admin UI.
 * @returns A validated draft ready for review.
 */
export async function generateBlogDraftWithClaude(
  topic: string,
  options: { imageSource?: 'generated' | 'catalog' } = {},
): Promise<GeneratedBlogDraft> {
  if (!Env.ANTHROPIC_API_KEY) {
    throw new Error('anthropic_not_configured');
  }

  const imageSource = options.imageSource ?? 'generated';
  const useGeneratedImages = imageSource === 'generated';

  if (useGeneratedImages && !isOpenAiImageConfigured()) {
    throw new Error('openai_not_configured');
  }

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
    signal: AbortSignal.timeout(90_000),
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
    allowGeneratedImages: useGeneratedImages,
    allowEquipmentImages: imageSource === 'catalog',
  });

  if (useGeneratedImages) {
    ensureGeneratedImageSlots(parsed, topic);
  }

  const images = await materializeBlogImageSlots({
    slots: parsed.imageSlots,
    slug: parsed.slug,
    generatedOnly: useGeneratedImages,
  });

  const resolvedUrls = images.map((image) => image.url).filter(Boolean);

  if (useGeneratedImages && resolvedUrls.length === 0) {
    throw new Error('openai_image_failed');
  }

  if (useGeneratedImages && urlsAreCatalogOnly(resolvedUrls)) {
    throw new Error('openai_image_failed');
  }

  return buildGeneratedBlogDraft(parsed, images);
}
