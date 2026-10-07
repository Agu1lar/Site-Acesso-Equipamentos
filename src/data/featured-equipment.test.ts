import { describe, expect, it } from 'vitest';
import equipmentData from '@/data/equipamentos.json';
import { FEATURED_EQUIPMENT_SLUGS } from '@/data/featured-equipment';
import type { Equipment } from '@/types/equipment';

const catalog = equipmentData as Equipment[];

describe('featured equipment slugs', () => {
  it('maps every home highlight slug to an available catalog item', () => {
    const bySlug = new Map(catalog.map((item) => [item.slug, item]));

    for (const slug of FEATURED_EQUIPMENT_SLUGS) {
      const item = bySlug.get(slug);
      expect(item, `missing catalog item for ${slug}`).toBeDefined();
      expect(item?.available).toBe(true);
    }
  });

  it('keeps the expected display order on the home page', () => {
    expect(FEATURED_EQUIPMENT_SLUGS).toEqual([
      'franna-fr17',
      'plataforma-elevatoria-s80',
      'plataforma-elevatoria-s80-j',
      'plataforma-elevatoria-gs4655',
      'plataforma-elevatoria-1350sjp',
      'manipulador-telescopico-mxt840',
    ]);
  });
});
