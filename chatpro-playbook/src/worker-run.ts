import { loadPlaybookConfig } from './config.js';
import { createPlaybookPool, migratePlaybookSchema } from './db.js';
import { runInterceptTick } from './intercept.js';

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

/**
 * Watches the ChatPro inbox and updates Obsidian. WhatsApp stays blocked in sandbox.
 */
async function main() {
  const once = hasFlag('--once');
  const skipPlaybook = hasFlag('--skip-playbook');
  const forcePlaybook = hasFlag('--force-playbook');
  const config = loadPlaybookConfig();
  const pool = createPlaybookPool(config.databaseUrl);
  let running = false;

  const tick = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      const result = await runInterceptTick({
        pool,
        config,
        sync: true,
        writePlaybook: !skipPlaybook,
        forcePlaybook,
        drainMedia: once ? 40 : 8,
        drainOther: once ? 20 : 6,
      });
      console.log('[worker] tick', result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[worker] tick falhou', message);
    } finally {
      running = false;
    }
  };

  try {
    await migratePlaybookSchema(pool);
    console.log('[worker] lendo ChatPro e atualizando Obsidian', {
      pollMs: config.workerPollMs,
      playbookRefreshMs: config.playbookRefreshMs,
      sandbox: config.sandbox,
      once,
      skipPlaybook,
      forcePlaybook,
    });
    await tick();
    if (once) {
      await pool.end();
      return;
    }

    const timer = setInterval(() => {
      void tick();
    }, config.workerPollMs);

    const stop = async () => {
      clearInterval(timer);
      await pool.end();
      process.exit(0);
    };
    process.on('SIGINT', () => {
      void stop();
    });
    process.on('SIGTERM', () => {
      void stop();
    });
  } catch (error) {
    await pool.end();
    throw error;
  }
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[worker] falhou', message);
  process.exit(1);
}
