'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { FilterChipButton } from '@/components/marketing/CategoryNav';
import { EquipmentCard } from '@/components/marketing/EquipmentCard';
import {
  matchesPlatformHeightFilter,
  type PlatformHeightFilter,
} from '@/lib/platform-height';
import {
  matchesPlatformKindFilter,
  type PlatformKindFilter,
} from '@/lib/platform-kind';
import type { Equipment } from '@/types/equipment';
import { persistAnalyticsEvent } from '@/lib/track-analytics-event';

function trackCategoryFilter(filterId: string, label: string) {
  if (filterId === 'all') {
    return;
  }

  persistAnalyticsEvent({
    eventType: 'category_filter',
    origin: 'category_filter',
    equipmentSlug: filterId,
    equipmentName: label,
  });
}

type CategoryEquipmentGridProps = {
  equipment: Equipment[];
  imageBySlug: Record<string, string>;
  showPlatformKindFilter?: boolean;
};

const PLATFORM_KIND_FILTERS: PlatformKindFilter[] = [
  'all',
  'tesoura',
  'articulada',
  'telescopica',
  'mastro',
];
const PLATFORM_HEIGHT_FILTERS: PlatformHeightFilter[] = [
  'all',
  'up-to-10',
  'from-10-to-16',
  'from-16-to-26',
  'above-26',
];

type FilterGroupProps = {
  chips: Array<{ id: string; active: boolean; label: string; onClick: () => void }>;
  groupLabel: string;
};

function FilterGroup(props: FilterGroupProps) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-neutral-200 bg-white p-3 sm:p-4">
      <p className="text-sm font-semibold text-neutral-900">{props.groupLabel}</p>
      <div
        aria-label={props.groupLabel}
        className="mt-2.5 flex min-w-0 flex-wrap gap-2"
        role="group"
      >
        {props.chips.map((chip) => (
          <FilterChipButton
            active={chip.active}
            key={chip.id}
            label={chip.label}
            onClick={chip.onClick}
          />
        ))}
      </div>
    </div>
  );
}

export function CategoryEquipmentGrid(props: CategoryEquipmentGridProps) {
  const t = useTranslations('Categoria');
  const [platformKind, setPlatformKind] = useState<PlatformKindFilter>('all');
  const [platformHeight, setPlatformHeight] = useState<PlatformHeightFilter>('all');
  const showPlatformFilters = props.showPlatformKindFilter ?? false;

  const filtered = showPlatformFilters
    ? props.equipment.filter(
        (item) =>
          matchesPlatformKindFilter(item, platformKind) &&
          matchesPlatformHeightFilter(item, platformHeight),
      )
    : props.equipment;

  const filterLabel: Record<PlatformKindFilter, string> = {
    all: t('filter_all_platforms'),
    tesoura: t('filter_scissor'),
    articulada: t('filter_articulated'),
    telescopica: t('filter_telescopic'),
    mastro: t('filter_mast'),
  };
  const heightFilterLabel: Record<PlatformHeightFilter, string> = {
    all: t('filter_all_heights'),
    'up-to-10': t('filter_height_up_to_10'),
    'from-10-to-16': t('filter_height_10_to_16'),
    'from-16-to-26': t('filter_height_16_to_26'),
    'above-26': t('filter_height_above_26'),
  };

  return (
    <>
      {showPlatformFilters ? (
        <section
          aria-labelledby="category-platform-filters-title"
          className="mt-4 min-w-0 overflow-hidden rounded-[var(--radius-card)] border border-neutral-200 bg-neutral-50 p-4 sm:p-5"
        >
          <h3
            className="font-heading text-base font-bold text-neutral-900 sm:text-lg"
            id="category-platform-filters-title"
          >
            {t('filter_platform_filters_title')}
          </h3>
          <p className="mt-1.5 text-sm text-neutral-600">{t('filter_platform_intro')}</p>

          <div className="mt-4 grid min-w-0 gap-3 sm:gap-4">
            <FilterGroup
              chips={PLATFORM_KIND_FILTERS.map((kind) => ({
                id: kind,
                active: platformKind === kind,
                label: filterLabel[kind],
                onClick: () => {
                  setPlatformKind(kind);
                  trackCategoryFilter(kind, filterLabel[kind]);
                },
              }))}
              groupLabel={t('filter_platform_kind_label')}
            />
            <FilterGroup
              chips={PLATFORM_HEIGHT_FILTERS.map((height) => ({
                id: height,
                active: platformHeight === height,
                label: heightFilterLabel[height],
                onClick: () => {
                  setPlatformHeight(height);
                  trackCategoryFilter(height, heightFilterLabel[height]);
                },
              }))}
              groupLabel={t('filter_platform_height_label')}
            />
          </div>
        </section>
      ) : null}

      <p className={`text-sm text-neutral-600 ${showPlatformFilters ? 'mt-4' : 'mt-1'}`}>
        {t('results_count', { count: filtered.length })}
      </p>

      {filtered.length === 0 ? (
        <p className="mt-8 text-center text-neutral-600">{t('empty')}</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => (
            <EquipmentCard
              equipment={item}
              hideCategoryLabel
              imageSrc={props.imageBySlug[item.slug]}
              key={item.slug}
            />
          ))}
        </div>
      )}
    </>
  );
}
