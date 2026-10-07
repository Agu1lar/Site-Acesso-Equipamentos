import { describe, expect, it } from 'vitest';
import { canonicalSiteUrl } from '@/lib/canonical-site-url';

describe('canonicalSiteUrl', () => {
  it('redirects the public www host while preserving the path and query', () => {
    expect(
      canonicalSiteUrl(
        'https://www.acessoequipamentos.com.br/equipamentos/andaime?gclid=click-id',
      )?.toString(),
    ).toBe('https://acessoequipamentos.com.br/equipamentos/andaime?gclid=click-id');
  });

  it('keeps the canonical host unchanged', () => {
    expect(canonicalSiteUrl('https://acessoequipamentos.com.br/orcamento')).toBeNull();
  });
});
