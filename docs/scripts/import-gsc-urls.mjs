#!/usr/bin/env node
/**
 * Reads a Google Search Console Pages export (CSV) and reports redirect gaps.
 *
 * Usage:
 *   node docs/scripts/import-gsc-urls.mjs caminho/para/gsc-pages.csv
 *
 * Export no GSC: Performance > Resultados da pesquisa > Páginas > Exportar (CSV).
 * Cole entradas faltantes em src/data/legacy-redirects.json (campo source/destination).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const redirectsPath = path.join(root, 'src/data/legacy-redirects.json');
const gscPath = path.join(root, 'src/data/gsc-top-urls.json');

const csvFile = process.argv[2];
if (!csvFile) {
  console.error('Informe o CSV exportado do GSC. Ex.: node docs/scripts/import-gsc-urls.mjs ./gsc-pages.csv');
  process.exit(1);
}

const redirects = JSON.parse(fs.readFileSync(redirectsPath, 'utf8'));
const exact = new Set(redirects.redirects.map((entry) => normalize(entry.source)));
const prefixes = redirects.prefixRedirects.map((entry) => normalize(entry.sourcePrefix));

function normalize(pathname) {
  const lower = pathname.toLowerCase();
  if (lower.length > 1 && lower.endsWith('/')) {
    return lower.slice(0, -1);
  }
  return lower;
}

function extractPath(value) {
  const trimmed = value.trim().replace(/^\"|\"$/g, '');
  if (!trimmed || trimmed === 'Top pages' || trimmed === 'Páginas principais') return '';
  if (trimmed.startsWith('http')) {
    return normalize(new URL(trimmed).pathname);
  }
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return normalize(withSlash.split('?')[0]?.split('#')[0] ?? withSlash);
}

function hasRedirect(pathname) {
  if (pathname === '/') return true;
  if (exact.has(pathname)) return true;
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function suggestDestination(pathname) {
  if (pathname.includes('guindaste') || pathname.includes('munck') || pathname.includes('manipulador')) {
    return '/equipamentos/guindaste-industrial-munck-remocao-bh';
  }
  if (pathname.includes('plataforma') || pathname.includes('elevatoria')) {
    return '/categorias/equipamentos-aereos';
  }
  if (pathname.includes('andaime')) return '/categorias/andaimes-acesso';
  if (pathname.includes('compactador')) return '/categorias/compactacao';
  if (pathname.includes('gerador')) return '/categorias/energia';
  if (pathname.includes('martelete')) return '/categorias/demolicao-perfuracao';
  if (pathname.includes('privacidade') || pathname.includes('cookies')) return '/privacidade';
  if (pathname.includes('blog') || pathname.includes('web-stories')) return '/dicas';
  if (pathname.startsWith('/page/')) return '/dicas';
  return '/equipamentos';
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

const raw = fs.readFileSync(path.resolve(csvFile), 'utf8');
const lines = raw.split(/\r?\n/u).filter(Boolean);
const rows = [];

for (const line of lines.slice(1)) {
  const cells = parseCsvLine(line);
  const page = extractPath(cells[0] ?? '');
  const clicks = Number.parseInt((cells[1] ?? '0').replace(/\D/g, ''), 10) || 0;
  if (!page) continue;
  rows.push({ path: page, clicks });
}

rows.sort((a, b) => b.clicks - a.clicks);

const missing = rows.filter((row) => !hasRedirect(row.path));
const coverage = rows.length
  ? Math.round(((rows.length - missing.length) / rows.length) * 100)
  : 100;

const gscData = {
  updatedAt: new Date().toISOString().slice(0, 10),
  source: `Importado de ${path.basename(csvFile)}`,
  urls: rows.map((row) => ({
    path: row.path,
    clicks: row.clicks,
    coveredByRedirect: hasRedirect(row.path),
  })),
};

fs.writeFileSync(gscPath, `${JSON.stringify(gscData, null, 2)}\n`);

console.log(`URLs no CSV: ${rows.length}`);
console.log(`Cobertura de redirects: ${coverage}%`);
console.log(`Faltando: ${missing.length}`);

if (missing.length) {
  console.log('\nSugestões para legacy-redirects.json:\n');
  for (const row of missing) {
    const destination = suggestDestination(row.path);
    console.log(JSON.stringify({
      source: row.path,
      destination,
      note: `GSC ${row.clicks} cliques — revisar destino antes de commitar`,
    }, null, 2));
    console.log('');
  }
}
