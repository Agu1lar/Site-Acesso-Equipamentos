'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { CategoryFilterChip } from '@/components/marketing/CategoryNav';
import { EquipmentCard } from '@/components/marketing/EquipmentCard';
import { buildSearchHaystack, matchesSearchQuery } from '@/lib/search';
import { CATEGORY_LABELS, EQUIPMENT_CATEGORY_ORDER } from '@/types/equipment';
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
  const allActive = !initialCategory;

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

  const counts = useMemo(() => {
    const byCategory = Object.fromEntries(
      EQUIPMENT_CATEGORY_ORDER.map((category) => [category, 0]),
    ) as Record<EquipmentCategory, number>;

    for (const item of equipment) {
      byCategory[item.category] += 1;
    }

    return {
      total: equipment.length,
      byCategory,
    };
  }, [equipment]);

  const allHref = initialQuery
    ? `/equipamentos?q=${encodeURIComponent(initialQuery)}`
    : '/equipamentos';

  return (
    <div>
      <nav
        aria-label={t('filter_categories_label')}
        className="mt-6 rounded-[var(--radius-card)] border border-neutral-200 bg-neutral-50 p-3 sm:p-4"
      >
        <p className="font-heading text-sm font-semibold text-neutral-900">
          {t('filter_categories_label')}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <CategoryFilterChip
            active={allActive}
            count={counts.total}
            href={allHref}
            label={t('filter_all')}
          />
          {EQUIPMENT_CATEGORY_ORDER.map((category) => (
            <CategoryFilterChip
              active={initialCategory === category}
              category={category}
              count={counts.byCategory[category]}
              href={`/categorias/${category}`}
              key={category}
              label={CATEGORY_LABELS[category]}
            />
          ))}
        </div>
      </nav>

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
