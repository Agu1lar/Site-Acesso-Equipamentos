import { describe, expect, it } from 'vitest';
import {
  mergeCampaignSpendMaps,
  parseCampaignSpendMap,
  parseSpendJsonParam,
} from '@/lib/chatpro-roi-report';

describe('parseCampaignSpendMap', () => {
  it('normalizes campaign keys and amounts', () => {
    expect(parseCampaignSpendMap({
      ' Nova_Plataformas ': 2400,
      nova_guindaste: '1800.5',
      invalid: -1,
    })).toEqual({
      'nova_plataformas': 2400,
      nova_guindaste: 1800.5,
    });
  });

  it('returns empty object for invalid input', () => {
    expect(parseCampaignSpendMap(null)).toEqual({});
    expect(parseCampaignSpendMap([])).toEqual({});
  });
});

describe('parseSpendJsonParam', () => {
  it('parses URL-encoded spend json', () => {
    const encoded = encodeURIComponent(JSON.stringify({ nova_test: 500 }));
    const result = parseSpendJsonParam(encoded);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spend).toEqual({ nova_test: 500 });
    }
  });

  it('rejects invalid json', () => {
    expect(parseSpendJsonParam('{bad')).toEqual({ ok: false, error: 'invalid_spend_json' });
  });
});

describe('mergeCampaignSpendMaps', () => {
  it('lets manual spend override google ads values', () => {
    expect(mergeCampaignSpendMaps(
      { nova_test: 1000 },
      { nova_test: 1200, nova_other: 300 },
    )).toEqual({
      nova_test: 1200,
      nova_other: 300,
    });
  });
});
