#!/usr/bin/env node
/**
 * Sandbox: exercises Claude ROI analysis with mock campaign lead data (no DB writes).
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -o -- npx tsx scripts/chatpro-roi-sandbox.mjs
 *   npx dotenv-cli -e .env.local -o -- npx tsx scripts/chatpro-roi-sandbox.mjs --mock-only
 *
 * Use -o/--override so a stale shell ANTHROPIC_API_KEY does not hide .env.local.
 */
const args = new Set(process.argv.slice(2));
const mockOnly = args.has('--mock-only');

const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
if (!apiKey) {
  console.error('ANTHROPIC_API_KEY is required (.env.local or Vercel env)');
  process.exit(1);
}

const model = process.env.ANTHROPIC_MODEL?.trim() || 'claude-haiku-4-5-20251001';

const { evaluateChatProLeadWithClaude } = await import('../src/lib/chatpro-roi-ai-core.ts');
const { extractWhatsAppAttributionRefCode } = await import('../src/lib/whatsapp-attribution-bridge.ts');
const { leadHasCampaignAttribution } = await import('../src/lib/chatpro-roi-eligibility.ts');

const now = new Date('2026-08-12T14:00:00.000Z');

const sandboxLead = {
  id: 9001,
  name: 'Lead Sandbox Campanha',
  status: 'contacted',
  equipmentName: 'Plataforma tesoura 12m',
  city: 'Contagem',
  message: 'Preciso de plataforma para obra em Contagem',
  utmCampaign: 'nova_plataformas_mg',
  utmSource: 'google',
  utmMedium: 'cpc',
  gclid: 'sandbox-gclid-001',
};

const sandboxMessages = [
  {
    id: 1,
    fromMe: false,
    messageText:
      'Olá! Tenho interesse na locação de plataforma tesoura 12m na região metropolitana de Belo Horizonte. Origem: site-home. Cód. AB12CD34',
    mediaType: null,
    mediaFilename: null,
    mediaMimetype: null,
    mediaUrl: null,
    eventAt: new Date('2026-08-12T14:05:00.000Z'),
  },
  {
    id: 2,
    fromMe: true,
    messageText: 'Olá! Temos plataforma tesoura 12m disponível. Qual período de locação?',
    mediaType: null,
    mediaFilename: null,
    mediaMimetype: null,
    mediaUrl: null,
    eventAt: new Date('2026-08-12T14:12:00.000Z'),
  },
  {
    id: 3,
    fromMe: false,
    messageText: 'Preciso por 30 dias. Vocês entregam em Contagem?',
    mediaType: null,
    mediaFilename: null,
    mediaMimetype: null,
    mediaUrl: null,
    eventAt: new Date('2026-08-12T14:20:00.000Z'),
  },
  {
    id: 4,
    fromMe: true,
    messageText: 'Sim, entregamos. Valor mensal R$ 4.800 com operador. Posso enviar contrato?',
    mediaType: null,
    mediaFilename: null,
    mediaMimetype: null,
    mediaUrl: null,
    eventAt: new Date('2026-08-12T15:00:00.000Z'),
  },
  {
    id: 5,
    fromMe: false,
    messageText: 'Pode enviar. Vamos fechar.',
    mediaType: null,
    mediaFilename: null,
    mediaMimetype: null,
    mediaUrl: null,
    eventAt: now,
  },
];

console.log('[sandbox] preflight');
console.log('  model:', model);
console.log('  keyPrefix:', apiKey.slice(0, 12));
console.log('  refCode:', extractWhatsAppAttributionRefCode(sandboxMessages[0].messageText));
console.log(
  '  campaignEligible:',
  leadHasCampaignAttribution({
    id: sandboxLead.id,
    status: sandboxLead.status,
    gclid: sandboxLead.gclid,
    gbraid: null,
    wbraid: null,
    utmSource: sandboxLead.utmSource,
    utmMedium: sandboxLead.utmMedium,
    utmCampaign: sandboxLead.utmCampaign,
    whatsappRepliedAt: now,
    lastActivityAt: now,
    createdAt: now,
  }),
);

async function pingAnthropic() {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      model,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Responda apenas: ok' }],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const payload = await response.json();
  return { ok: response.ok, status: response.status, payload };
}

if (!mockOnly) {
  console.log('[sandbox] auth ping…');
  const ping = await pingAnthropic();
  if (!ping.ok) {
    const message = ping.payload?.error?.message ?? `HTTP ${ping.status}`;
    console.error('[sandbox] Anthropic auth failed:', message);
    console.error('[sandbox] Atualize ANTHROPIC_API_KEY em .env.local e na Vercel (Production).');
    console.error('[sandbox] Rode com --mock-only para validar só o pipeline local.');
    process.exit(1);
  }
  console.log('[sandbox] auth ok');
}

if (mockOnly) {
  console.log('[sandbox] mock-only — pulando chamada Claude');
  process.exit(0);
}

console.log('[sandbox] calling Claude ROI…');
const started = Date.now();

try {
  const evaluation = await evaluateChatProLeadWithClaude(sandboxLead, sandboxMessages, {
    apiKey,
    model,
  });

  console.log('[sandbox] ok in', `${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(JSON.stringify(evaluation, null, 2));
  process.exit(0);
} catch (error) {
  console.error('[sandbox] failed in', `${((Date.now() - started) / 1000).toFixed(1)}s`);
  const reason = error instanceof Error ? error.message : String(error);
  console.error(reason);
  if (reason === 'anthropic_auth_invalid') {
    console.error('[sandbox] Atualize ANTHROPIC_API_KEY em .env.local e na Vercel.');
  }
  process.exit(1);
}
