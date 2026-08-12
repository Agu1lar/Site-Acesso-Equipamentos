import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type LocalConfig = {
  apiBaseUrl: string;
  internalApiSecret: string;
  sqlitePath: string;
  pollIntervalMs: number;
  debounceMs: number;
  anthropicApiKey: string | null;
  anthropicModel: string;
};

function readRequired(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

/** Loads environment for the local ChatPro ROI consumer. */
export function loadLocalConfig(): LocalConfig {
  const sqlitePath = resolve(
    process.env.CHATPRO_LOCAL_SQLITE_PATH?.trim() || './data/chatpro-local.db',
  );
  mkdirSync(dirname(sqlitePath), { recursive: true });

  return {
    apiBaseUrl: readRequired('CHATPRO_LOCAL_API_URL').replace(/\/$/, ''),
    internalApiSecret: readRequired('INTERNAL_API_SECRET'),
    sqlitePath,
    pollIntervalMs: Number(process.env.CHATPRO_LOCAL_POLL_MS ?? 60_000),
    debounceMs: Number(process.env.CHATPRO_LOCAL_DEBOUNCE_MS ?? 1_800_000),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() || null,
    anthropicModel: process.env.ANTHROPIC_MODEL?.trim() || 'claude-haiku-4-5-20251001',
  };
}
