import { describe, expect, it } from 'vitest';
import {
  CLAUDE_BLOG_TAG_CONTRACT,
  filterEquipmentCatalogForTopic,
  normalizeClaudeBlogDraft,
  parseClaudeBlogDraft,
  sanitizeClaudeImageSlots,
} from '@/lib/blog-ai';
import { isBlogVectorImage, sanitizeClaudeSvg } from '@/lib/blog-ai-svg';

const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="#e8eef2"/><rect x="200" y="300" width="400" height="280" fill="#c45c26"/><circle cx="1100" cy="420" r="160" fill="#2f4f63"/></svg>`;

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
  it('keeps allowlisted equipment urls and drops generated slots', () => {
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

    expect(slots).toEqual([
      {
        type: 'equipment',
        url: '/equipamentos/betoneira.webp',
        alt: 'Betoneira pronta para obra',
      },
    ]);
  });

  it('drops equipment slots when catalog images are disabled', () => {
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

    expect(slots).toEqual([]);
  });

  it('caps equipment counts', () => {
    const slots = sanitizeClaudeImageSlots([
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

    expect(slots).toHaveLength(2);
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
  it('keeps generated svg and strips catalog equipment', () => {
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
            svg: '',
            alt: 'Betoneira em uma obra organizada',
          },
          {
            type: 'generated',
            prompt: '',
            url: '',
            svg: sampleSvg,
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
        svg: sampleSvg,
        alt: 'Capa editorial sobre planejamento de obra',
      },
    ]);
  });
});

describe('claude svg illustrations', () => {
  it('keeps a complete svg and rejects script tags', () => {
    expect(sanitizeClaudeSvg(sampleSvg)).toBe(sampleSvg);
    expect(sanitizeClaudeSvg('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')).toBeNull();
  });

  it('detects vector blog image urls', () => {
    expect(isBlogVectorImage('/blog/uploads/capa.svg')).toBe(true);
    expect(isBlogVectorImage('/equipamentos/betoneira.webp')).toBe(false);
  });
});
