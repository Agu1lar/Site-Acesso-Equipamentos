#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const secret = `acesso_internal_${randomBytes(24).toString('hex')}`;

const localEnv = readFileSync(resolve(root, '.env.local'), 'utf8');
const match = localEnv.match(/^ANTHROPIC_API_KEY=(.+)$/m);
if (!match?.[1]) {
  console.error('ANTHROPIC_API_KEY missing in .env.local');
  process.exit(1);
}

const anthropic = match[1].trim().replace(/^["']|["']$/g, '');
if (anthropic.length < 20 || !anthropic.startsWith('sk-ant-')) {
  console.error('Invalid ANTHROPIC_API_KEY in .env.local');
  process.exit(1);
}

const envBody = [
  'CHATPRO_LOCAL_API_URL=https://acessoequipamentos.com.br',
  `INTERNAL_API_SECRET=${secret}`,
  'CHATPRO_LOCAL_SQLITE_PATH=./data/chatpro-local.db',
  'CHATPRO_LOCAL_POLL_MS=30000',
  'CHATPRO_LOCAL_DEBOUNCE_MS=60000',
  `ANTHROPIC_API_KEY=${anthropic}`,
  'ANTHROPIC_MODEL=claude-haiku-4-5-20251001',
  '',
].join('\n');

writeFileSync(resolve(root, 'chatpro-local', '.env'), envBody, 'utf8');
writeFileSync(resolve(root, '.tmp-internal-secret.txt'), secret, 'utf8');

// Keep local tooling in sync (without printing secret).
let nextLocal = localEnv;
if (/^INTERNAL_API_SECRET=/m.test(nextLocal)) {
  nextLocal = nextLocal.replace(/^INTERNAL_API_SECRET=.*$/m, `INTERNAL_API_SECRET=${secret}`);
} else {
  nextLocal = `${nextLocal.trimEnd()}\nINTERNAL_API_SECRET=${secret}\n`;
}
writeFileSync(resolve(root, '.env.local'), nextLocal, 'utf8');

console.log('[setup] chatpro-local/.env written');
console.log('[setup] .env.local INTERNAL_API_SECRET updated');
console.log('[setup] anthropicSuffix', anthropic.slice(-4));
console.log('[setup] internalSecretLen', secret.length);
