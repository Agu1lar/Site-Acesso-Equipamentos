import { mergeAttributes, Node } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import StarterKit from '@tiptap/starter-kit';
import type { VideoEmbedProvider } from '@/lib/blog-tiptap-video';

const linkClass = 'text-primary underline underline-offset-2';
const buttonClass =
  'inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground no-underline hover:bg-primary-hover';
const videoWrapperClass = 'my-8 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-900';
const iframeClass = 'aspect-video w-full';
const fileVideoClass = 'w-full rounded-xl';

/**
 * Blog link mark with optional download and new-tab behavior.
 */
export const BlogLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      download: {
        default: null,
        parseHTML: (element) => element.getAttribute('download'),
        renderHTML: (attributes) => {
          if (!attributes.download) {
            return {};
          }
          return { download: attributes.download === true ? '' : String(attributes.download) };
        },
      },
      target: {
        default: null,
        parseHTML: (element) => element.getAttribute('target'),
        renderHTML: (attributes) => {
          if (!attributes.target) {
            return {};
          }
          return { target: String(attributes.target) };
        },
      },
      rel: {
        default: null,
        parseHTML: (element) => element.getAttribute('rel'),
        renderHTML: (attributes) => {
          if (!attributes.rel) {
            return {};
          }
          return { rel: String(attributes.rel) };
        },
      },
    };
  },
});

/**
 * Embedded video block (YouTube, Vimeo or uploaded file).
 */
export const VideoEmbed = Node.create({
  name: 'videoEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      embedSrc: { default: null },
      provider: { default: 'file' as VideoEmbedProvider },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-video-embed]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const provider = HTMLAttributes.provider as VideoEmbedProvider;
    const embedSrc = HTMLAttributes.embedSrc as string | null;

    if (!embedSrc) {
      return ['div', { 'data-video-embed': '', class: videoWrapperClass }];
    }

    if (provider === 'file') {
      return [
        'div',
        { 'data-video-embed': '', class: videoWrapperClass },
        ['video', mergeAttributes({ src: embedSrc, controls: '', class: fileVideoClass })],
      ];
    }

    return [
      'div',
      { 'data-video-embed': '', class: videoWrapperClass },
      [
        'iframe',
        mergeAttributes({
          src: embedSrc,
          class: iframeClass,
          allow:
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
          allowfullscreen: '',
          title: 'Vídeo incorporado',
        }),
      ],
    ];
  },
});

/**
 * Call-to-action button block linking to internal or external pages.
 */
export const CtaButton = Node.create({
  name: 'ctaButton',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      href: { default: '/orcamento' },
      label: { default: 'Solicitar orçamento' },
      download: { default: null },
      target: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'a[data-cta-button]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const href = String(HTMLAttributes.href ?? '/orcamento');
    const label = String(HTMLAttributes.label ?? 'Solicitar orçamento');
    const attrs: Record<string, string> = {
      'data-cta-button': '',
      href,
      class: buttonClass,
    };

    if (HTMLAttributes.download) {
      attrs.download = HTMLAttributes.download === true ? '' : String(HTMLAttributes.download);
    }
    if (HTMLAttributes.target) {
      attrs.target = String(HTMLAttributes.target);
      attrs.rel = 'noopener noreferrer';
    }

    return ['a', mergeAttributes(attrs), label];
  },
});

const figureClass = 'blog-figure my-10 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50';
const figureFrameClass =
  'relative flex min-h-[12rem] w-full items-center justify-center bg-neutral-100 sm:min-h-[16rem]';
const figureImageClass = 'm-0 h-auto max-h-[36rem] w-full object-contain';
const figureCaptionClass =
  'border-t border-neutral-200 px-4 py-3 text-sm leading-snug text-neutral-600';

/**
 * Inline article images rendered as figure + caption (alt text).
 * Uses object-contain so product/editorial photos are not cropped.
 */
export const BlogImage = Image.extend({
  renderHTML({ HTMLAttributes }) {
    const alt = typeof HTMLAttributes.alt === 'string' ? HTMLAttributes.alt.trim() : '';
    const imgAttrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      class: figureImageClass,
      width: '1600',
      height: '900',
      decoding: 'async',
      style: 'width:100%;height:auto;max-height:36rem;object-fit:contain;',
    });

    const frame = ['div', { class: figureFrameClass }, ['img', imgAttrs]];

    if (!alt) {
      return ['figure', { class: figureClass }, frame];
    }

    return [
      'figure',
      { class: figureClass },
      frame,
      ['figcaption', { class: figureCaptionClass }, alt],
    ];
  },
});

/**
 * Shared TipTap extensions for blog editor and public HTML render.
 */
export function createBlogTiptapExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      link: false,
    }),
    BlogLink.configure({
      openOnClick: false,
      HTMLAttributes: { class: linkClass },
    }),
    BlogImage.configure({
      HTMLAttributes: {},
    }),
    VideoEmbed,
    CtaButton,
  ];
}

export type BlogLinkKind = 'redirect' | 'download' | 'new_tab';

export type BlogLinkInput = {
  href: string;
  kind: BlogLinkKind;
};

/**
 * Builds TipTap link attributes from admin link kind.
 */
export function blogLinkAttributes(input: BlogLinkInput) {
  const href = input.href.trim();
  if (!href) {
    return null;
  }

  if (input.kind === 'download') {
    const filename = href.split('/').pop()?.split('?')[0];
    return {
      href,
      download: filename || true,
      target: null,
      rel: null,
    };
  }

  if (input.kind === 'new_tab') {
    return {
      href,
      download: null,
      target: '_blank',
      rel: 'noopener noreferrer',
    };
  }

  return {
    href,
    download: null,
    target: null,
    rel: null,
  };
}
