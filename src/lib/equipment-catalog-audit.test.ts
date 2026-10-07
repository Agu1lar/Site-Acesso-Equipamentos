import { describe, expect, it } from 'vitest';
import equipmentJson from '@/data/equipamentos.json';
import { FEATURED_EQUIPMENT_SLUGS } from '@/data/featured-equipment';
import {
  auditEquipmentCatalog,
  formatCatalogAuditReport,
} from '@/lib/equipment-catalog-audit';
import type { Equipment } from '@/types/equipment';

const catalog = equipmentJson as Equipment[];

describe('audit equipment catalog', () => {
  it('detects featured slugs missing from Postgres in typical partial sync', () => {
    const dbSlugs = new Set(
      catalog
        .map((item) => item.slug)
        .filter((slug) => !(FEATURED_EQUIPMENT_SLUGS as readonly string[]).includes(slug)),
    );
    const report = auditEquipmentCatalog({ items: catalog, dbSlugs });
    const featuredJsonOnly = report.byCode.json_only.map((row) => row.slug);

    expect(featuredJsonOnly).toEqual(expect.arrayContaining([...FEATURED_EQUIPMENT_SLUGS]));
  });

  it('does not flag mast platforms as missing tipo filter', () => {
    const report = auditEquipmentCatalog({ items: catalog });
    expect(report.byCode.platform_missing_kind.length).toBe(0);
  });

  it('reports no retired mangote slugs in JSON', () => {
    const report = auditEquipmentCatalog({ items: catalog });
    expect(report.byCode.retired_in_json.length).toBe(0);
  });

  it('prints audit summary for manual review', () => {
    const report = auditEquipmentCatalog({ items: catalog });
    const text = formatCatalogAuditReport(report);
    expect(text).toContain(`JSON: ${catalog.length} itens`);
    if (report.issues.length > 0) {
      console.log(`\n${text}`);
    }
  });
});
