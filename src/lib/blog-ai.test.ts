import { describe, expect, it } from 'vitest';
import {
  CLAUDE_BLOG_TAG_CONTRACT,
  ensureGeneratedImageSlots,
  filterEquipmentCatalogForTopic,
  materializeBlogImageSlots,
  normalizeClaudeBlogDraft,
  parseClaudeBlogDraft,
  sanitizeClaudeImageSlots,
  urlsAreCatalogOnly,
} from '@/lib/blog-ai';
import { buildBlogImagePrompt, generateBlogImageBuffer, isOpenAiImageConfigured, mapOpenAiImageError } from '@/lib/blog-ai-images';

const hasOpenAi = isOpenAiImageConfigured();

async function probeOpenAiImageApi() {
  if (!hasOpenAi) {
    return 'missing' as const;
  }

  try {
    await generateBlogImageBuffer('Solid red circle minimal editorial test image on white background');
    return 'ready' as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'openai_image_failed';
    if (message === 'openai_no_credits') {
      return 'no_credits' as const;
    }
    return 'error' as const;
  }
}

const openAiProbe = await probeOpenAiImageApi();

const longMarkup = `[h2]Como planejar a obra[/h2]\n\n${'Planejamento seguro e eficiente. '.repeat(25)}`;

describe('normalize Claude blog draft', () => {
  it('documents every parser-sensitive tag shape for Claude', () => {
    expect(CLAUDE_BLOG_TAG_CONTRACT).toContain(
      '[link url="/caminho-permitido"]texto clicável[/link]',
    );
    expect(CLAUDE_BLOG_TAG_CONTRACT).toContain('[lista-numerada]');
    expect(CLAUDE_BLOG_TAG_CONTRACT).toContain('[img1], [img2], [img3] e [img4]');
    expect(CLAUDE_BLOG_TAG_CONTRACT).toContain(
      '[botao url="/orcamento"]Solicitar orçamento[/botao]',
    );
  });

  it('converts the documented block contract into editor nodes', () => {
    const contentMarkup = [
      '[h2]Título da seção[/h2]',
      'Parágrafo com [negrito]destaque[/negrito] e [link url="/orcamento"]link[/link].',
      '[lista]\n- Primeiro item\n- Segundo item\n[/lista]',
      '[lista-numerada]\n1. Primeiro passo\n2. Segundo passo\n[/lista-numerada]',
      '[citacao]Orientação em destaque[/citacao]',
      '[img1]',
      '[botao url="/orcamento"]Solicitar orçamento[/botao]',
      'Conteúdo complementar. '.repeat(30),
    ].join('\n\n');
    const draft = normalizeClaudeBlogDraft({
      title: 'Como planejar equipamentos para uma obra produtiva',
      slug: 'como-planejar-equipamentos-obra',
      excerpt: 'Guia completo para organizar equipamentos e melhorar a produtividade da obra.',
      metaTitle: 'Planejamento de equipamentos para obra | Acesso',
      metaDescription:
        'Veja como organizar a escolha e a locação de equipamentos para executar cada etapa da obra com segurança e produtividade.',
      coverImageIndex: 0,
      contentMarkup,
      images: [
        {
          type: 'equipment',
          prompt: '',
          url: '/equipamentos/betoneira.webp',
          alt: 'Betoneira preparada para uso na obra',
        },
      ],
      relatedLinks: [{ label: 'Solicitar orçamento', href: '/orcamento' }],
    });
    const nodeTypes = draft.content.content?.map((node) => node.type);

    expect(nodeTypes).toEqual(
      expect.arrayContaining([
        'heading',
        'paragraph',
        'bulletList',
        'orderedList',
        'blockquote',
        'image',
        'ctaButton',
      ]),
    );
  });

  it('keeps catalog equipment images and valid internal links', () => {
    const draft = normalizeClaudeBlogDraft({
      title: 'Como escolher equipamentos para uma obra eficiente',
      slug: 'como-escolher-equipamentos-obra',
      excerpt: 'Um guia prático para planejar a locação de equipamentos na construção civil.',
      metaTitle: 'Equipamentos para obra: como escolher | Acesso',
      metaDescription:
        'Entenda como escolher equipamentos para cada etapa da obra com segurança e produtividade.',
      coverImageIndex: 0,
      contentMarkup: `${longMarkup}\n\n[img1]`,
      images: [
        {
          type: 'equipment',
          prompt: '',
          url: '/equipamentos/betoneira.webp',
          alt: 'Betoneira em uma obra organizada',
        },
      ],
      relatedLinks: [{ label: 'Solicitar orçamento', href: '/orcamento' }],
    });

    expect(draft.coverImageUrl).toBe('/equipamentos/betoneira.webp');
    expect(draft.relatedLinks).toEqual([{ label: 'Solicitar orçamento', href: '/orcamento' }]);
    expect(draft.content.content?.some((node) => node.type === 'image')).toBe(true);
  });

  it('removes image and link paths outside the catalog', () => {
    const draft = normalizeClaudeBlogDraft({
      title: 'Como escolher equipamentos para uma obra eficiente',
      slug: 'como-escolher-equipamentos-obra',
      excerpt: 'Um guia prático para planejar a locação de equipamentos na construção civil.',
      metaTitle: 'Equipamentos para obra: como escolher | Acesso',
      metaDescription:
        'Entenda como escolher equipamentos para cada etapa da obra com segurança e produtividade.',
      coverImageIndex: 0,
      contentMarkup: longMarkup,
      images: [
        {
          type: 'equipment',
          prompt: '',
          url: '/equipamentos/inexistente.webp',
          alt: 'Imagem que não existe no catálogo',
        },
      ],
      relatedLinks: [{ label: 'Página inventada', href: '/pagina-inventada' }],
    });

    expect(draft.coverImageUrl).toBe('');
    expect(draft.relatedLinks).toEqual([]);
  });

  it('drops generated slots in the sync normalize path', () => {
    const draft = normalizeClaudeBlogDraft({
      title: 'Segurança em altura na construção civil mineira',
      slug: 'seguranca-em-altura-construcao',
      excerpt: 'Orientações práticas para reduzir riscos em trabalhos em altura na construção civil.',
      metaTitle: 'Segurança em altura na construção | Acesso',
      metaDescription:
        'Saiba como organizar trabalhos em altura com planejamento, EPI e equipamentos adequados.',
      coverImageIndex: 0,
      contentMarkup: longMarkup,
      images: [
        {
          type: 'generated',
          prompt: 'Workers using a scissor lift on a Brazilian construction site at golden hour',
          url: '',
          alt: 'Plataforma em uso em obra',
        },
      ],
      relatedLinks: [],
    });

    expect(draft.coverImageUrl).toBe('');
  });
});

describe('sanitize Claude image slots', () => {
  it('keeps generated prompts and allowlisted equipment urls', () => {
    const slots = sanitizeClaudeImageSlots([
      {
        type: 'generated',
        prompt: 'Aerial lift beside an industrial facade in Brazil under clear daylight',
        alt: 'Plataforma ao lado de fachada industrial',
      },
      {
        type: 'equipment',
        url: '/equipamentos/betoneira.webp',
        alt: 'Betoneira pronta para obra',
      },
      {
        type: 'equipment',
        url: '/equipamentos/nao-existe.webp',
        alt: 'URL inválida',
      },
    ]);

    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({ type: 'generated' });
    expect(slots[1]).toMatchObject({
      type: 'equipment',
      url: '/equipamentos/betoneira.webp',
    });
  });

  it('drops generated slots when OpenAI images are disabled', () => {
    const slots = sanitizeClaudeImageSlots(
      [
        {
          type: 'generated',
          prompt: 'Editorial cover for construction safety training in Brazil',
          alt: 'Capa editorial',
        },
        {
          type: 'equipment',
          url: '/equipamentos/betoneira.webp',
          alt: 'Betoneira',
        },
      ],
      { allowGenerated: false },
    );

    expect(slots).toEqual([
      {
        type: 'equipment',
        url: '/equipamentos/betoneira.webp',
        alt: 'Betoneira',
      },
    ]);
  });

  it('drops equipment slots when only generated images are allowed', () => {
    const slots = sanitizeClaudeImageSlots(
      [
        {
          type: 'generated',
          prompt: 'Editorial cover for construction safety training in Brazil',
          alt: 'Capa editorial',
        },
        {
          type: 'equipment',
          url: '/equipamentos/betoneira.webp',
          alt: 'Betoneira',
        },
      ],
      { allowEquipment: false },
    );

    expect(slots).toEqual([
      {
        type: 'generated',
        prompt: 'Editorial cover for construction safety training in Brazil',
        alt: 'Capa editorial',
      },
    ]);
  });

  it('caps generated and equipment counts', () => {
    const slots = sanitizeClaudeImageSlots([
      {
        type: 'generated',
        prompt: 'Cover one for construction safety editorial photography Brazil',
        alt: 'Capa um',
      },
      {
        type: 'generated',
        prompt: 'Inline two showing scaffolding and helmets on a job site',
        alt: 'Inline dois',
      },
      {
        type: 'generated',
        prompt: 'Inline three with concrete mixer in organized Brazilian yard',
        alt: 'Inline três',
      },
      {
        type: 'generated',
        prompt: 'Extra generated image that should be dropped by the cap',
        alt: 'Extra',
      },
      {
        type: 'equipment',
        url: '/equipamentos/betoneira.webp',
        alt: 'Betoneira',
      },
      {
        type: 'equipment',
        url: '/equipamentos/cacamba.webp',
        alt: 'Caçamba',
      },
      {
        type: 'equipment',
        url: '/equipamentos/coifa.webp',
        alt: 'Coifa',
      },
    ]);

    expect(slots.filter((slot) => slot.type === 'generated')).toHaveLength(3);
    expect(slots.filter((slot) => slot.type === 'equipment')).toHaveLength(2);
  });
});

describe('filter equipment catalog for topic', () => {
  it('returns matching equipment for a product topic', () => {
    const matches = filterEquipmentCatalogForTopic('guia da betoneira para obra');
    expect(matches.some((image) => image.slug.includes('betoneira'))).toBe(true);
    expect(matches.length).toBeLessThanOrEqual(20);
  });

  it('returns empty when nothing matches a generic topic', () => {
    expect(filterEquipmentCatalogForTopic('lgpd cookies analytics dashboard xyzzy')).toEqual([]);
  });
});

describe('parse Claude blog draft image modes', () => {
  it('strips catalog equipment when generated mode is enforced', () => {
    const parsed = parseClaudeBlogDraft(
      {
        title: 'Como escolher equipamentos para uma obra eficiente',
        slug: 'como-escolher-equipamentos-obra',
        excerpt: 'Um guia prático para planejar a locação de equipamentos na construção civil.',
        metaTitle: 'Equipamentos para obra: como escolher | Acesso',
        metaDescription:
          'Entenda como escolher equipamentos para cada etapa da obra com segurança e produtividade.',
        coverImageIndex: 0,
        contentMarkup: longMarkup,
        images: [
          {
            type: 'equipment',
            prompt: '',
            url: '/equipamentos/betoneira.webp',
            alt: 'Betoneira em uma obra organizada',
          },
          {
            type: 'generated',
            prompt: 'Editorial cover showing organized construction yard in Brazil at sunrise',
            url: '',
            alt: 'Capa editorial sobre planejamento de obra',
          },
        ],
        relatedLinks: [],
      },
      { allowGeneratedImages: true, allowEquipmentImages: false },
    );

    expect(parsed.imageSlots).toEqual([
      {
        type: 'generated',
        prompt: 'Editorial cover showing organized construction yard in Brazil at sunrise',
        alt: 'Capa editorial sobre planejamento de obra',
      },
    ]);
  });

  it('adds a generated cover when Claude returns only catalog slots', () => {
    const parsed = parseClaudeBlogDraft(
      {
        title: 'Segurança em altura na construção civil mineira',
        slug: 'seguranca-em-altura-construcao',
        excerpt: 'Orientações práticas para reduzir riscos em trabalhos em altura na construção civil.',
        metaTitle: 'Segurança em altura na construção | Acesso',
        metaDescription:
          'Saiba como organizar trabalhos em altura com planejamento, EPI e equipamentos adequados.',
        coverImageIndex: 0,
        contentMarkup: longMarkup,
        images: [
          {
            type: 'equipment',
            prompt: '',
            url: '/equipamentos/betoneira.webp',
            alt: 'Betoneira em obra',
          },
        ],
        relatedLinks: [],
      },
      { allowGeneratedImages: true, allowEquipmentImages: false },
    );

    ensureGeneratedImageSlots(parsed, 'segurança em altura na construção civil');

    expect(parsed.imageSlots).toHaveLength(1);
    expect(parsed.imageSlots[0]?.type).toBe('generated');
    expect(parsed.coverImageIndex).toBe(0);
  });
});

describe('catalog url guard', () => {
  it('detects catalog-only image sets', () => {
    expect(urlsAreCatalogOnly(['/equipamentos/betoneira.webp'])).toBe(true);
    expect(urlsAreCatalogOnly(['/uploads/blog/ai-cover.webp'])).toBe(false);
    expect(urlsAreCatalogOnly([])).toBe(false);
  });
});

describe.skipIf(openAiProbe !== 'ready')('OpenAI image generation (live)', () => {
  it('generates an image buffer from the API', async () => {
    const result = await generateBlogImageBuffer(
      'Scissor lift beside a warehouse facade in Brazil under clear daylight',
    );

    expect(result.buffer.byteLength).toBeGreaterThan(1000);
    expect(['image/png', 'image/jpeg', 'image/webp']).toContain(result.mime);
  }, 120_000);

  it('materializes generated slots without catalog URLs', async () => {
    const images = await materializeBlogImageSlots({
      slots: [
        {
          type: 'generated',
          prompt: 'Construction workers reviewing safety checklist on a Brazilian job site',
          alt: 'Equipe revisando checklist de segurança',
        },
      ],
      slug: 'teste-imagem-gerada',
      generatedOnly: true,
    });

    const urls = images.map((image) => image.url).filter(Boolean);
    expect(urls).toHaveLength(1);
    expect(urlsAreCatalogOnly(urls)).toBe(false);
    expect(urls[0]).not.toMatch(/^\/equipamentos\//);
  }, 120_000);
});

if (openAiProbe === 'no_credits') {
  console.warn(
    'OpenAI: conta sem créditos — testes live de imagem foram ignorados. Adicione saldo em platform.openai.com.',
  );
}

describe('build blog image prompt', () => {
  it('maps OpenAI billing errors to a stable code', () => {
    const response = new Response(null, { status: 429 });
    expect(
      mapOpenAiImageError(response, {
        error: { message: 'You have no credits remaining. Add credits to continue using the API.' },
      }),
    ).toBe('openai_no_credits');
  });

  it('appends brand-safe style constraints', () => {
    const prompt = buildBlogImagePrompt('Scissor lift at a warehouse');
    expect(prompt).toContain('Scissor lift at a warehouse');
    expect(prompt).toContain('no text');
    expect(prompt).toContain('Brazilian construction-equipment');
  });
});
