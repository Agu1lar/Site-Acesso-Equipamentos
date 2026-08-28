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

  it('enriches Santa Luzia plataformas with industrial and urban context', () => {
    const content = buildRegiaoCategoriaContent('santa-luzia', 'plataformas-elevatorias');

    expect(content).not.toBeNull();
    expect(content?.path).toBe('/regioes/santa-luzia/plataformas-elevatorias');
    expect(content?.metaTitle).toBe('Locação de plataformas elevatórias em Santa Luzia');
    expect(content?.enrichment?.types.length).toBeGreaterThanOrEqual(4);
    expect(content?.faqs.some((item) => /galpões/i.test(item.question))).toBe(true);
    expect(content?.intro.join(' ')).toMatch(/industrial/i);
  });

  it('enriches Vespasiano plataformas with northern RMBH industrial context', () => {
    const content = buildRegiaoCategoriaContent('vespasiano', 'plataformas-elevatorias');

    expect(content).not.toBeNull();
    expect(content?.path).toBe('/regioes/vespasiano/plataformas-elevatorias');
    expect(content?.metaTitle).toBe('Locação de plataformas elevatórias em Vespasiano');
    expect(content?.enrichment?.types.length).toBeGreaterThanOrEqual(4);
    expect(content?.faqs.some((item) => /galpões/i.test(item.question))).toBe(true);
    expect(content?.intro.join(' ')).toMatch(/norte/i);
  });

  it('enriches Lagoa Santa plataformas with Confins corridor context', () => {
    const content = buildRegiaoCategoriaContent('lagoa-santa', 'plataformas-elevatorias');

    expect(content).not.toBeNull();
    expect(content?.path).toBe('/regioes/lagoa-santa/plataformas-elevatorias');
    expect(content?.metaTitle).toBe('Locação de plataformas elevatórias em Lagoa Santa');
    expect(content?.enrichment?.types.length).toBeGreaterThanOrEqual(4);
    expect(content?.faqs.some((item) => /Confins/i.test(item.question))).toBe(true);
    expect(content?.intro.join(' ')).toMatch(/Confins/i);
  });

  it('includes Vespasiano and Lagoa Santa in the S4 city matrix', () => {
    const paths = getAllRegiaoCategoriaPaths();
    expect(paths).toContain('/regioes/vespasiano/plataformas-elevatorias');
    expect(paths).toContain('/regioes/lagoa-santa/plataformas-elevatorias');
    expect(paths).toHaveLength(48);
  });

  it('includes Sabará and Sarzedo in the S4 city matrix', () => {
    const paths = getAllRegiaoCategoriaPaths();
    expect(paths).toContain('/regioes/sabara/plataformas-elevatorias');
    expect(paths).toContain('/regioes/sarzedo/plataformas-elevatorias');
  });

  it('enriches Ibirité plataformas with industrial shutdown context', () => {
    const content = buildRegiaoCategoriaContent('ibirite', 'plataformas-elevatorias');

    expect(content).not.toBeNull();
    expect(content?.path).toBe('/regioes/ibirite/plataformas-elevatorias');
    expect(content?.metaTitle).toBe('Locação de plataformas elevatórias em Ibirité');
    expect(content?.enrichment?.types.length).toBeGreaterThanOrEqual(4);
    expect(content?.faqs.some((item) => /paradas/i.test(item.question))).toBe(true);
    expect(content?.intro.join(' ')).toMatch(/industrial/i);
  });

  it('keeps other combos without enrichment', () => {
    const content = buildRegiaoCategoriaContent('betim', 'plataformas-elevatorias');

    expect(content?.enrichment).toBeNull();
    expect(content?.metaTitle).toContain('Betim');
  });
});
