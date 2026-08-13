import type { InferSelectModel } from 'drizzle-orm';
import { formatOriginForOutgoingMessage } from '@/lib/analytics-display-labels';
import { brand } from '@/lib/brand';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import type { leadsSchema } from '@/models/Schema';

export type LeadRecord = InferSelectModel<typeof leadsSchema>;

const rentalPeriodLabels: Record<string, string> = {
  diaria: 'Diária',
  semanal: 'Semanal',
  mensal: 'Mensal',
  ainda_nao_sei: 'Ainda não sei',
};

function formatAttributionForEmail(lead: LeadRecord) {
  const lines: string[] = [];
  if (lead.utmSource) {
    lines.push(`UTM source: ${lead.utmSource}`);
  }
  if (lead.utmMedium) {
    lines.push(`UTM medium: ${lead.utmMedium}`);
  }
  if (lead.utmCampaign) {
    lines.push(`UTM campaign: ${lead.utmCampaign}`);
  }
  if (lead.utmContent) {
    lines.push(`UTM content: ${lead.utmContent}`);
  }
  if (lead.utmTerm) {
    lines.push(`UTM term: ${lead.utmTerm}`);
  }
  if (lead.referrer) {
    lines.push(`Referrer: ${lead.referrer}`);
  }
  if (lead.landingPage) {
    lines.push(`Landing: ${lead.landingPage}`);
  }
  if (lines.length === 0) {
    return [];
  }
  return ['', 'Campanha (first-touch):', ...lines];
}

function formatCartItemsForEmail(itemsJson: string | null) {
  if (!itemsJson) {
    return '';
  }
  try {
    const items = JSON.parse(itemsJson) as {
      name?: string;
      slug?: string;
      kind?: string;
      quantity?: number;
      specsSummary?: string;
    }[];
    if (!Array.isArray(items) || items.length === 0) {
      return '';
    }
    return items
      .map((item, index) => {
        const kind = item.kind === 'accessory' ? 'Acessório' : 'Equipamento';
        const qty = item.quantity && item.quantity > 1 ? ` · qtd. ${item.quantity}` : ' · qtd. 1';
        const specs = item.specsSummary ? ` · ${item.specsSummary}` : '';
        return `${index + 1}. ${item.name ?? '—'} (${kind})${qty}${specs} — ${item.slug ?? ''}`;
      })
      .join('\n');
  } catch {
    return '';
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/**
 * Resolves lead notification recipients: LEADS_NOTIFY_EMAIL (comma-separated) plus brand.email.
 */
export function resolveLeadNotifyEmails() {
  const recipients = new Set<string>();

  const configured = Env.LEADS_NOTIFY_EMAIL ?? '';
  for (const part of configured.split(/[,;]/u)) {
    const email = part.trim().toLowerCase();
    if (EMAIL_PATTERN.test(email)) {
      recipients.add(email);
    }
  }

  const commercial = brand.email.trim().toLowerCase();
  if (EMAIL_PATTERN.test(commercial)) {
    recipients.add(commercial);
  }

  return [...recipients];
}

/**
 * Sends a new-lead notification e-mail via Resend when configured.
 */
export async function notifyLeadByEmail(lead: LeadRecord) {
  const apiKey = Env.RESEND_API_KEY;
  const to = resolveLeadNotifyEmails();

  if (!apiKey?.startsWith('re_') || to.length === 0) {
    logger.warn(
      'Notificação de lead por e-mail ignorada: configure RESEND_API_KEY e LEADS_NOTIFY_EMAIL no Vercel (Production e Preview).',
    );
    return;
  }

  const period = lead.rentalPeriod
    ? (rentalPeriodLabels[lead.rentalPeriod] ?? lead.rentalPeriod)
    : '—';

  const cartLines = formatCartItemsForEmail(lead.itemsJson);

  const subject = `[Registro interno] Orçamento site — ${lead.name}`;
  const text = [
    `Registro interno de orçamento #${lead.id} — ${brand.name}`,
    '(Cliente envia a proposta pelo WhatsApp comercial; este e-mail é para controle da equipe.)',
    '',
    `Nome: ${lead.name}`,
    `E-mail: ${lead.email ?? '—'}`,
    `Telefone: ${lead.phone}`,
    `Empresa: ${lead.company ?? '—'}`,
    `Cidade: ${lead.city}`,
    cartLines ? `Itens solicitados:\n${cartLines}` : '',
    cartLines ? '' : `Equipamento: ${lead.equipmentName ?? '—'}`,
    cartLines ? '' : `Slug: ${lead.equipmentSlug ?? '—'}`,
    `Período: ${period}`,
    `Origem: ${formatOriginForOutgoingMessage(lead.origin)}`,
    ...formatAttributionForEmail(lead),
    '',
    lead.message ? `Mensagem:\n${lead.message}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const from = Env.RESEND_FROM_EMAIL ?? `${brand.name} <onboarding@resend.dev>`;
  const html = text.replaceAll('\n', '<br>');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      ...(lead.email ? { reply_to: [lead.email] } : {}),
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    let detail = body;
    try {
      const parsed = JSON.parse(body) as { message?: string };
      if (parsed.message) {
        detail = parsed.message;
      }
    } catch {
      // keep raw body
    }
    if (response.status === 429) {
      logger.warn('Resend rate limit atingido — lead salvo no Neon, e-mail interno não enviado agora', {
        status: response.status,
        detail,
        to,
      });
      return;
    }
    logger.error('Falha ao enviar e-mail de lead', {
      status: response.status,
      detail,
      to,
      from,
    });
    throw new Error(`Resend: ${detail}`);
  }

  logger.info(`E-mail de lead #${lead.id} enviado para ${to.join(', ')}`);
}
