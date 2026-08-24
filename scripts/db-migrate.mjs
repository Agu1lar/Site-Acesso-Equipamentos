#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const { Client } = pg;

function normalizeDatabaseUrlForMigration(value) {
  if (!value) {
    return '';
  }

  try {
    const url = new URL(value);
    const sslMode = url.searchParams.get('sslmode');
    if (sslMode && ['prefer', 'require', 'verify-ca'].includes(sslMode)) {
      url.searchParams.set('sslmode', 'verify-full');
    }
    return url.toString();
  } catch {
    return value;
  }
}

const databaseUrl = normalizeDatabaseUrlForMigration(process.env.DATABASE_URL?.trim());
const onVercel = process.env.VERCEL === '1';
const vercelEnv = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development';

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!databaseUrl) {
  const help = [
    'DATABASE_URL não está configurada (string vazia).',
    '',
    'O comando `npm run build` executa migrações antes do Next.js e precisa de Postgres.',
    '',
    'Vercel (Production):',
    '  1. Vercel → Project → Settings → Environment Variables',
    '  2. Adicione DATABASE_URL com a connection string do Neon (pooler recomendado)',
    '  3. Marque Production e também "Build" (não só Runtime)',
    '  4. Exemplo: postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require',
    '',
    'Local:',
    '  Copie .env.example para .env.local e preencha DATABASE_URL',
    '  Ou use `npm run dev` (PGlite na porta 5433) e `npm run build:next` sem migrate',
    '',
    'Documentação: docs/GO-LIVE-GATE.md e docs/PASSOS-MANUAIS.md',
  ].join('\n');

  if (onVercel && vercelEnv === 'production') {
    fail(`ERROR: ${help}`);
  }

  if (onVercel) {
    console.warn('Aviso: pulando db:migrate no deploy Preview (DATABASE_URL ausente).');
    console.warn('Use `npm run build:next` em Preview ou configure DATABASE_URL na Vercel.');
    process.exit(0);
  }

  fail(`ERROR: ${help}`);
}

const client = new Client({ connectionString: databaseUrl });
try {
  await client.connect();
  await client.query('select 1');
} catch (error) {
  fail([
    'ERROR: db:migrate não conseguiu conectar no Postgres.',
    '',
    error instanceof Error ? error.message : String(error),
    '',
    'Se a mensagem menciona "exceeded the compute time quota", o problema é limite do Neon/Postgres.',
    'Reative o banco, aumente o limite/plano, ou ajuste a variável DATABASE_URL para um banco ativo antes de rodar o build.',
  ].join('\n'));
} finally {
  await client.end().catch(() => undefined);
}

const result = spawnSync('npx', ['drizzle-kit', 'migrate'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: databaseUrl },
  shell: process.platform === 'win32',
});

if (result.status !== 0) {
  console.error('');
  console.error('ERROR: db:migrate falhou antes do build do Next.js.');
  console.error('');
  console.error('Se o log acima contém "exceeded the compute time quota", o problema é limite do Neon/Postgres.');
  console.error('Nesse caso, o código não consegue aplicar migrations até o banco ser reativado, pausado/despausado, ou o plano/limite ser ajustado.');
}

process.exit(result.status ?? 1);
