import { describe, expect, it } from 'vitest';
import { buildLlmsTxtContent, buildPublicCatalogJson } from '@/lib/ai-discovery';
import type { Equipment } from '@/types/equipment';

const sampleEquipment: Equipment = {
  slug: 'plataforma-elevatoria-s60',
  name: 'Plataforma Genie Z-80/60',
  category: 'plataformas-elevatorias',
  shortDescription: 'Locação de plataforma articulada.',
  longDescription: 'Descrição técnica.',
  specs: [{ label: 'Altura de trabalho', value: '~25 m' }],
  tags: ['plataforma'],
  featured: true,
  available: true,
};

describe('buildPublicCatalogJson', () => {
  it('includes publisher, categories and equipment with absolute urls', () => {
    const json = buildPublicCatalogJson([sampleEquipment], 'https://example.com');

    expect(json.schemaVersion).toBe(1);
    expect(json.site).toBe('https://example.com/');
    expect(json.publisher.name).toBe('Acesso Equipamentos');
    expect(json.categories.some((item) => item.slug === 'plataformas-elevatorias')).toBe(true);
    expect(json.equipment[0]?.url).toBe(
      'https://example.com/equipamentos/plataforma-elevatoria-s60',
    );
    expect(json.counts.equipment).toBe(1);
  });
});

describe('buildLlmsTxtContent', () => {
  it('links catalog.json, sitemap and key marketing routes', () => {
    const text = buildLlmsTxtContent('https://example.com');

    expect(text).toContain('# Acesso Equipamentos');
    expect(text).toContain('[catalog.json](https://example.com/catalog.json)');
    expect(text).toContain('[sitemap.xml](https://example.com/sitemap.xml)');
    expect(text).toContain(
      '[Catálogo completo de equipamentos](https://example.com/equipamentos)',
    );
    expect(text).toContain('[Plataformas elevatórias](https://example.com/categorias/plataformas-elevatorias)');
    expect(text).toContain('comercial@acessoequipamentos.com.br');
  });
});
