import type { JSONContent } from '@tiptap/core';
import Image from 'next/image';
import type { ReactNode } from 'react';

type BlogArticleBodyProps = {
  content: JSONContent;
};

const proseClassName = [
  'prose prose-neutral max-w-none',
  'prose-headings:font-heading prose-headings:scroll-mt-28 prose-headings:text-neutral-900',
  'prose-h2:mt-14 prose-h2:mb-4 prose-h2:border-b prose-h2:border-neutral-200 prose-h2:pb-3 prose-h2:text-2xl',
  'prose-h3:mt-10 prose-h3:mb-3 prose-h3:text-xl',
  'prose-p:text-neutral-700 prose-p:leading-relaxed prose-p:text-[1.05rem]',
  'prose-li:text-neutral-700 prose-li:leading-relaxed',
  'prose-ul:my-6 prose-ol:my-6',
  'prose-a:text-primary prose-a:font-medium',
  'prose-blockquote:my-8 prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-neutral-50',
  'prose-blockquote:py-3 prose-blockquote:pr-4 prose-blockquote:pl-5 prose-blockquote:not-italic',
  'prose-blockquote:text-neutral-700',
].join(' ');

const ctaClassName =
  'inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground no-underline hover:bg-primary-hover';

function renderMarks(text: string, marks: JSONContent['marks'], key: string): ReactNode {
  let node: ReactNode = text;

  for (const mark of marks ?? []) {
    if (mark.type === 'bold') {
      node = <strong key={`${key}-b`}>{node}</strong>;
    } else if (mark.type === 'italic') {
      node = <em key={`${key}-i`}>{node}</em>;
    } else if (mark.type === 'link') {
      const href = typeof mark.attrs?.href === 'string' ? mark.attrs.href : '#';
      const target = typeof mark.attrs?.target === 'string' ? mark.attrs.target : undefined;
      const rel = typeof mark.attrs?.rel === 'string' ? mark.attrs.rel : undefined;
      const download = mark.attrs?.download;
      node = (
        <a
          className="text-primary font-medium underline underline-offset-2"
          download={download === true ? true : typeof download === 'string' ? download : undefined}
          href={href}
          key={`${key}-a`}
          rel={rel}
          target={target}
        >
          {node}
        </a>
      );
    }
  }

  return <span key={key}>{node}</span>;
}

function renderInline(nodes: JSONContent[] | undefined, keyPrefix: string): ReactNode[] {
  if (!nodes?.length) {
    return [];
  }

  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    if (node.type === 'text' && typeof node.text === 'string') {
      return renderMarks(node.text, node.marks, key);
    }
    if (node.type === 'hardBreak') {
      return <br key={key} />;
    }
    return null;
  });
}

function BlogImageFigure(props: { src: string; alt: string; priority?: boolean }) {
  const alt = props.alt.trim();

  return (
    <figure className="not-prose my-10 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
      <div className="relative flex min-h-[12rem] w-full items-center justify-center bg-neutral-100 sm:min-h-[16rem]">
        <Image
          alt={alt || 'Imagem do artigo'}
          className="h-auto max-h-[36rem] w-full object-contain"
          height={900}
          priority={props.priority}
          sizes="(max-width: 768px) 100vw, 768px"
          src={props.src}
          width={1600}
        />
      </div>
      {alt ? (
        <figcaption className="border-t border-neutral-200 px-4 py-3 text-sm leading-snug text-neutral-600">
          {alt}
        </figcaption>
      ) : null}
    </figure>
  );
}

function renderNode(node: JSONContent, key: string, imageIndex: { current: number }): ReactNode {
  switch (node.type) {
    case 'paragraph':
      return <p key={key}>{renderInline(node.content, key)}</p>;
    case 'heading': {
      const level = Number(node.attrs?.level) === 3 ? 3 : 2;
      const children = renderInline(node.content, key);
      if (level === 3) {
        return <h3 key={key}>{children}</h3>;
      }
      return <h2 key={key}>{children}</h2>;
    }
    case 'bulletList':
      return (
        <ul key={key}>
          {(node.content ?? []).map((item, index) => renderNode(item, `${key}-li-${index}`, imageIndex))}
        </ul>
      );
    case 'orderedList':
      return (
        <ol key={key}>
          {(node.content ?? []).map((item, index) => renderNode(item, `${key}-li-${index}`, imageIndex))}
        </ol>
      );
    case 'listItem':
      return (
        <li key={key}>
          {(node.content ?? []).map((child, index) => renderNode(child, `${key}-c-${index}`, imageIndex))}
        </li>
      );
    case 'blockquote':
      return (
        <blockquote key={key}>
          {(node.content ?? []).map((child, index) => renderNode(child, `${key}-bq-${index}`, imageIndex))}
        </blockquote>
      );
    case 'image': {
      const src = typeof node.attrs?.src === 'string' ? node.attrs.src : '';
      if (!src) {
        return null;
      }
      const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : '';
      const priority = imageIndex.current < 2;
      imageIndex.current += 1;
      return <BlogImageFigure alt={alt} key={key} priority={priority} src={src} />;
    }
    case 'ctaButton': {
      const href = typeof node.attrs?.href === 'string' ? node.attrs.href : '/orcamento';
      const label = typeof node.attrs?.label === 'string' ? node.attrs.label : 'Solicitar orçamento';
      const target = typeof node.attrs?.target === 'string' ? node.attrs.target : undefined;
      return (
        <p className="not-prose my-8" key={key}>
          <a className={ctaClassName} data-cta-button="" href={href} rel={target ? 'noopener noreferrer' : undefined} target={target}>
            {label}
          </a>
        </p>
      );
    }
    case 'videoEmbed': {
      const embedSrc = typeof node.attrs?.embedSrc === 'string' ? node.attrs.embedSrc : '';
      const provider = typeof node.attrs?.provider === 'string' ? node.attrs.provider : 'file';
      if (!embedSrc) {
        return null;
      }
      if (provider === 'file') {
        return (
          <div className="not-prose my-10 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-900" data-video-embed="" key={key}>
            <video className="w-full rounded-xl" controls preload="metadata" src={embedSrc} />
          </div>
        );
      }
      return (
        <div className="not-prose my-10 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-900" data-video-embed="" key={key}>
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="aspect-video w-full"
            src={embedSrc}
            title="Vídeo incorporado"
          />
        </div>
      );
    }
    case 'horizontalRule':
      return <hr key={key} />;
    default:
      if (node.content?.length) {
        return (
          <div key={key}>
            {node.content.map((child, index) => renderNode(child, `${key}-${index}`, imageIndex))}
          </div>
        );
      }
      return null;
  }
}

/**
 * Renders TipTap article body with Next.js images that keep the full frame visible.
 */
export function BlogArticleBody(props: BlogArticleBodyProps) {
  const imageIndex = { current: 0 };
  const children = (props.content.content ?? []).map((node, index) =>
    renderNode(node, `n-${index}`, imageIndex),
  );

  return <div className={proseClassName}>{children}</div>;
}
