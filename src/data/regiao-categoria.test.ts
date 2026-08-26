import { describe, expect, it } from 'vitest';
import { buildRegiaoCategoriaContent } from '@/data/regiao-categoria';

describe('buildRegiaoCategoriaContent', () => {
  it('enriches Contagem plataformas with long-form SEO sections', () => {
    const content = buildRegiaoCategoriaContent('contagem', 'plataformas-elevatorias');

    expect(content).not.toBeNull();
    expect(content?.metaTitle).toBe('Locação de plataformas elevatórias em Contagem');
    expect(content?.enrichment?.types.length).toBeGreaterThanOrEqual(4);
    expect(content?.enrichment?.propulsion.length).toBe(2);
    expect(content?.faqs.length).toBeGreaterThanOrEqual(6);
    expect(content?.intro.join(' ')).toMatch(/polo industrial/i);
  });

  it('keeps other combos without enrichment', () => {
    const content = buildRegiaoCategoriaContent('betim', 'plataformas-elevatorias');

    expect(content?.enrichment).toBeNull();
    expect(content?.metaTitle).toContain('Betim');
  });
});
