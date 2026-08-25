import { describe, expect, it } from 'vitest';
import {
  legacyRedirectStats,
  normalizeLegacyPathname,
  resolveLegacyRedirect,
} from './legacy-redirects';

describe('normalize legacy pathname', () => {
  it('removes trailing slash from path', () => {
    expect(normalizeLegacyPathname('/blog/')).toBe('/blog');
  });

  it('keeps root path', () => {
    expect(normalizeLegacyPathname('/')).toBe('/');
  });
});

describe('resolve legacy redirect', () => {
  it('redirects blog index to dicas', () => {
    expect(resolveLegacyRedirect('/blog/')).toBe('/dicas');
  });

  it('redirects short training alias to canonical training page', () => {
    expect(resolveLegacyRedirect('/treinamento')).toBe('/treinamento-plataformas-aereas');
    expect(resolveLegacyRedirect('/treinamento/')).toBe('/treinamento-plataformas-aereas');
  });

  it('redirects plataformas post to dicas article', () => {
    expect(
      resolveLegacyRedirect(
        '/plataforma-elevatoria-tesoura-a-solucao-ideal-para-trabalhos-em-altura/',
      ),
    ).toBe('/dicas/como-escolher-plataforma-elevatoria-bh');
  });

  it('redirects nr12 post to dicas article', () => {
    expect(
      resolveLegacyRedirect(
        '/equipamentos-em-conformidade-com-a-nr12-seguranca-e-qualidade-para-sua-obra',
      ),
    ).toBe('/dicas/nr-12-trabalho-em-altura-locacao');
  });

  it('redirects wp category prefix to equipamentos', () => {
    expect(resolveLegacyRedirect('/category/plataformas/')).toBe('/equipamentos');
  });

  it('redirects web stories prefix to dicas', () => {
    expect(resolveLegacyRedirect('/web-stories/exemplo')).toBe('/dicas');
  });

  it('redirects guindaste wp page to guindaste category', () => {
    expect(
      resolveLegacyRedirect('/locacao-de-guindaste-industrial-munck-e-remocao-em-bh'),
    ).toBe('/categorias/guindaste-industrial');
  });

  it('redirects franna wp page to franna detail', () => {
    expect(resolveLegacyRedirect('/aluguel-de-guindaste-fr17-franna-bh')).toBe(
      '/equipamentos/franna-fr17',
    );
  });

  it('redirects wp content prefix to home', () => {
    expect(resolveLegacyRedirect('/wp-content/uploads/2023/foo.jpg')).toBe('/');
  });

  it('returns null for unknown marketing path', () => {
    expect(resolveLegacyRedirect('/orcamento')).toBeNull();
  });
});

describe('legacy redirect stats', () => {
  it('lists configured redirect counts', () => {
    const stats = legacyRedirectStats();
    expect(stats.exact).toBeGreaterThanOrEqual(20);
    expect(stats.prefix).toBeGreaterThanOrEqual(3);
  });
});
