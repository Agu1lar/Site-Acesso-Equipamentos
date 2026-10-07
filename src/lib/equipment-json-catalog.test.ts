import { describe, expect, it } from 'vitest';
import equipmentJson from '@/data/equipamentos.json';
import type { Equipment } from '@/types/equipment';

const catalog = equipmentJson as Equipment[];

describe('json-only catalog lookup', () => {
  it('finds Genie S-80 J with its canonical slug', () => {
    const item = catalog.find((entry) => entry.name.includes('Genie S-80 J'));
    expect(item?.slug).toBe('plataforma-elevatoria-s80-j');
    expect(item?.specs.some((spec) => spec.label === 'Tipo' && spec.value.includes('telescópica'))).toBe(
      true,
    );
  });
});
