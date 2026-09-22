import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type FleetKind = 'tesoura' | 'articulada' | 'lanca' | 'mastro' | 'andaime' | 'other';

export type FleetCatalogItem = {
  name: string;
  brands: string[];
  models: string[];
  aliases?: string[];
  kind?: FleetKind;
  heightM?: number;
  slug?: string;
  description?: string;
  specs?: Array<{ label: string; value: string }>;
};

export type FleetCatalogHit = {
  name: string;
  brands: string[];
  models: string[];
  score: number;
  kind: FleetKind;
  heightM?: number;
};

export type FleetCatalogFile = {
  items: FleetCatalogItem[];
};

export type FleetRecommendation = {
  status: 'recommended' | 'needs_details' | 'no_verified_match';
  item: FleetCatalogItem | null;
  evidence: string[];
};

const STOP = new Set([
  'a', 'o', 'os', 'as', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'um', 'uma',
  'para', 'pra', 'com', 'na', 'no', 'que', 'se', 'por', 'the', 'and',
  'boa', 'noite', 'tarde', 'dia', 'ola', 'oi', 'voce', 'voces',
  'tipo', 'tipos', 'qual', 'quais', 'meu', 'minha', 'seu', 'sua',
  'trabalham', 'trabalha', 'trabalhamos', 'preciso', 'queria', 'quero',
  'gostaria', 'sim', 'nao', 'aqui', 'ainda', 'estou', 'definindo',
  'fazer', 'municipio', 'contagem', 'belo', 'horizonte', 'altura',
  'metro', 'metros', 'dia', 'dias', 'semana', 'semanas', 'mes', 'meses',
  'locacao', 'locar', 'alugar', 'projeto', 'hoje',
]);

const FLEET_QUERY =
  /\b(trabalh|locam|loca\u00E7|\balug|voc[eê]s t[eê]m|voces tem|\btem\b|\bt[eê]m\b|equipament|plataforma|tesoura|articulada|andaime|betoneira|martelete|martelo|gerador|compacta|bomba|esmerilh|furadeira|serra|munck|manitou|genie|jlg|skyjack|placa vibrat|paleteira|compressor|franna|guindaste|guincho|grua|empilhadeira|retroescavadeira|escavadeira|trator|caminh[aã]o)/iu;

const EQUIPMENT_QUERY_TOKENS = new Set([
  'andaime', 'articulada', 'betoneira', 'bomba', 'compactador', 'compressor',
  'esmerilhadeira', 'furadeira', 'gerador', 'grua', 'guindaste', 'guincho',
  'manipulador', 'manitou', 'martelete', 'martelo', 'paleteira', 'plataforma',
  'serra', 'tesoura', 'empilhadeira', 'retroescavadeira', 'escavadeira', 'trator',
  'caminhao', 'munck',
]);

let cachedItems: FleetCatalogItem[] | null = null;
let cachedIndex: Map<string, number[]> | null = null;

/**
 * True when the turn should look up whether Acesso works with a machine type.
 */
export function shouldSearchFleetCatalog(text: string) {
  return FLEET_QUERY.test(text);
}

function fold(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function tokenize(text: string) {
  return fold(text)
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length >= 2 && !STOP.has(token));
}

function haystackOf(item: FleetCatalogItem) {
  return fold([
    item.name,
    ...item.brands,
    ...item.models,
    ...(item.aliases ?? []),
    ...kindAliases(item.kind ?? classifyKind(item.name)),
  ].join(' '));
}

function classifyKind(text: string): FleetKind {
  const t = fold(text);
  if (/andaime|tubo e bracadeira/.test(t) && !/plataforma elevat/.test(t)) {
    return 'andaime';
  }
  if (/tesoura/.test(t)) {
    return 'tesoura';
  }
  if (/articulada|\batj\b|z[\s-]*\d{2}/.test(t)) {
    return 'articulada';
  }
  if (/lan[cç]a|telescopic|\bs[\s-]*8[05]|\b1350\s*sjp/.test(t)) {
    return 'lanca';
  }
  if (/\bgs[\s-]*\d{3,4}\b|\bsj[\s-]*iii\b|\bhb[\s-]*p?\d|\bpep[\s-]*\d|hy-?brid/.test(t)) {
    return 'tesoura';
  }
  if (/\bawp\b|\bmvl\b|\bam[\s-]*36\b|mastro/.test(t)) {
    return 'mastro';
  }
  return 'other';
}

function kindAliases(kind: FleetKind) {
  if (kind === 'tesoura') {
    return ['tesoura', 'plataforma'];
  }
  if (kind === 'articulada') {
    return ['articulada', 'plataforma'];
  }
  if (kind === 'lanca') {
    return ['lanca', 'plataforma'];
  }
  if (kind === 'mastro') {
    return ['mastro', 'plataforma'];
  }
  if (kind === 'andaime') {
    return ['andaime'];
  }
  return [];
}

function kindLabel(kind: FleetKind) {
  if (kind === 'tesoura') {
    return 'plataforma tesoura';
  }
  if (kind === 'articulada') {
    return 'plataforma articulada';
  }
  if (kind === 'lanca') {
    return 'plataforma lança';
  }
  if (kind === 'mastro') {
    return 'plataforma mastro';
  }
  if (kind === 'andaime') {
    return 'andaime';
  }
  return 'equipamento';
}

function requestedFamily(query: string): FleetKind | null {
  const t = fold(query);
  if (/tesoura/.test(t)) {
    return 'tesoura';
  }
  if (/articulada/.test(t)) {
    return 'articulada';
  }
  if (/andaime/.test(t)) {
    return 'andaime';
  }
  if (/lan[cç]a|telescopic/.test(t)) {
    return 'lanca';
  }
  return null;
}

function familyWordsFrom(text: string) {
  const t = fold(text);
  const words: string[] = [];
  if (/tesoura/.test(t)) {
    words.push('tesoura');
  }
  if (/articulada/.test(t)) {
    words.push('articulada');
  }
  if (/lan[cç]a/.test(t)) {
    words.push('lanca');
  }
  if (/andaime/.test(t)) {
    words.push('andaime');
  }
  return words;
}

function parseHeightM(text: string) {
  const match = fold(text).match(/(\d+(?:[.,]\d+)?)\s*m\b/);
  if (!match?.[1]) {
    return undefined;
  }
  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) ? value : undefined;
}

function queryHeightM(query: string) {
  const match = fold(query).match(/(\d+(?:[.,]\d+)?)\s*(?:m|metros)\b/);
  if (!match?.[1]) {
    return undefined;
  }
  const value = Number(match[1].replace(',', '.'));
  return Number.isFinite(value) ? value : undefined;
}

function parseSiteHeightM(specs: Array<{ label?: string; value?: string }>) {
  const heights = specs
    .filter((spec) => /altura de trabalho/i.test(spec.label ?? ''))
    .map((spec) => parseHeightM(spec.value ?? ''))
    .filter((value): value is number => value !== undefined);
  if (heights.length === 0) {
    return undefined;
  }
  return Math.max(...heights);
}

function catalogPath() {
  return resolve(import.meta.dirname, '../data/fleet-catalog.json');
}

function siteCatalogPath() {
  return resolve(import.meta.dirname, '../../src/data/equipamentos.json');
}

function loadSiteEquipmentItems(): FleetCatalogItem[] {
  const path = siteCatalogPath();
  if (!existsSync(path)) {
    return [];
  }
  const rows = JSON.parse(readFileSync(path, 'utf8')) as Array<{
    slug?: string;
    name?: string;
    category?: string;
    tags?: string[];
    shortDescription?: string;
    available?: boolean;
    specs?: Array<{ label?: string; value?: string }>;
  }>;
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.flatMap((row) => {
    const name = row.name?.trim();
    if (!name || row.available === false) {
      return [];
    }
    const tipo = row.specs?.find((spec) => /^tipo$/i.test(spec.label ?? ''))?.value ?? '';
    const aliases = [
      (row.category ?? '').replaceAll('-', ' '),
      tipo,
      ...(Array.isArray(row.tags) ? row.tags : []),
      row.shortDescription ?? '',
      ...(row.specs ?? []).flatMap((spec) => [spec.label ?? '', spec.value ?? '']),
      ...familyWordsFrom(`${row.shortDescription ?? ''} ${tipo}`),
    ].filter((value) => value.trim().length > 0);
    const hay = [name, ...aliases].join(' ');
    return [{
      name,
      brands: [],
      models: [],
      aliases,
      kind: classifyKind(hay),
      heightM: parseSiteHeightM(row.specs ?? []),
      slug: row.slug,
      description: row.shortDescription,
      specs: (row.specs ?? []).flatMap((spec) =>
        spec.label?.trim() && spec.value?.trim()
          ? [{ label: spec.label.trim(), value: spec.value.trim() }]
          : []),
    }];
  });
}

function mergeCatalogItems(left: FleetCatalogItem[], right: FleetCatalogItem[]) {
  const byKey = new Map<string, FleetCatalogItem>();
  for (const item of [...left, ...right]) {
    const key = fold(item.name);
    const prior = byKey.get(key);
    if (!prior) {
      byKey.set(key, { ...item, aliases: item.aliases ?? [] });
      continue;
    }
    byKey.set(key, {
      name: prior.name.length >= item.name.length ? prior.name : item.name,
      brands: [...new Set([...prior.brands, ...item.brands])],
      models: [...new Set([...prior.models, ...item.models])],
      aliases: [...new Set([...(prior.aliases ?? []), ...(item.aliases ?? [])])],
      kind: prior.kind && prior.kind !== 'other' ? prior.kind : item.kind,
      heightM: prior.heightM ?? item.heightM,
      slug: prior.slug ?? item.slug,
      description: prior.description ?? item.description,
      specs: prior.specs ?? item.specs,
    });
  }
  return [...byKey.values()];
}

/**
 * Loads patrimônio types plus the public site catalog. Status and quantity stay out.
 */
export function loadFleetCatalog(path = catalogPath()): FleetCatalogItem[] {
  if (cachedItems && path === catalogPath()) {
    return cachedItems;
  }
  let fromFile: FleetCatalogItem[] = [];
  if (existsSync(path)) {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as FleetCatalogFile;
    fromFile = Array.isArray(parsed.items) ? parsed.items : [];
  }
  const items = path === catalogPath()
    ? mergeCatalogItems(fromFile, loadSiteEquipmentItems()).map((item) => ({
      ...item,
      kind: item.kind && item.kind !== 'other' ? item.kind : classifyKind([item.name, ...(item.aliases ?? [])].join(' ')),
    }))
    : fromFile;
  if (path === catalogPath()) {
    cachedItems = items;
    cachedIndex = null;
  }
  return items;
}

function tokenIndex(items: FleetCatalogItem[]) {
  if (cachedIndex && items === cachedItems) {
    return cachedIndex;
  }
  const index = new Map<string, number[]>();
  for (const [offset, item] of items.entries()) {
    const seen = new Set<string>();
    for (const token of tokenize(haystackOf(item))) {
      if (seen.has(token)) {
        continue;
      }
      seen.add(token);
      const bucket = index.get(token);
      if (bucket) {
        bucket.push(offset);
      } else {
        index.set(token, [offset]);
      }
    }
  }
  if (items === cachedItems) {
    cachedIndex = index;
  }
  return index;
}

function tokenMatchesTerm(token: string, term: string) {
  if (token === term) {
    return true;
  }
  if (term.length >= 4 && token.includes(term)) {
    return true;
  }
  if (token.length >= 4 && term.includes(token)) {
    return true;
  }
  return false;
}

function familyBoost(item: FleetCatalogItem, family: FleetKind | null, wantHeight?: number) {
  let extra = 0;
  const kind = item.kind ?? classifyKind(item.name);
  if (family && kind === family) {
    extra += 80;
  }
  const nameFold = fold(item.name);
  if (family === 'andaime' && nameFold.includes('andaime')) {
    extra += 60;
  }
  if (family === 'andaime' && nameFold.includes('tubo e bracadeira')) {
    extra += 40;
  }
  if (wantHeight !== undefined && item.heightM !== undefined) {
    extra += Math.max(0, 40 - Math.abs(item.heightM - wantHeight) * 4);
  }
  return extra;
}

function candidateOffsets(items: FleetCatalogItem[], terms: string[]) {
  const index = tokenIndex(items);
  const counts = new Map<number, number>();
  for (const term of terms) {
    const seen = new Set<number>();
    for (const [token, offsets] of index) {
      if (!tokenMatchesTerm(token, term)) {
        continue;
      }
      for (const offset of offsets) {
        if (seen.has(offset)) {
          continue;
        }
        seen.add(offset);
        counts.set(offset, (counts.get(offset) ?? 0) + 1);
      }
    }
  }
  return counts;
}

/**
 * Returns a few matching types. Never dumps the full patrimônio list.
 */
export function searchFleetCatalog(options: {
  query: string;
  items?: FleetCatalogItem[];
  maxHits?: number;
}): FleetCatalogHit[] {
  const items = options.items ?? loadFleetCatalog();
  const terms = tokenize(options.query);
  if (items.length === 0 || terms.length === 0) {
    return [];
  }
  const maxHits = options.maxHits ?? 5;
  const queryFold = fold(options.query);
  const requestedEquipmentTokens = terms.filter((term) => EQUIPMENT_QUERY_TOKENS.has(term));
  const family = requestedFamily(options.query);
  const wantHeight = queryHeightM(options.query);
  const scored: FleetCatalogHit[] = [];

  for (const [offset, termHits] of candidateOffsets(items, terms)) {
    const item = items[offset];
    if (!item) {
      continue;
    }
    const hay = haystackOf(item);
    const nameFold = fold(item.name);
    const kind = item.kind ?? classifyKind(item.name);
    let score = termHits * 10 + familyBoost(item, family, wantHeight);
    const itemTokens = new Set(tokenize(hay));
    if (requestedEquipmentTokens.some((term) => itemTokens.has(term))) {
      score += 120;
    }
    if (hay.includes(queryFold.trim())) {
      score += 40;
    }
    if (nameFold.startsWith(queryFold.trim())) {
      score += 20;
    }
    if (score <= 0) {
      continue;
    }
    scored.push({
      name: item.name,
      brands: item.brands,
      models: item.models,
      score,
      kind,
      heightM: item.heightM,
    });
  }

  const ranked = scored
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, 'pt-BR'));
  let picked = family ? ranked.filter((hit) => hit.kind === family) : ranked;
  if (family === 'andaime' && !/escada|painel|piso|sapata|abracadeira|guarda/u.test(queryFold)) {
    const parent = picked.filter((hit) => /tubo e bra|andaime tipo/u.test(fold(hit.name)));
    picked = parent.length > 0 ? parent : picked.filter((hit) => /andaime/u.test(fold(hit.name)));
  }
  const limit = /diaria|quanto custa|qual o valor/u.test(queryFold) ? Math.min(maxHits, 2) : maxHits;
  return picked.slice(0, limit);
}

/**
 * Compact retrieval block for the attendance prompt. No stock, no counts.
 */
export function formatFleetCatalogHits(hits: FleetCatalogHit[]) {
  if (hits.length === 0) {
    return [
      'Catálogo interno (patrimônio + o que está no site). Não confirma disponibilidade.',
      'Nenhum tipo com esse nome no índice. Se o pedido for fora da frota (caminhão, carro, máquina que não locamos), diga que não locamos. Se o nome estiver incompleto (ex.: só “plataforma”), peça tesoura/articulada/modelo. Não invente frota.',
    ].join('\n');
  }
  const lines = hits.map((hit) => {
    const extra = [...hit.brands.slice(0, 2), ...hit.models.slice(0, 2)].filter(Boolean);
    const height = hit.heightM ? ` (~${String(hit.heightM).replace('.', ',')} m de trabalho)` : '';
    const hint = extra.length > 0 ? ` (${extra.join(', ')})` : '';
    return `- ${kindLabel(hit.kind)}: ${hit.name}${height}${hint}`;
  });
  return [
    'Catálogo interno (patrimônio + site). Confirme a linha. Não despeje a lista nem cite peça (escada, abraçadeira) se o cliente só pediu o tipo. Nunca negue um tipo desta lista. Não invente alumínio, tubular ou fachadeiro. Não confirme estoque.',
    ...lines,
  ].join('\n');
}

/**
 * Searches the catalog using the whole user thread so later turns still see the type.
 */
export function retrievedFleetBlock(texts: string[]) {
  const query = texts.map((text) => text.trim()).filter(Boolean).join('\n');
  if (!shouldSearchFleetCatalog(query)) {
    return '';
  }
  const block = formatFleetCatalogHits(searchFleetCatalog({ query }));
  const requested = [...new Set(tokenize(query).filter((term) => EQUIPMENT_QUERY_TOKENS.has(term)))];
  const unsupported = requested.filter((term) => searchFleetCatalog({ query: term, maxHits: 1 }).length === 0);
  if (unsupported.length === 0) {
    return block;
  }
  return `${block}\nTipos pedidos fora do catálogo: ${unsupported.join(', ')}. Diga que não locamos cada um deles; não ofereça alternativa nem diga que vai confirmar.`;
}

const RECOMMENDATION_ASK = /\b(recomend|indic|qual (?:equipamento|m[aá]quina)|o que (?:usar|alugar|locar)|serve para|preciso (?:de )?(?:algo|equipamento).{0,40}para)\b/iu;
const MATERIAL_LOAD = /\b(carga|material|palete|pallet|máquina|maquina|estrutura|transformador|gerador|i[cç]amento)\b/iu;

function requestedCapacityKg(text: string) {
  const folded = fold(text);
  const tonne = folded.match(/(\d+(?:[.,]\d+)?)\s*(?:t|ton|tons|tonelada|toneladas)\b/);
  const kilograms = folded.match(/(\d+(?:[.,]\d+)?)\s*kg\b/);
  const raw = tonne?.[1] ?? kilograms?.[1];
  if (!raw) {
    return undefined;
  }
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return tonne ? value * 1000 : value;
}

function itemCapacityKg(item: FleetCatalogItem) {
  const capacity = item.specs?.find((spec) => /capacidade|carga atendida/iu.test(spec.label));
  if (!capacity) {
    return undefined;
  }
  return requestedCapacityKg(capacity.value);
}

function recommendationEvidence(item: FleetCatalogItem) {
  return (item.specs ?? [])
    .filter((spec) => /aplica[cç][aã]o|uso indicado|altura de trabalho|capacidade|alimenta[cç][aã]o|tipo/iu.test(spec.label))
    .slice(0, 3)
    .map((spec) => `${spec.label}: ${spec.value}`);
}

/**
 * Recommends only when catalog specifications prove the fit. Unknown capacity or
 * height never becomes an inferred recommendation.
 */
export function recommendFleetEquipment(options: {
  query: string;
  items?: FleetCatalogItem[];
}): FleetRecommendation | null {
  if (!RECOMMENDATION_ASK.test(options.query)) {
    return null;
  }
  const items = options.items ?? loadFleetCatalog();
  const wantedHeight = queryHeightM(options.query);
  const wantedCapacity = requestedCapacityKg(options.query);
  const materialLoad = MATERIAL_LOAD.test(options.query);
  const needTerms = tokenize(options.query).filter((term) => !EQUIPMENT_QUERY_TOKENS.has(term));
  if (needTerms.length === 0 && wantedHeight === undefined && wantedCapacity === undefined) {
    return { status: 'needs_details', item: null, evidence: [] };
  }

  const ranked = items.flatMap((item) => {
    const haystack = haystackOf(item);
    const kind = item.kind ?? classifyKind(item.name);
    if (materialLoad && kind !== 'other' && kind !== 'andaime') {
      return [];
    }
    if (wantedHeight !== undefined && (item.heightM === undefined || item.heightM < wantedHeight)) {
      return [];
    }
    const capacity = itemCapacityKg(item);
    if (wantedCapacity !== undefined && (capacity === undefined || capacity < wantedCapacity)) {
      return [];
    }
    const matches = needTerms.filter((term) => tokenMatchesTerm(term, haystack)).length;
    if (matches === 0 && wantedHeight === undefined && wantedCapacity === undefined) {
      return [];
    }
    const constraintScore = (wantedHeight === undefined ? 0 : 80)
      + (wantedCapacity === undefined ? 0 : 120);
    return [{ item, score: matches * 15 + constraintScore }];
  }).sort((left, right) => right.score - left.score || left.item.name.localeCompare(right.item.name, 'pt-BR'));

  const best = ranked[0]?.item ?? null;
  if (!best) {
    return { status: 'no_verified_match', item: null, evidence: [] };
  }
  return { status: 'recommended', item: best, evidence: recommendationEvidence(best) };
}

/** Formats a recommendation without availability, quantity or invented specs. */
export function formatFleetRecommendation(recommendation: FleetRecommendation) {
  if (recommendation.status === 'needs_details') {
    return 'Não tenho especificações suficientes para indicar um equipamento com segurança. Informe o serviço, a altura e, se houver carga, o peso.';
  }
  if (recommendation.status === 'no_verified_match' || !recommendation.item) {
    return 'Não encontrei no catálogo um equipamento cujas especificações confirmem essa necessidade. O comercial pode avaliar o caso no horário útil, sem promessa de disponibilidade.';
  }
  const evidence = recommendation.evidence.length > 0
    ? ` (${recommendation.evidence.join('; ')})`
    : '';
  return `Pelas especificações do catálogo, a indicação técnica é ${recommendation.item.name}${evidence}. Isso não confirma estoque nem disponibilidade.`;
}
