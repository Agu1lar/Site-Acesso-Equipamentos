import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type LocalConfig = {
  apiBaseUrl: string;
  internalApiSecret: string;
  sqlitePath: string;
  pollIntervalMs: number;
  debounceMs: number;
  anthropicApiKey: string | null;
  anthropicModel: string;
  pdfAllowedHostSuffixes: string[];
};

/** Loads key=value pairs from chatpro-local/.env into process.env (no override). */
function loadDotEnvFile() {
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../.env');
  if (!existsSync(envPath)) {
    return;
  }

  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Prefer chatpro-local/.env over a stale parent shell env.
    process.env[key] = value;
  }
}

function readRequired(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

/** Loads environment for the local ChatPro ROI consumer. */
export function loadLocalConfig(): LocalConfig {
  loadDotEnvFile();

  const sqlitePath = resolve(
    process.env.CHATPRO_LOCAL_SQLITE_PATH?.trim() || './data/chatpro-local.db',
  );
  mkdirSync(dirname(sqlitePath), { recursive: true });

  const pdfAllowlistRaw = process.env.CHATPRO_PDF_URL_ALLOWLIST?.trim();

  return {
    apiBaseUrl: readRequired('CHATPRO_LOCAL_API_URL').replace(/\/$/, ''),
    internalApiSecret: readRequired('INTERNAL_API_SECRET'),
    sqlitePath,
    pollIntervalMs: Number(process.env.CHATPRO_LOCAL_POLL_MS ?? 60_000),
    debounceMs: Number(process.env.CHATPRO_LOCAL_DEBOUNCE_MS ?? 1_800_000),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() || null,
    anthropicModel: process.env.ANTHROPIC_MODEL?.trim() || 'claude-haiku-4-5-20251001',
    pdfAllowedHostSuffixes: pdfAllowlistRaw
      ? pdfAllowlistRaw.split(',').map((entry) => entry.trim()).filter(Boolean)
      : [],
  };
}
