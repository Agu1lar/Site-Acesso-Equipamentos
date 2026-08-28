import { describe, expect, it } from 'vitest';
import { buildRegiaoCategoriaContent } from '@/data/regiao-categoria';
import { isIndustrialEnrichedCombo } from '@/data/regiao-categoria-enrichment';

describe('industrial S4 enrichments', () => {
  it('enriches Contagem guindaste with long-form sections', () => {
    const content = buildRegiaoCategoriaContent('contagem', 'guindaste-industrial');

    expect(content?.enrichment?.types.length).toBeGreaterThanOrEqual(4);
    expect(content?.faqs.length).toBeGreaterThanOrEqual(5);
    expect(content?.metaTitle).toBe('Locação de guindaste industrial em Contagem');
    expect(content?.intro.join(' ')).toMatch(/içamento/i);
  });

  it('enriches Betim manipuladores with long-form sections', () => {
    const content = buildRegiaoCategoriaContent('betim', 'manipuladores-telescopicos');

    expect(content?.enrichment?.types.some((item) => /manipulador/i.test(item.title))).toBe(true);
    expect(content?.metaTitle).toBe('Locação de manipuladores telescópicos em Betim');
  });

  it('enriches Belo Horizonte andaimes with long-form sections', () => {
    const content = buildRegiaoCategoriaContent('belo-horizonte', 'andaimes');

    expect(content?.enrichment?.types.some((item) => /fachada/i.test(item.title))).toBe(true);
    expect(content?.faqs.some((item) => /NR-18/i.test(item.answer))).toBe(true);
  });

  it('flags industrial enriched combos', () => {
    expect(isIndustrialEnrichedCombo('contagem', 'guindaste-industrial')).toBe(true);
    expect(isIndustrialEnrichedCombo('belo-horizonte', 'guindaste-industrial')).toBe(false);
    expect(isIndustrialEnrichedCombo('belo-horizonte', 'andaimes')).toBe(true);
  });
});
