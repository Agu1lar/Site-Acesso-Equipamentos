import type { Pool } from 'pg';

const VAULT_WRITTEN_KEY = 'vault:written';
const PLAYBOOK_FINGERPRINT_KEY = 'playbook:fingerprint';

/**
 * Reads a worker cache entry.
 */
export async function readWorkerCache(pool: Pool, cacheKey: string) {
  const result = await pool.query<{ value: string }>(
    `SELECT value FROM worker_cache WHERE cache_key = $1`,
    [cacheKey],
  );
  return result.rows[0]?.value ?? null;
}

/**
 * Writes a worker cache entry.
 */
export async function writeWorkerCache(pool: Pool, cacheKey: string, value: string) {
  await pool.query(
    `INSERT INTO worker_cache (cache_key, value, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (cache_key) DO UPDATE SET
       value = EXCLUDED.value,
       updated_at = now()`,
    [cacheKey, value],
  );
}

/**
 * Last inbox fingerprint already written to Obsidian.
 */
export async function readVaultWrittenFingerprint(pool: Pool) {
  return readWorkerCache(pool, VAULT_WRITTEN_KEY);
}

/**
 * Stores the inbox fingerprint after a successful vault write.
 */
export async function writeVaultWrittenFingerprint(pool: Pool, fingerprintKeyValue: string) {
  await writeWorkerCache(pool, VAULT_WRITTEN_KEY, fingerprintKeyValue);
}

/**
 * Last inbox fingerprint that already produced a Haiku playbook.
 */
export async function readPlaybookFingerprint(pool: Pool) {
  return readWorkerCache(pool, PLAYBOOK_FINGERPRINT_KEY);
}

/**
 * Stores the inbox fingerprint after a successful playbook job.
 */
export async function writePlaybookFingerprint(pool: Pool, fingerprintKeyValue: string) {
  await writeWorkerCache(pool, PLAYBOOK_FINGERPRINT_KEY, fingerprintKeyValue);
}
