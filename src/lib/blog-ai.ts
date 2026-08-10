import 'server-only';
import imageManifest from '@/data/equipment-image-manifest.json';
import {
  createBlogEditorImage,
  parseBlogTagMarkup,
  remapImageTagsAfterImageChange,
} from '@/lib/blog-tag-markup';
import { Env } from '@/libs/Env';
import { ClaudeBlogDraftSchema } from '@/validations/blog-ai';
import type { GeneratedBlogDraft } from '@/validations/blog-ai';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

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

const outputSchema = {
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
      description: 'Descrição SEO entre 120 e 155 caracteres.',
    },
    coverImageUrl: {
      type: 'string',
      description: 'URL exata de uma imagem do catálogo informado ou string vazia.',
    },
    contentMarkup: { type: 'string', description: CLAUDE_BLOG_TAG_CONTRACT },
    images: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL exata copiada do catálogo informado.' },
          alt: { type: 'string', description: 'Descrição objetiva da imagem em português.' },
        },
        required: ['url', 'alt'],
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
    'coverImageUrl',
    'contentMarkup',
    'images',
    'relatedLinks',
  ],
  additionalProperties: false,
} as const;

type ClaudeResponse = {
  content?: { type?: string; text?: string }[];
  error?: { message?: string };
  stop_reason?: string;
};

function imageCatalogForPrompt() {
  return imageEntries.map((image) => `${image.slug}: ${image.url}`).join('\n');
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
 * Normalizes and secures a structured Claude draft before returning it to the editor.
 * @param raw Untrusted structured output returned by Claude.
 * @returns A validated draft ready for the blog editor.
 */
export function normalizeClaudeBlogDraft(raw: unknown): GeneratedBlogDraft {
  const parsed = ClaudeBlogDraftSchema.parse(raw);
  const proposedImages = parsed.images.map((image) => createBlogEditorImage(image.url, image.alt));
  const images = proposedImages.filter((image) => allowedImageUrls.has(image.url));
  const coverImageUrl = allowedImageUrls.has(parsed.coverImageUrl)
    ? parsed.coverImageUrl
    : (images[0]?.url ?? '');
  const relatedLinks = parsed.relatedLinks.filter((link) => isAllowedRelatedPath(link.href));
  const content = parseBlogTagMarkup(
    remapImageTagsAfterImageChange(parsed.contentMarkup, proposedImages, images),
    images,
  );

  return {
    title: parsed.title,
    slug: parsed.slug,
    excerpt: parsed.excerpt,
    metaTitle: parsed.metaTitle,
    metaDescription: parsed.metaDescription,
    coverImageUrl,
    content,
    relatedLinks,
  };
}

/**
 * Generates a complete, unpublished blog draft with Claude.
 * @param topic Editorial direction supplied by the dashboard user.
 * @returns A validated draft ready for review.
 */
export async function generateBlogDraftWithClaude(topic: string): Promise<GeneratedBlogDraft> {
  if (!Env.ANTHROPIC_API_KEY) {
    throw new Error('anthropic_not_configured');
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
        'Escolha de 2 a 4 imagens exclusivamente do catálogo fornecido. Use uma delas como coverImageUrl. Se nenhuma imagem for realmente pertinente, use images vazio e coverImageUrl vazio.',
        'Use apenas links internos da lista fornecida. Não transforme referências externas, normas ou fontes não fornecidas em links.',
        CLAUDE_BLOG_TAG_CONTRACT,
      ].join('\n\n'),
      messages: [
        {
          role: 'user',
          content: `Crie um artigo completo sobre: ${topic}\n\nImagens disponíveis:\n${imageCatalogForPrompt()}\n\nLinks internos permitidos: /orcamento, /equipamentos, /contato, /treinamento-plataformas-aereas e /equipamentos/{slug-exato-do-catálogo}.`,
        },
      ],
      output_config: {
        format: {
          type: 'json_schema',
          schema: outputSchema,
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

  return normalizeClaudeBlogDraft(JSON.parse(text) as unknown);
}
