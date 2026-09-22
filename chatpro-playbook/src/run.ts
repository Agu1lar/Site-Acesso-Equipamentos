import { loadPlaybookConfig } from './config.js';
import { createPlaybookPool, migratePlaybookSchema } from './db.js';
import { runInterceptTick } from './intercept.js';

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

/**
 * One-shot: ChatPro → Postgres → Obsidian. Use `npm run worker` to keep watching.
 */
async function main() {
  const syncOnly = hasFlag('--sync-only');
  const playbookOnly = hasFlag('--playbook-only');
  const config = loadPlaybookConfig();
  const pool = createPlaybookPool(config.databaseUrl);

  try {
    await migratePlaybookSchema(pool);
    const result = await runInterceptTick({
      pool,
      config,
      sync: !playbookOnly,
      writePlaybook: !syncOnly,
      forcePlaybook: !syncOnly,
    });
    console.log('[chatpro-playbook]', result);
  } finally {
    await pool.end();
  }
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[chatpro-playbook] falhou', message);
  process.exit(1);
}
