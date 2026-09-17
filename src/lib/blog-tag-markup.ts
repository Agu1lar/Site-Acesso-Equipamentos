import type { JSONContent } from '@tiptap/core';
import { blogLinkAttributes, type BlogLinkKind } from '@/lib/blog-tiptap-extensions';
import { parseVideoEmbedUrl } from '@/lib/blog-tiptap-video';

export type BlogEditorImage = {
  id: string;
  url: string;
  alt: string;
};

export type BlogTagEditorState = {
  markup: string;
  images: BlogEditorImage[];
};

function newImageId() {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createBlogEditorImage(url: string, alt = ''): BlogEditorImage {
  return { id: newImageId(), url, alt };
}

function escapeAttr(value: string) {
  return value.replace(/"/g, '&quot;');
}

function unescapeAttr(value: string) {
  return value.replace(/&quot;/g, '"');
}

function applyMarkToText(text: string, mark: { type: string; attrs?: Record<string, unknown> }): string {
  if (mark.type === 'bold') {
    return `[negrito]${text}[/negrito]`;
  }
  if (mark.type === 'italic') {
    return `[italico]${text}[/italico]`;
  }
  if (mark.type === 'link') {
    const href = String(mark.attrs?.href ?? '');
    const extras: string[] = [];
    if (mark.attrs?.download) {
      extras.push('download');
    }
    if (mark.attrs?.target === '_blank') {
      extras.push('nova-aba');
    }
    const attrSuffix = extras.length ? ` ${extras.join(' ')}` : '';
    return `[link url="${escapeAttr(href)}"${attrSuffix}]${text}[/link]`;
  }
  return text;
}

function inlineNodesToMarkup(nodes: JSONContent[] | undefined): string {
  if (!nodes?.length) {
    return '';
  }

  let result = '';
  for (const node of nodes) {
    if (node.type === 'hardBreak') {
      result += '\n';
      continue;
    }
    if (node.type !== 'text' || !node.text) {
      continue;
    }
    let chunk = node.text;
    const marks = (node.marks ?? []).toReversed();
    for (const mark of marks) {
      chunk = applyMarkToText(chunk, mark);
    }
    result += chunk;
  }
  return result;
}

function tiptapBlockToMarkup(node: JSONContent, images: BlogEditorImage[]): string | null {
  switch (node.type) {
    case 'heading': {
      const level = node.attrs?.level === 3 ? 'h3' : 'h2';
      return `[${level}]${inlineNodesToMarkup(node.content)}[/${level}]`;
    }
    case 'paragraph': {
      const text = inlineNodesToMarkup(node.content);
      return text || null;
    }
    case 'bulletList': {
      const items = (node.content ?? [])
        .flatMap((item) => item.content ?? [])
        .map((paragraph) => `- ${inlineNodesToMarkup(paragraph.content)}`);
      return `[lista]\n${items.join('\n')}\n[/lista]`;
    }
    case 'orderedList': {
      const items = (node.content ?? [])
        .flatMap((item) => item.content ?? [])
        .map((paragraph, index) => `${index + 1}. ${inlineNodesToMarkup(paragraph.content)}`);
      return `[lista-numerada]\n${items.join('\n')}\n[/lista-numerada]`;
    }
    case 'blockquote': {
      return `[citacao]${inlineNodesToMarkup(node.content?.[0]?.content)}[/citacao]`;
    }
    case 'image': {
      images.push({
        id: newImageId(),
        url: String(node.attrs?.src ?? ''),
        alt: String(node.attrs?.alt ?? ''),
      });
      return `[img${images.length}]`;
    }
    case 'videoEmbed': {
      const embedSrc = String(node.attrs?.embedSrc ?? '');
      return `[video url="${escapeAttr(embedSrc)}"]`;
    }
    case 'ctaButton': {
      const href = String(node.attrs?.href ?? '/orcamento');
      const label = String(node.attrs?.label ?? 'Solicitar orçamento');
      const extras: string[] = [];
      if (node.attrs?.download) {
        extras.push('download');
      }
      if (node.attrs?.target === '_blank') {
        extras.push('nova-aba');
      }
      const attrs = extras.length ? ` url="${escapeAttr(href)}" ${extras.join(' ')}` : ` url="${escapeAttr(href)}"`;
      return `[botao${attrs}]${label}[/botao]`;
    }
    case 'table': {
      const rows = (node.content ?? [])
        .filter((row) => row.type === 'tableRow')
        .map((row) => {
          const cells = (row.content ?? [])
            .filter((cell) => cell.type === 'tableHeader' || cell.type === 'tableCell')
            .map((cell) => {
              const paragraph = cell.content?.find((child) => child.type === 'paragraph');
              return inlineNodesToMarkup(paragraph?.content).replace(/\|/g, '\\|');
            });
          return cells.join(' | ');
        });
      return `[tabela]\n${rows.join('\n')}\n[/tabela]`;
    }
    default: {
      return null;
    }
  }
}

/** Converts TipTap JSON (stored in DB) into tag markup + ordered images. */
export function tiptapDocToBlogTagMarkup(doc: JSONContent): BlogTagEditorState {
  const images: BlogEditorImage[] = [];
  const blocks: string[] = [];

  for (const node of doc.content ?? []) {
    const block = tiptapBlockToMarkup(node, images);
    if (block) {
      blocks.push(block);
    }
  }

  return {
    markup: blocks.join('\n\n'),
    images,
  };
}

type ParsedLinkAttrs = {
  href: string;
  kind: BlogLinkKind;
};

function parseLinkOpening(attrsRaw: string): ParsedLinkAttrs | null {
  const hrefMatch = attrsRaw.match(/url="([^"]*)"/i);
  if (!hrefMatch?.[1]) {
    return null;
  }
  const href = unescapeAttr(hrefMatch[1]);
  let kind: BlogLinkKind = 'redirect';
  if (/\bdownload\b/i.test(attrsRaw)) {
    kind = 'download';
  } else if (/\bnova-aba\b/i.test(attrsRaw)) {
    kind = 'new_tab';
  }
  return { href, kind };
}

function mergeAdjacentTextNodes(nodes: JSONContent[]): JSONContent[] {
  const merged: JSONContent[] = [];
  for (const node of nodes) {
    if (node.type !== 'text') {
      merged.push(node);
      continue;
    }
    const prev = merged.at(-1);
    if (prev?.type === 'text' && JSON.stringify(prev.marks ?? []) === JSON.stringify(node.marks ?? [])) {
      prev.text = `${prev.text ?? ''}${node.text ?? ''}`;
      continue;
    }
    merged.push({ ...node });
  }
  return merged;
}

function parseInlineMarkup(input: string): JSONContent[] {
  const nodes: JSONContent[] = [];
  let index = 0;

  const pushText = (text: string) => {
    if (!text) {
      return;
    }
    nodes.push({ type: 'text', text });
  };

  while (index < input.length) {
    const slice = input.slice(index);
    const openMatch = slice.match(/^\[(negrito|italico|link)([^\]]*)\]/i);
    if (openMatch) {
      const tag = openMatch[1]!.toLowerCase();
      const closeTag = tag === 'link' ? '[/link]' : `[/${tag}]`;
      const openLen = openMatch[0].length;
      const closeIndex = input.toLowerCase().indexOf(closeTag.toLowerCase(), index + openLen);
      if (closeIndex === -1) {
        pushText(slice);
        break;
      }
      const inner = input.slice(index + openLen, closeIndex);
      const innerNodes = parseInlineMarkup(inner);
      if (tag === 'negrito') {
        nodes.push(...innerNodes.map((node) => ({ ...node, marks: [...(node.marks ?? []), { type: 'bold' }] })));
      } else if (tag === 'italico') {
        nodes.push(...innerNodes.map((node) => ({ ...node, marks: [...(node.marks ?? []), { type: 'italic' }] })));
      } else if (tag === 'link') {
        const parsed = parseLinkOpening(openMatch[2] ?? '');
        if (parsed) {
          const linkAttrs = blogLinkAttributes({ href: parsed.href, kind: parsed.kind });
          if (linkAttrs) {
            nodes.push(
              ...innerNodes.map((node) => ({
                ...node,
                marks: [...(node.marks ?? []), { type: 'link', attrs: linkAttrs }],
              })),
            );
          } else {
            pushText(openMatch[0] + inner + closeTag);
          }
        } else {
          pushText(openMatch[0] + inner + closeTag);
        }
      }
      index = closeIndex + closeTag.length;
      continue;
    }

    const nextBracket = input.indexOf('[', index);
    if (nextBracket === -1) {
      pushText(input.slice(index));
      break;
    }
    if (nextBracket > index) {
      pushText(input.slice(index, nextBracket));
    }
    if (nextBracket === index && !/^\[(negrito|italico|link)([^\]]*)\]/i.test(slice)) {
      pushText('[');
      index += 1;
      continue;
    }
    index = nextBracket;
  }

  return mergeAdjacentTextNodes(nodes);
}

function paragraphNode(content: JSONContent[]): JSONContent {
  return { type: 'paragraph', content: content.length ? content : undefined };
}

function parseListItems(body: string, ordered: boolean): JSONContent[] {
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => {
    const text = ordered ? line.replace(/^\d+\.\s*/, '') : line.replace(/^-\s*/, '');
    return {
      type: 'listItem',
      content: [paragraphNode(parseInlineMarkup(text))],
    };
  });
}

/** Splits a table row on unescaped pipe separators. */
function splitTableCells(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (char === '\\' && line[index + 1] === '|') {
      current += '|';
      index += 1;
      continue;
    }
    if (char === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseTableBlock(body: string): JSONContent | null {
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^[-|:\s]+$/.test(line));

  if (!lines.length) {
    return null;
  }

  const rows = lines.map((line, rowIndex) => {
    const cells = splitTableCells(line);
    const cellType = rowIndex === 0 ? 'tableHeader' : 'tableCell';
    return {
      type: 'tableRow',
      content: cells.map((cell) => ({
        type: cellType,
        content: [paragraphNode(parseInlineMarkup(cell))],
      })),
    };
  });

  return { type: 'table', content: rows };
}

function parseWrappedBlock(
  markup: string,
  tag: string,
  handler: (inner: string) => JSONContent | null,
): { node: JSONContent | null; consumed: number } {
  const open = `[${tag}]`;
  const close = `[/${tag}]`;
  if (!markup.toLowerCase().startsWith(open.toLowerCase())) {
    return { node: null, consumed: 0 };
  }
  const closeIndex = markup.toLowerCase().indexOf(close.toLowerCase(), open.length);
  if (closeIndex === -1) {
    return { node: null, consumed: 0 };
  }
  const inner = markup.slice(open.length, closeIndex);
  const consumed = closeIndex + close.length;
  return { node: handler(inner), consumed };
}

function findParagraphEnd(markup: string): number {
  const nextBlock = markup.search(/\n\s*\[(h2|h3|citacao|lista|tabela|img\d+|video|botao)/i);
  if (nextBlock === -1) {
    return markup.length;
  }
  if (nextBlock === 0) {
    return 0;
  }
  return nextBlock;
}

/** Parses tag markup + image registry into TipTap JSON for storage and preview. */
export function parseBlogTagMarkup(markup: string, images: BlogEditorImage[]): JSONContent {
  const content: JSONContent[] = [];
  let rest = markup.trim();

  while (rest.length > 0) {
    rest = rest.trimStart();

    const imgMatch = rest.match(/^\[img(\d+)\]/i);
    if (imgMatch) {
      const imageNumber = Number(imgMatch[1]);
      const image = images[imageNumber - 1];
      if (image?.url) {
        content.push({
          type: 'image',
          attrs: { src: image.url, alt: image.alt || null },
        });
      }
      rest = rest.slice(imgMatch[0].length).trimStart();
      continue;
    }

    const videoMatch = rest.match(/^\[video\s+url="([^"]*)"\s*\]/i);
    if (videoMatch) {
      const url = unescapeAttr(videoMatch[1] ?? '');
      const parsed = parseVideoEmbedUrl(url);
      if (parsed) {
        content.push({
          type: 'videoEmbed',
          attrs: { embedSrc: parsed.embedSrc, provider: parsed.provider },
        });
      }
      rest = rest.slice(videoMatch[0].length).trimStart();
      continue;
    }

    const botaoMatch = rest.match(/^\[botao\s+([^\]]+)\]([\s\S]*?)\[\/botao\]/i);
    if (botaoMatch) {
      const attrsRaw = botaoMatch[1] ?? '';
      const label = (botaoMatch[2] ?? '').trim() || 'Solicitar orçamento';
      const hrefMatch = attrsRaw.match(/url="([^"]*)"/i);
      const href = hrefMatch?.[1] ? unescapeAttr(hrefMatch[1]) : '/orcamento';
      content.push({
        type: 'ctaButton',
        attrs: {
          href,
          label,
          download: /\bdownload\b/i.test(attrsRaw) ? href.split('/').pop()?.split('?')[0] || true : null,
          target: /\bnova-aba\b/i.test(attrsRaw) ? '_blank' : null,
        },
      });
      rest = rest.slice(botaoMatch[0].length).trimStart();
      continue;
    }

    const wrappedTags: { tag: string; build: (inner: string) => JSONContent | null }[] = [
      {
        tag: 'h2',
        build: (inner) => ({
          type: 'heading',
          attrs: { level: 2 },
          content: parseInlineMarkup(inner.trim()),
        }),
      },
      {
        tag: 'h3',
        build: (inner) => ({
          type: 'heading',
          attrs: { level: 3 },
          content: parseInlineMarkup(inner.trim()),
        }),
      },
      {
        tag: 'citacao',
        build: (inner) => ({
          type: 'blockquote',
          content: [paragraphNode(parseInlineMarkup(inner.trim()))],
        }),
      },
      {
        tag: 'lista',
        build: (inner) => ({
          type: 'bulletList',
          content: parseListItems(inner, false),
        }),
      },
      {
        tag: 'lista-numerada',
        build: (inner) => ({
          type: 'orderedList',
          content: parseListItems(inner, true),
        }),
      },
      {
        tag: 'tabela',
        build: (inner) => parseTableBlock(inner),
      },
    ];

    let matched = false;
    for (const wrapped of wrappedTags) {
      const { node, consumed } = parseWrappedBlock(rest, wrapped.tag, wrapped.build);
      if (consumed > 0 && node) {
        content.push(node);
        rest = rest.slice(consumed).trimStart();
        matched = true;
        break;
      }
    }
    if (matched) {
      continue;
    }

    const paragraphEnd = findParagraphEnd(rest);
    const paragraphText = rest.slice(0, paragraphEnd).trim();
    if (paragraphText) {
      content.push(paragraphNode(parseInlineMarkup(paragraphText)));
    }
    rest = rest.slice(paragraphEnd).trimStart();
    if (paragraphEnd === 0 && rest.length > 0) {
      rest = rest.slice(1);
    }
  }

  if (!content.length) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  return { type: 'doc', content };
}

/** Renumbers [imgN] tags after the image list changes (reorder or removal). */
export function remapImageTagsAfterImageChange(
  markup: string,
  previousImages: BlogEditorImage[],
  nextImages: BlogEditorImage[],
): string {
  let temp = markup;
  for (let index = 0; index < previousImages.length; index += 1) {
    const image = previousImages[index]!;
    temp = temp.replace(new RegExp(`\\[img${index + 1}\\]`, 'gi'), `[[IMG:${image.id}]]`);
  }

  for (let index = 0; index < nextImages.length; index += 1) {
    const image = nextImages[index]!;
    temp = temp.replaceAll(`[[IMG:${image.id}]]`, `[img${index + 1}]`);
  }

  return temp.replace(/\[\[IMG:[^\]]+\]\]/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

/** @deprecated Use remapImageTagsAfterImageChange */
export function remapImageTagsInMarkup(markup: string, images: BlogEditorImage[]): string {
  return remapImageTagsAfterImageChange(markup, images, images);
}

export function blogTagStateToTiptapDoc(state: BlogTagEditorState): JSONContent {
  return parseBlogTagMarkup(state.markup, state.images);
}

export function initBlogTagStateFromTiptap(doc: JSONContent): BlogTagEditorState {
  const converted = tiptapDocToBlogTagMarkup(doc);
  if (converted.markup.trim() || converted.images.length) {
    return converted;
  }
  return { markup: '', images: [] };
}

/** Inserts an opening/closing tag pair at the textarea selection. */
export function insertTagPairAtSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  openTag: string,
  closeTag: string,
) {
  const selected = value.slice(selectionStart, selectionEnd);
  const nextValue = `${value.slice(0, selectionStart)}${openTag}${selected}${closeTag}${value.slice(selectionEnd)}`;
  const cursorStart = selectionStart + openTag.length;
  const cursorEnd = selected ? cursorStart + selected.length : cursorStart;
  return { value: nextValue, selectionStart: cursorStart, selectionEnd: cursorEnd };
}

export function insertTextAtSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  insert: string,
) {
  const nextValue = `${value.slice(0, selectionStart)}${insert}${value.slice(selectionEnd)}`;
  const cursor = selectionStart + insert.length;
  return { value: nextValue, selectionStart: cursor, selectionEnd: cursor };
}

export function removeImageFromMarkup(markup: string, imageNumber: number): string {
  return markup
    .replace(new RegExp(`\\[img${imageNumber}\\]`, 'gi'), '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
