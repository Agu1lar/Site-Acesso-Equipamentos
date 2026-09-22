import { existsSync, mkdirSync, cpSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

function loadDotEnv(envPath) {
  if (!existsSync(envPath)) {
    return;
  }
  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) {
      continue;
    }
    const eq = line.indexOf('=');
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadDotEnv(join(root, '.env'));

const vaultPath = process.env.OBSIDIAN_VAULT_PATH?.trim();
if (!vaultPath) {
  throw new Error('OBSIDIAN_VAULT_PATH is required');
}

const company = process.env.OBSIDIAN_COMPANY_FOLDER?.trim() || 'Acesso Equipamentos';
const destRoot = join(root, 'vault');
mkdirSync(destRoot, { recursive: true });

const folders = ['Comercial', 'Mecanica', 'Logistica'];
for (const folder of folders) {
  const from = join(vaultPath, company, folder);
  if (!existsSync(from)) {
    continue;
  }
  const to = join(destRoot, company, folder);
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log('[snapshot] copiou', folder);
}

console.log('[snapshot] pronto em', destRoot);
