#!/usr/bin/env node
/**
 * DEPRECATED legacy batch ChatPro ROI worker.
 *
 * Prefer chatpro-local/ (event-driven outbox consumer). This script only re-runs
 * when there are new messages, and refuses a full batch unless --force is passed.
 *
 * Usage:
 *   dotenv -c -- npx tsx scripts/chatpro-roi-worker.mjs --dry-run
 *   dotenv -c -- npx tsx scripts/chatpro-roi-worker.mjs --lead=123
 *   dotenv -c -- npx tsx scripts/chatpro-roi-worker.mjs --lead=123 --force
 *   dotenv -c -- npx tsx scripts/chatpro-roi-worker.mjs --force
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
const force = args.includes('--force');
const leadArg = args.find((arg) => arg.startsWith('--lead='));
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const leadId = leadArg ? Number(leadArg.split('=')[1]) : undefined;
const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;

if (leadArg && Number.isNaN(leadId)) {
  console.error('Invalid --lead value');
  process.exit(1);
}

if (!force && !leadArg) {
  console.error(
    [
      'DEPRECATED: use chatpro-local/ for production ROI analysis.',
      'This legacy batch worker will not scan all leads unless you pass --force.',
      'Examples:',
      '  npx tsx scripts/chatpro-roi-worker.mjs --lead=123',
      '  npx tsx scripts/chatpro-roi-worker.mjs --force --dry-run',
    ].join('\n'),
  );
  process.exit(2);
}

const { runChatProRoiWorker } = await import('../src/lib/chatpro-roi-worker.ts');

const result = await runChatProRoiWorker({
  dryRun,
  force: Boolean(force && leadId),
  leadId: leadId && !Number.isNaN(leadId) ? leadId : undefined,
  limit: limit && !Number.isNaN(limit) ? limit : undefined,
});

console.log(JSON.stringify(result, null, 2));
process.exit(result.errors > 0 ? 1 : 0);
