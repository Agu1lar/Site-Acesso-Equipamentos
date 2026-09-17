'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { EquipmentCard } from '@/components/marketing/EquipmentCard';
import { buildSearchHaystack, matchesSearchQuery } from '@/lib/search';
import { CATEGORY_LABELS } from '@/types/equipment';
import type { Equipment, EquipmentCategory } from '@/types/equipment';

type EquipmentCatalogProps = {
  equipment: Equipment[];
  imageBySlug?: Record<string, string>;
  initialQuery?: string;
  initialCategory?: string;
};

export function EquipmentCatalog({
  equipment,
  imageBySlug,
  initialQuery = '',
  initialCategory = '',
}: EquipmentCatalogProps) {
  const t = useTranslations('Equipamentos');

  const filtered = useMemo(() => {
    const q = initialQuery.trim();
    return equipment.filter((item) => {
      if (initialCategory && item.category !== initialCategory) {
        return false;
      }
      if (!q) {
        return true;
      }
      return matchesSearchQuery(
        buildSearchHaystack({
          slug: item.slug,
          name: item.name,
          category: item.category,
          tags: item.tags,
        }),
        q,
      );
    });
  }, [equipment, initialQuery, initialCategory]);

  const categories = Object.keys(CATEGORY_LABELS) as EquipmentCategory[];
  const showAllFilter = initialCategory === undefined;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <a
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${showAllFilter ? 'bg-primary text-primary-foreground' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}
          href={
            initialQuery ? `/equipamentos?q=${encodeURIComponent(initialQuery)}` : '/equipamentos'
          }
        >
          {t('filter_all')}
        </a>
        {categories.map((cat) => {
          const active = initialCategory === cat;
          return (
            <a
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${active ? 'bg-primary text-primary-foreground' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}
              href={`/categorias/${cat}`}
              key={cat}
            >
              {CATEGORY_LABELS[cat]}
            </a>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-neutral-600">
        {t('results_count', { count: filtered.length })}
      </p>

      {filtered.length === 0 ? (
        <p className="mt-12 text-center text-neutral-600">{t('empty')}</p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => (
            <EquipmentCard
              equipment={item}
              imageSrc={imageBySlug?.[item.slug]}
              key={item.slug}
            />
          ))}
        </div>
      )}
    </div>
  );
}
