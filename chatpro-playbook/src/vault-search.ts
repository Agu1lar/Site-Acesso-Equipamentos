import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const STOP = new Set([
  'a', 'o', 'os', 'as', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'um', 'uma',
  'para', 'com', 'na', 'no', 'que', 'se', 'por', 'the', 'and',
]);

export const MECHANIC_QUERY =
  /\b(quebr|defeito|manuten|chamado|n[aã]o (sobe|desce|liga|pega|abaixa)|vazamento|hidr[aá]ulic|gaiola|andaime|plataforma|tesoura|articulada|martelete|betoneira|esmerilh|gerador|combust[aã]o|motor|el[eé]tric)/iu;

const ATTENDANCE_MODULE_QUERY =
  /\b(loca[cç]|alug|or[cç]ament|frete|obra|fachada|proposta|follow|cnpj|pessoa f[ií]sica|andaime|plataforma|tesoura|articulada|betoneira|martelete)/iu;

/**
 * True when the user turn should retrieve mechanic notes from the vault.
 */
export function shouldSearchMechanicKnowledge(text: string) {
  return MECHANIC_QUERY.test(text);
}

/**
 * True when the turn should retrieve trained attendance modules.
 */
export function shouldSearchAttendanceModules(text: string) {
  const compact = text.replace(/\s+/gu, ' ').trim();
  return compact.length >= 12 || ATTENDANCE_MODULE_QUERY.test(compact) || shouldSearchMechanicKnowledge(compact);
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length >= 3 && !STOP.has(token));
}

function listMarkdownFiles(dir: string, acc: string[] = []) {
  if (!existsSync(dir)) {
    return acc;
  }
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      listMarkdownFiles(path, acc);
      continue;
    }
    if (name.endsWith('.md')) {
      acc.push(path);
    }
  }
  return acc;
}

export type VaultSearchHit = {
  path: string;
  title: string;
  score: number;
  excerpt: string;
};

/**
 * Scores vault markdown against a query and returns the best excerpts.
 */
export function searchVaultKnowledge(options: {
  vaultPath: string;
  roots: string[];
  query: string;
  maxHits?: number;
  excerptChars?: number;
}) {
  const terms = tokenize(options.query);
  if (terms.length === 0) {
    return [];
  }
  const maxHits = options.maxHits ?? 3;
  const excerptChars = options.excerptChars ?? 1_400;
  const hits: VaultSearchHit[] = [];

  for (const root of options.roots) {
    const dir = join(options.vaultPath, ...root.split(/[\\/]/u));
    for (const path of listMarkdownFiles(dir)) {
      const body = readFileSync(path, 'utf8');
      const haystack = tokenize(body);
      if (haystack.length === 0) {
        continue;
      }
      let score = 0;
      for (const term of terms) {
        score += haystack.filter((token) => token === term || token.includes(term)).length;
      }
      if (score <= 0) {
        continue;
      }
      const title = body.match(/^title:\s*(.+)$/mu)?.[1]?.trim()
        ?? body.match(/^#\s+(.+)$/mu)?.[1]?.trim()
        ?? path.split(/[\\/]/u).at(-1)
        ?? 'nota';
      hits.push({
        path,
        title,
        score,
        excerpt: body.replace(/^---[\s\S]*?---\s*/u, '').trim().slice(0, excerptChars),
      });
    }
  }

  return hits
    .sort((left, right) => right.score - left.score)
    .slice(0, maxHits);
}

/**
 * Formats search hits for the attendance prompt.
 */
export function formatVaultSearchHits(hits: VaultSearchHit[], maxChars = 4_500) {
  const parts: string[] = [];
  let used = 0;
  for (const hit of hits) {
    const block = `## ${hit.title}\n${hit.excerpt}`;
    if (used + block.length > maxChars) {
      break;
    }
    parts.push(block);
    used += block.length;
  }
  return parts.join('\n\n');
}
