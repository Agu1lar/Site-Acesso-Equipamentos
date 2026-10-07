import equipmentJson from '@/data/equipamentos.json';
import { FEATURED_EQUIPMENT_SLUGS } from '@/data/featured-equipment';
import { getPlatformHeightMeters } from '@/lib/platform-height';
import { getPlatformKind } from '@/lib/platform-kind';
import { isRetiredEquipmentSlug, RETIRED_MANGOTE_VIBRADOR_SLUGS } from '@/lib/equipment-retired-slugs';
import type { Equipment } from '@/types/equipment';

export type CatalogAuditIssue = {
  slug: string;
  name: string;
  code: CatalogAuditCode;
  detail: string;
};

export type CatalogAuditCode =
  | 'json_only'
  | 'slug_name_mismatch'
  | 'platform_missing_kind'
  | 'platform_missing_height'
  | 'retired_in_json'
  | 'featured_missing'
  | 'duplicate_slug'
  | 'available_thin_description';

export type CatalogAuditReport = {
  totalJson: number;
  totalDb: number | null;
  jsonOnlyCount: number;
  dbOnlyCount: number;
  issues: CatalogAuditIssue[];
  byCode: Record<CatalogAuditCode, CatalogAuditIssue[]>;
};

const KNOWN_SLUG_ALIASES: { slug: string; expectedInName: RegExp; note: string }[] = [
  {
    slug: 'plataforma-elevatoria-s80',
    expectedInName: /s-85|s85/i,
    note: 'Slug legado s80 aponta para Genie S-85 XC E',
  },
];

/**
 * Audits equipamentos.json (and optional Postgres slugs) for admin/catalog gaps.
 */
export function auditEquipmentCatalog(props: {
  items?: Equipment[];
  dbSlugs?: Set<string>;
}) {
  const items = props.items ?? (equipmentJson as Equipment[]);
  const dbSlugs = props.dbSlugs;
  const issues: CatalogAuditIssue[] = [];

  const slugCounts = new Map<string, number>();
  for (const item of items) {
    slugCounts.set(item.slug, (slugCounts.get(item.slug) ?? 0) + 1);
  }

  for (const item of items) {
    if ((slugCounts.get(item.slug) ?? 0) > 1) {
      issues.push({
        slug: item.slug,
        name: item.name,
        code: 'duplicate_slug',
        detail: 'Slug duplicado no JSON',
      });
    }

    if (isRetiredEquipmentSlug(item.slug)) {
      issues.push({
        slug: item.slug,
        name: item.name,
        code: 'retired_in_json',
        detail: 'Slug arquivado ainda presente no JSON',
      });
    }

    if (dbSlugs && !dbSlugs.has(item.slug) && item.available && !isRetiredEquipmentSlug(item.slug)) {
      issues.push({
        slug: item.slug,
        name: item.name,
        code: 'json_only',
        detail: 'Publicado no site via JSON, ausente do Postgres (não editável no painel)',
      });
    }

    const alias = KNOWN_SLUG_ALIASES.find((entry) => entry.slug === item.slug);
    if (alias && !alias.expectedInName.test(item.name)) {
      issues.push({
        slug: item.slug,
        name: item.name,
        code: 'slug_name_mismatch',
        detail: alias.note,
      });
    }

    if (item.category === 'plataformas-elevatorias' && item.available) {
      if (!getPlatformKind(item)) {
        issues.push({
          slug: item.slug,
          name: item.name,
          code: 'platform_missing_kind',
          detail: 'Sem classificação para filtro Tesoura/Articulada/Telescópica/Mastro vertical',
        });
      }
      if (getPlatformHeightMeters(item) === null) {
        issues.push({
          slug: item.slug,
          name: item.name,
          code: 'platform_missing_height',
          detail: 'Sem Altura de trabalho — some dos filtros de altura',
        });
      }
    }

    if (item.available && item.longDescription.trim().length < 80) {
      issues.push({
        slug: item.slug,
        name: item.name,
        code: 'available_thin_description',
        detail: 'Descrição longa vazia ou muito curta',
      });
    }
  }

  for (const slug of FEATURED_EQUIPMENT_SLUGS) {
    if (!items.some((item) => item.slug === slug)) {
      issues.push({
        slug,
        name: '—',
        code: 'featured_missing',
        detail: 'Destaque da home referencia slug inexistente no JSON',
      });
    }
  }

  let dbOnlyCount = 0;
  if (dbSlugs) {
    const jsonSlugs = new Set(items.map((item) => item.slug));
    for (const slug of dbSlugs) {
      if (!jsonSlugs.has(slug)) {
        dbOnlyCount += 1;
      }
    }
  }

  const byCode: Record<CatalogAuditCode, CatalogAuditIssue[]> = {
    json_only: [],
    slug_name_mismatch: [],
    platform_missing_kind: [],
    platform_missing_height: [],
    retired_in_json: [],
    featured_missing: [],
    duplicate_slug: [],
    available_thin_description: [],
  };

  for (const issue of issues) {
    byCode[issue.code].push(issue);
  }

  return {
    totalJson: items.length,
    totalDb: dbSlugs ? dbSlugs.size : null,
    jsonOnlyCount: byCode.json_only.length,
    dbOnlyCount,
    issues,
    byCode,
  } satisfies CatalogAuditReport;
}

/**
 * Formats audit report for CLI or logs.
 */
export function formatCatalogAuditReport(report: CatalogAuditReport) {
  const lines: string[] = [`JSON: ${report.totalJson} itens`];
  if (report.totalDb !== null) {
    lines.push(`Postgres: ${report.totalDb} slugs`);
    lines.push(`Só JSON (painel): ${report.jsonOnlyCount}`);
    lines.push(`Só Postgres: ${report.dbOnlyCount}`);
  }

  const sections: { code: CatalogAuditCode; title: string }[] = [
    { code: 'json_only', title: 'Só no site (JSON) — trazer para o painel' },
    { code: 'slug_name_mismatch', title: 'Slug legado ≠ nome/modelo' },
    { code: 'platform_missing_kind', title: 'Plataforma sem filtro de tipo' },
    { code: 'platform_missing_height', title: 'Plataforma sem altura de trabalho' },
    { code: 'retired_in_json', title: 'Slugs arquivados ainda no JSON' },
    { code: 'featured_missing', title: 'Destaques da home quebrados' },
    { code: 'available_thin_description', title: 'Descrição longa fraca' },
    { code: 'duplicate_slug', title: 'Slugs duplicados' },
  ];

  for (const section of sections) {
    const rows = report.byCode[section.code];
    if (!rows.length) {
      continue;
    }
    lines.push('');
    lines.push(`=== ${section.title} (${rows.length}) ===`);
    for (const row of rows) {
      lines.push(`- ${row.slug} | ${row.name}`);
      lines.push(`  ${row.detail}`);
    }
  }

  if (report.issues.length === 0) {
    lines.push('');
    lines.push('Nenhum problema encontrado.');
  }

  return lines.join('\n');
}

export { RETIRED_MANGOTE_VIBRADOR_SLUGS };
