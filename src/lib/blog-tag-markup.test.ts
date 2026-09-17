import { describe, expect, it } from 'vitest';
import {
  insertTagPairAtSelection,
  parseBlogTagMarkup,
  tiptapDocToBlogTagMarkup,
} from '@/lib/blog-tag-markup';

describe('blog-tag-markup', () => {
  it('inserts opening and closing tag pair around selection', () => {
    const result = insertTagPairAtSelection('Olá mundo', 4, 9, '[negrito]', '[/negrito]');
    expect(result.value).toBe('Olá [negrito]mundo[/negrito]');
    expect(result.selectionStart).toBe(13);
    expect(result.selectionEnd).toBe(18);
  });

  it('parses bold and heading tags into TipTap JSON', () => {
    const doc = parseBlogTagMarkup('[h2]Título[/h2]\n\nTexto [negrito]forte[/negrito].', []);
    expect(doc.content?.[0]?.type).toBe('heading');
    const paragraph = doc.content?.find((node) => node.type === 'paragraph');
    const boldNode = paragraph?.content?.find((node) => node.marks?.some((mark) => mark.type === 'bold'));
    expect(boldNode?.text).toBe('forte');
  });

  it('resolves numbered image tags from the image registry', () => {
    const doc = parseBlogTagMarkup('Antes\n\n[img1]\n\nDepois', [
      { id: 'a', url: 'https://cdn.example/a.jpg', alt: 'Foto A' },
    ]);
    expect(doc.content?.some((node) => node.type === 'image')).toBe(true);
    expect(doc.content?.find((node) => node.type === 'image')?.attrs?.src).toBe(
      'https://cdn.example/a.jpg',
    );
  });

  it('uses image list order for numbered tags without changing markup', () => {
    const images = [
      { id: 'a', url: '/a.jpg', alt: '' },
      { id: 'b', url: '/b.jpg', alt: '' },
    ];
    const markup = 'Intro\n\n[img1]\n\n[img2]';
    const reordered = [images[1]!, images[0]!];
    const doc = parseBlogTagMarkup(markup, reordered);
    expect(doc.content?.find((node) => node.type === 'image')?.attrs?.src).toBe('/b.jpg');
  });

  it('converts TipTap doc back to tag markup', () => {
    const state = tiptapDocToBlogTagMarkup({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Título' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Olá ' },
            { type: 'text', text: 'mundo', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    });
    expect(state.markup).toContain('[h2]Título[/h2]');
    expect(state.markup).toContain('[negrito]mundo[/negrito]');
  });

  it('parses pipe tables into TipTap table nodes', () => {
    const doc = parseBlogTagMarkup(
      '[tabela]\nTipo | Arquitetura\nTesoura | Pressão + ângulo\nLança | Célula + posição\n[/tabela]',
      [],
    );
    const table = doc.content?.find((node) => node.type === 'table');
    expect(table?.content?.length).toBe(3);
    expect(table?.content?.[0]?.content?.[0]?.type).toBe('tableHeader');
    expect(table?.content?.[1]?.content?.[0]?.type).toBe('tableCell');

    const roundTrip = tiptapDocToBlogTagMarkup(doc);
    expect(roundTrip.markup).toContain('[tabela]');
    expect(roundTrip.markup).toContain('Tesoura | Pressão + ângulo');
  });
});
