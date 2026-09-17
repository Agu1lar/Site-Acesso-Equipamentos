'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { Link } from '@/libs/I18nNavigation';
import type { HomeCategoryCardConfig } from '@/data/home-category-cards';
import { CATEGORY_LABELS } from '@/types/equipment';

const ROTATION_MS = 4500;

type CategoryHomeCardProps = {
  card: HomeCategoryCardConfig;
  catalogImages: string[];
  ctaLabel: string;
  /** Stagger rotation start across cards in the grid. */
  rotationOffsetMs?: number;
};

export function CategoryHomeCard({
  card,
  catalogImages,
  ctaLabel,
  rotationOffsetMs = 0,
}: CategoryHomeCardProps) {
  const images = useMemo(() => {
    if (card.staticImageSrc) {
      return [card.staticImageSrc];
    }
    return catalogImages.length > 0 ? catalogImages : [];
  }, [card.staticImageSrc, catalogImages]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [images]);

  useEffect(() => {
    if (images.length <= 1) {
      return;
    }

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | undefined;
    const timeoutId = setTimeout(() => {
      intervalId = setInterval(() => {
        setIndex((current) => (current + 1) % images.length);
      }, ROTATION_MS);
    }, rotationOffsetMs);

    return () => {
      clearTimeout(timeoutId);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [images, rotationOffsetMs]);

  const imageClass =
    card.imageFit === 'cover'
      ? 'object-cover object-center'
      : 'object-contain object-center p-3';

  const activeSrc = images[index];
  const nextSrc = images.length > 1 ? images[(index + 1) % images.length] : undefined;
  const renderedImages = activeSrc
    ? nextSrc && nextSrc !== activeSrc
      ? [activeSrc, nextSrc]
      : [activeSrc]
    : [];

  return (
    <Link
      className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-neutral-200 bg-surface shadow-sm transition-all hover:border-primary hover:shadow-md"
      href={`/categorias/${card.slug}`}
    >
      <div className="relative h-40 w-full overflow-hidden bg-neutral-100 sm:h-44">
        {renderedImages.length > 0 ? (
          renderedImages.map((src) => (
            <Image
              alt=""
              aria-hidden
              className={`absolute inset-0 ${imageClass} transition-opacity duration-700 motion-reduce:transition-none ${
                src === activeSrc ? 'opacity-100' : 'opacity-0'
              }`}
              fill
              key={src}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              src={src}
            />
          ))
        ) : (
          <div
            aria-hidden
            className="flex h-full items-center justify-center text-xs text-neutral-400"
          >
            Sem foto
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-heading text-base font-semibold text-neutral-900 group-hover:text-primary sm:text-lg">
          {CATEGORY_LABELS[card.slug]}
        </h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-neutral-600">
          {card.description}
        </p>
        <span className="mt-3 text-sm font-semibold text-primary">{ctaLabel}</span>
      </div>
    </Link>
  );
}
