#!/usr/bin/env node
/**
 * ChatPro ROI report — CRM × Claude × gasto Ads (Google Ads API ou manual).
 *
 * Usage:
 *   dotenv -c -- npx tsx scripts/chatpro-roi-report.mjs --campaignPrefix=nova_
 *   dotenv -c -- npx tsx scripts/chatpro-roi-report.mjs --campaignPrefix=nova_ --use-google-ads-spend
 *   dotenv -c -- npx tsx scripts/chatpro-roi-report.mjs --campaignPrefix=nova_ --spend-file=docs/examples/campaign-spend.example.json
 *
 * Remote (sem DATABASE_URL):
 *   dotenv -c -- npx tsx scripts/chatpro-roi-report.mjs --remote --campaignPrefix=nova_ --use-google-ads-spend
 */
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const remote = args.includes('--remote');
const useGoogleAdsSpend = args.includes('--use-google-ads-spend');
const prefixArg = args.find((arg) => arg.startsWith('--campaignPrefix='));
const fromArg = args.find((arg) => arg.startsWith('--from='));
const toArg = args.find((arg) => arg.startsWith('--to='));
const spendFileArg = args.find((arg) => arg.startsWith('--spend-file='));

const campaignPrefix = prefixArg?.split('=')[1]?.trim();
if (!campaignPrefix) {
  console.error('--campaignPrefix= is required');
  process.exit(1);
}

let spendMap = {};
if (spendFileArg) {
  const spendPath = spendFileArg.split('=')[1]?.trim();
  if (!spendPath) {
    console.error('Invalid --spend-file value');
    process.exit(1);
  }
  spendMap = JSON.parse(readFileSync(spendPath, 'utf8'));
}

if (remote) {
  const apiUrl = process.env.CHATPRO_LOCAL_API_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  const secret = process.env.INTERNAL_API_SECRET?.trim();
  if (!apiUrl || !secret) {
    console.error('CHATPRO_LOCAL_API_URL (or NEXT_PUBLIC_APP_URL) and INTERNAL_API_SECRET are required for --remote');
    process.exit(1);
  }

  const url = new URL('/api/internal/v1/chatpro-roi/report', apiUrl.replace(/\/$/, ''));
  url.searchParams.set('campaignPrefix', campaignPrefix);
  if (fromArg) url.searchParams.set('from', fromArg.split('=')[1]);
  if (toArg) url.searchParams.set('to', toArg.split('=')[1]);
  if (useGoogleAdsSpend) url.searchParams.set('useGoogleAdsSpend', 'true');
  if (Object.keys(spendMap).length > 0) {
    url.searchParams.set('spendJson', encodeURIComponent(JSON.stringify(spendMap)));
  }

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${secret}` },
  });
  if (!response.ok) {
    console.error('Report request failed', response.status, await response.text());
    process.exit(1);
  }
  console.log(JSON.stringify(await response.json(), null, 2));
  process.exit(0);
}

if (!process.env.DATABASE_URL?.trim()) {
  console.error('DATABASE_URL is required (or use --remote)');
  process.exit(1);
}

const {
  buildChatProRoiReport,
  parseCampaignSpendMap,
  resolveChatProRoiSpend,
} = await import('../src/lib/chatpro-roi-report.ts');

const searchParams = new URLSearchParams({ campaignPrefix });
if (fromArg) searchParams.set('from', fromArg.split('=')[1]);
if (toArg) searchParams.set('to', toArg.split('=')[1]);

const { parseAdsQualityFilters } = await import('../src/lib/ads-quality-api.ts');
const parsed = parseAdsQualityFilters(searchParams);
if (!parsed.ok) {
  console.error(parsed.error);
  process.exit(1);
}

const manualSpend = parseCampaignSpendMap(spendMap);
const spendResolved = await resolveChatProRoiSpend(parsed.filters, manualSpend, useGoogleAdsSpend);
const report = await buildChatProRoiReport(
  parsed.filters,
  spendResolved.merged,
  spendResolved.spendMeta,
  spendResolved.parts,
);
console.log(JSON.stringify(report, null, 2));
