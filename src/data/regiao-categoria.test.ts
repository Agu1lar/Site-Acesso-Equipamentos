import { describe, expect, it } from 'vitest';
import {
  buildRegiaoCategoriaContent,
  getAllRegiaoCategoriaPaths,
} from '@/data/regiao-categoria';

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

  it('enriches Brumadinho plataformas with mining and terrain context', () => {
    const content = buildRegiaoCategoriaContent('brumadinho', 'plataformas-elevatorias');

    expect(content).not.toBeNull();
    expect(content?.path).toBe('/regioes/brumadinho/plataformas-elevatorias');
    expect(content?.metaTitle).toBe('Locação de plataformas elevatórias em Brumadinho');
    expect(content?.enrichment?.types.some((item) => /articulada/i.test(item.title))).toBe(true);
    expect(content?.faqs.some((item) => /terreno/i.test(item.question))).toBe(true);
    expect(content?.intro.join(' ')).toMatch(/mineração/i);
  });

  it('includes Brumadinho in the S4 city matrix', () => {
    expect(getAllRegiaoCategoriaPaths()).toContain('/regioes/brumadinho/plataformas-elevatorias');
    expect(getAllRegiaoCategoriaPaths()).toHaveLength(28);
  });

  it('keeps other combos without enrichment', () => {
    const content = buildRegiaoCategoriaContent('betim', 'plataformas-elevatorias');

    expect(content?.enrichment).toBeNull();
    expect(content?.metaTitle).toContain('Betim');
  });
});
