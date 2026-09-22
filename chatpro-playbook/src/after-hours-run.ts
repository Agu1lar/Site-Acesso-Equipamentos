import { loadPlaybookConfig } from './config.js';
import { createPlaybookPool, migratePlaybookSchema } from './db.js';
import { runAfterHoursTick } from './after-hours.js';
import { afterHoursMustDryRun } from './sandbox.js';

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

/**
 * Polls ChatPro and records the after-hours notice. WhatsApp send stays off in sandbox.
 */
async function main() {
  const liveFlag = hasFlag('--live');
  const once = hasFlag('--once');
  const config = loadPlaybookConfig();
  const dryRun = afterHoursMustDryRun({ sandbox: config.sandbox, liveFlag });
  if (liveFlag && config.sandbox) {
    console.warn('[after-hours] sandbox ativo: --live ignorado, nenhum WhatsApp sai');
  }
  const pool = createPlaybookPool(config.databaseUrl);
  let running = false;

  const tick = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      const result = await runAfterHoursTick({
        pool,
        config,
        dryRun,
      });
      console.log('[after-hours] tick', result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[after-hours] tick falhou', message);
    } finally {
      running = false;
    }
  };

  try {
    await migratePlaybookSchema(pool);
    console.log('[after-hours] iniciado', {
      modo: dryRun ? 'sandbox' : 'live',
      sandbox: config.sandbox,
      forceOffHours: config.afterHoursForceOffHours,
      pollMs: config.afterHoursPollMs,
      once,
    });
    await tick();
    if (once) {
      await pool.end();
      return;
    }

    let stopped = false;
    const waitNext = () => {
      setTimeout(() => {
        void tick().finally(() => {
          if (!stopped) {
            waitNext();
          }
        });
      }, config.afterHoursPollMs);
    };
    waitNext();

    const stop = async () => {
      stopped = true;
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
  console.error('[after-hours] falhou', message);
  process.exit(1);
}
