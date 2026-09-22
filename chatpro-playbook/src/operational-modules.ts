import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { AttendanceTeam } from './attendance-team.js';
import { scrubTriageCopy } from './schema.js';

export const MODULE_TIPO = 'modulo-operacional';
const AI_FONTES = new Set(['chatpro-playbook']);
const AI_TIPOS = new Set([MODULE_TIPO, 'conhecimento-mecanica', 'playbook-comercial', 'playbook-logistica', 'playbook-mecanica']);
const PROTECTED_NAMES = new Set([
  'Notas humanas.md',
  'Inbox recente.md',
  'Follow-up.md',
  'Indice.md',
]);
const PROTECTED_DIRS = new Set(['Manuais', 'Clientes']);

/** Modules that teach the night bot to ask CNPJ, quote tables or invite a call. */
export const TRIAGE_UNSAFE_MODULE_IDS = [
  'qualificacao-pf-pj',
  'clareza-frete-composicao',
  'apresentacao-proposta-consultiva',
  'followup-pos-proposta',
];

const BOT_SAY_HEADING = '## O que o bot pode dizer';
const BOT_SAY_BODY =
  'Confirmar se trabalhamos com o tipo. Pedir só o que faltar: cidade da obra e para quando começa a locação (e por quantos dias se ainda não veio). Dizer que a mensagem já chegou e o comercial retorna de segunda a sexta, 7h30–17h15. Sem valor, frete, estoque, PF/PJ, CNPJ, emoji nem convite para ligar agora.';

export type OperationalModule = {
  id: string;
  title: string;
  path: string;
  relative: string;
  body: string;
  protected: boolean;
};

export type ModuleUpsert = {
  id: string;
  title: string;
  body: string;
  reason: string;
};

export type ModuleRemoval = {
  id: string;
  reason: string;
};

export type ModulePlan = {
  upsert: ModuleUpsert[];
  remove: ModuleRemoval[];
};

export type ApplyModulesResult = {
  created: string[];
  updated: string[];
  deleted: string[];
  skipped: string[];
};

/**
 * Stable id for an operational module filename or title.
 */
export function slugifyModuleId(value: string) {
  const slug = value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 60);
  return slug || 'modulo';
}

function parseFrontmatter(body: string) {
  const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---/u);
  if (!match?.[1]) {
    return {} as Record<string, string>;
  }
  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/u)) {
    const eq = line.indexOf(':');
    if (eq <= 0) {
      continue;
    }
    fields[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return fields;
}

function isProtectedRelative(relative: string) {
  const parts = relative.split(/[\\/]/u);
  if (parts.some((part) => PROTECTED_DIRS.has(part))) {
    return true;
  }
  const name = parts.at(-1) ?? '';
  return PROTECTED_NAMES.has(name) || name.startsWith('_meta-');
}

/**
 * True when the note is owned by the training worker and may be rewritten or removed.
 */
export function isAiOwnedModule(body: string, relative: string) {
  if (isProtectedRelative(relative)) {
    return false;
  }
  const meta = parseFrontmatter(body);
  if (meta.protegido === 'true') {
    return false;
  }
  const fonte = meta.fonte;
  const tipo = meta.tipo;
  return Boolean(
    fonte
    && tipo
    && AI_FONTES.has(fonte)
    && (AI_TIPOS.has(tipo) || tipo === MODULE_TIPO),
  );
}

function walkMarkdown(dir: string, prefix: string, acc: string[] = []) {
  if (!existsSync(dir)) {
    return acc;
  }
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const relative = prefix ? `${prefix}/${name}` : name;
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (PROTECTED_DIRS.has(name) || name === 'Clientes') {
        continue;
      }
      walkMarkdown(path, relative, acc);
      continue;
    }
    if (name.endsWith('.md')) {
      acc.push(relative);
    }
  }
  return acc;
}

/**
 * Lists living operational notes the trainer may edit or drop.
 */
export function listOperationalModules(options: {
  vaultPath: string;
  folder: string;
}): OperationalModule[] {
  const root = join(options.vaultPath, ...options.folder.split(/[\\/]/u));
  const modules: OperationalModule[] = [];
  for (const relative of walkMarkdown(root, '')) {
    if (!/^(Modulos|Conhecimento)\//u.test(relative) || relative === 'Modulos/Indice.md' || relative === 'Modulos/_seed-ok.md') {
      continue;
    }
    const path = join(root, ...relative.split(/[\\/]/u));
    const body = readFileSync(path, 'utf8');
    const meta = parseFrontmatter(body);
    const title = meta.title || relative.replace(/\.md$/u, '');
    const id = slugifyModuleId(meta.id || title);
    modules.push({
      id,
      title,
      path,
      relative,
      body,
      protected: !isAiOwnedModule(body, relative),
    });
  }
  return modules;
}

function renderModuleNote(options: {
  id: string;
  title: string;
  body: string;
  reason: string;
  team: AttendanceTeam;
  now: Date;
}) {
  const heading = `# ${options.title}`;
  const content = options.body
    .replace(/^---[\s\S]*?---\s*/u, '')
    .replace(new RegExp(`^(?:${heading.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\n+)+`, 'u'), '')
    .trim();
  return [
    '---',
    `title: ${options.title}`,
    `tipo: ${MODULE_TIPO}`,
    `id: ${options.id}`,
    `equipe: ${options.team}`,
    `gerado: ${options.now.toISOString()}`,
    'fonte: chatpro-playbook',
    `motivo: ${options.reason.slice(0, 180)}`,
    'protegido: false',
    '---',
    '',
    heading,
    '',
    content,
    '',
  ].join('\n');
}

function findModule(modules: OperationalModule[], id: string) {
  return modules.find((module) => module.id === id || slugifyModuleId(module.title) === id) ?? null;
}

/**
 * Drops path tricks and empty bodies from a trainer plan.
 */
function dedupeModuleHeading(body: string, title: string) {
  const heading = `# ${title.trim()}`;
  const lines = body.replace(/^\uFEFF/u, '').split(/\r?\n/u);
  let seen = false;
  const next: string[] = [];
  for (const line of lines) {
    if (line.trim() === heading) {
      if (seen) {
        continue;
      }
      seen = true;
    }
    next.push(line);
  }
  return next.join('\n').replace(/\n{3,}/gu, '\n\n').trim();
}

function rewriteBotCanSay(body: string) {
  if (!body.includes(BOT_SAY_HEADING)) {
    return `${body.trim()}\n\n${BOT_SAY_HEADING}\n${BOT_SAY_BODY}\n`;
  }
  return body.replace(
    /## O que o bot pode dizer\n[\s\S]*?(?=\n## |\s*$)/u,
    `${BOT_SAY_HEADING}\n${BOT_SAY_BODY}\n`,
  );
}

/**
 * Makes a module body safe for vault search used by the night bot.
 */
export function sanitizeModuleBody(body: string, title = '') {
  const stripped = scrubTriageCopy(body);
  const withoutDup = title ? dedupeModuleHeading(stripped, title) : stripped;
  return rewriteBotCanSay(withoutDup).trim();
}

/**
 * Drops path tricks and empty bodies from a trainer plan.
 */
export function sanitizeModulePlan(plan: ModulePlan): ModulePlan {
  const upsert = plan.upsert
    .map((item) => ({
      id: slugifyModuleId(item.id || item.title),
      title: item.title.trim().slice(0, 80) || 'Módulo',
      body: sanitizeModuleBody(item.body.trim(), item.title.trim()).slice(0, 4000),
      reason: item.reason.trim().slice(0, 240) || 'fluxo observado no treino',
    }))
    .filter((item) => item.body.length >= 40 && !TRIAGE_UNSAFE_MODULE_IDS.includes(item.id))
    .slice(0, 8);
  const seen = new Set(upsert.map((item) => item.id));
  const requestedRemove = plan.remove
    .map((item) => ({
      id: slugifyModuleId(item.id),
      reason: item.reason.trim().slice(0, 240) || 'não reflete mais o fluxo',
    }))
    .filter((item) => item.id && !seen.has(item.id));
  const unsafeRemove = TRIAGE_UNSAFE_MODULE_IDS
    .filter((id) => !seen.has(id))
    .map((id) => ({ id, reason: 'contradiz a triagem noturna das notas humanas' }));
  const remove = [...requestedRemove, ...unsafeRemove]
    .filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index)
    .slice(0, 8);
  return { upsert, remove };
}

function writeModuleIndex(options: {
  root: string;
  modules: OperationalModule[];
  team: AttendanceTeam;
  now: Date;
}) {
  const dir = join(options.root, 'Modulos');
  mkdirSync(dir, { recursive: true });
  const lines = options.modules.length === 0
    ? ['Nenhum módulo vivo ainda. O treino cria e apaga conforme o fluxo das conversas.']
    : options.modules.map((module) => `- [[${module.relative.replace(/\.md$/u, '')}|${module.title}]]`);
  writeFileSync(
    join(dir, 'Indice.md'),
    [
      '---',
      'title: Módulos operacionais',
      `tipo: ${MODULE_TIPO}`,
      `equipe: ${options.team}`,
      `gerado: ${options.now.toISOString()}`,
      'fonte: chatpro-playbook',
      '---',
      '',
      '# Módulos operacionais',
      '',
      'A IA **cria, edita e apaga** estes módulos quando o treino (conversas da ChatPro) mostra outro fluxo. `Notas humanas` e `Manuais/` não entram aqui.',
      '',
      ...lines,
      '',
    ].join('\n'),
    'utf8',
  );
}

/**
 * Applies a trainer plan: create/edit/delete only AI-owned module notes.
 */
export function applyOperationalModules(options: {
  vaultPath: string;
  folder: string;
  team: AttendanceTeam;
  plan: ModulePlan;
  now?: Date;
}): ApplyModulesResult {
  const now = options.now ?? new Date();
  const root = join(options.vaultPath, ...options.folder.split(/[\\/]/u));
  mkdirSync(join(root, 'Modulos'), { recursive: true });
  const plan = sanitizeModulePlan(options.plan);
  const result: ApplyModulesResult = { created: [], updated: [], deleted: [], skipped: [] };

  for (const item of plan.upsert) {
    const current = listOperationalModules({ vaultPath: options.vaultPath, folder: options.folder });
    const existing = findModule(current, item.id);
    if (existing?.protected) {
      result.skipped.push(item.id);
      continue;
    }
    const contentKey = `${item.title}\n${item.body.replace(/^---[\s\S]*?---\s*/u, '').trim()}`;
    const existingKey = existing
      ? `${existing.title}\n${existing.body.replace(/^---[\s\S]*?---\s*/u, '').replace(/^# .+\n+/u, '').trim()}`
      : null;
    if (existing && existingKey === contentKey) {
      result.skipped.push(item.id);
      continue;
    }
    const relative = existing?.relative ?? `Modulos/${item.id}.md`;
    const path = join(root, ...relative.split(/[\\/]/u));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, renderModuleNote({
      id: item.id,
      title: item.title,
      body: item.body,
      reason: item.reason,
      team: options.team,
      now,
    }), 'utf8');
    if (existing) {
      result.updated.push(relative);
    } else {
      result.created.push(relative);
    }
  }

  for (const item of plan.remove) {
    const current = listOperationalModules({ vaultPath: options.vaultPath, folder: options.folder });
    const existing = findModule(current, item.id);
    if (!existing) {
      result.skipped.push(item.id);
      continue;
    }
    if (existing.protected || !isAiOwnedModule(existing.body, existing.relative)) {
      result.skipped.push(existing.relative);
      continue;
    }
    unlinkSync(existing.path);
    result.deleted.push(existing.relative);
  }

  if (result.created.length + result.updated.length + result.deleted.length === 0) {
    return result;
  }

  const living = listOperationalModules({ vaultPath: options.vaultPath, folder: options.folder })
    .filter((module) => !module.protected);
  writeModuleIndex({ root, modules: living, team: options.team, now });

  return result;
}
