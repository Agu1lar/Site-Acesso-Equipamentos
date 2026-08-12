#!/usr/bin/env node
/**
 * Local ChatPro ROI worker — evaluates campaign leads with Claude (daily cron).
 *
 * Usage:
 *   dotenv -c -- npx tsx scripts/chatpro-roi-worker.mjs
 *   dotenv -c -- npx tsx scripts/chatpro-roi-worker.mjs --dry-run
 *   dotenv -c -- npx tsx scripts/chatpro-roi-worker.mjs --lead=123
 *
 * Requires: DATABASE_URL, ANTHROPIC_API_KEY
 */
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY?.trim()) {
  console.error('ANTHROPIC_API_KEY is required');
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const leadArg = args.find((arg) => arg.startsWith('--lead='));
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const leadId = leadArg ? Number(leadArg.split('=')[1]) : undefined;
const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;

if (leadArg && Number.isNaN(leadId)) {
  console.error('Invalid --lead value');
  process.exit(1);
}

const { runChatProRoiWorker } = await import('../src/lib/chatpro-roi-worker.ts');

const result = await runChatProRoiWorker({
  dryRun,
  leadId: leadId && !Number.isNaN(leadId) ? leadId : undefined,
  limit: limit && !Number.isNaN(limit) ? limit : undefined,
});

console.log(JSON.stringify(result, null, 2));
process.exit(result.errors > 0 ? 1 : 0);
