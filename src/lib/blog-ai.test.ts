import { describe, expect, it } from 'vitest';
import { CLAUDE_BLOG_TAG_CONTRACT, normalizeClaudeBlogDraft } from '@/lib/blog-ai';

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
      coverImageUrl: '/equipamentos/betoneira.webp',
      contentMarkup,
      images: [
        { url: '/equipamentos/betoneira.webp', alt: 'Betoneira preparada para uso na obra' },
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

  it('keeps catalog images and valid internal links', () => {
    const draft = normalizeClaudeBlogDraft({
      title: 'Como escolher equipamentos para uma obra eficiente',
      slug: 'como-escolher-equipamentos-obra',
      excerpt: 'Um guia prático para planejar a locação de equipamentos na construção civil.',
      metaTitle: 'Equipamentos para obra: como escolher | Acesso',
      metaDescription:
        'Entenda como escolher equipamentos para cada etapa da obra com segurança e produtividade.',
      coverImageUrl: '/equipamentos/betoneira.webp',
      contentMarkup: `${longMarkup}\n\n[img1]`,
      images: [{ url: '/equipamentos/betoneira.webp', alt: 'Betoneira em uma obra organizada' }],
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
      coverImageUrl: 'https://example.com/image.jpg',
      contentMarkup: longMarkup,
      images: [{ url: '/equipamentos/inexistente.webp', alt: 'Imagem que não existe no catálogo' }],
      relatedLinks: [{ label: 'Página inventada', href: '/pagina-inventada' }],
    });

    expect(draft.coverImageUrl).toBe('');
    expect(draft.relatedLinks).toEqual([]);
  });
});
