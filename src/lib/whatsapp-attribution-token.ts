import 'server-only';

import { randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { AttributionInput } from '@/lib/attribution';
import { findLeadIdForChatProPhone, loadCampaignLeadSnapshot } from '@/lib/chatpro-lead-find';
import {
  WHATSAPP_CAMPAIGN_PLACEHOLDER_NAME,
} from '@/lib/chatpro-roi-lead-enrichment';
import { linkLeadToClient } from '@/lib/clients';
import { leadHasCampaignAttribution } from '@/lib/chatpro-roi-eligibility';
import {
  attributionQualifiesForWhatsAppBridge,
  extractWhatsAppAttributionRefCode,
} from '@/lib/whatsapp-attribution-bridge';
import { db } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { leadsSchema, whatsappAttributionTokensSchema } from '@/models/Schema';

const TOKEN_TTL_DAYS = 7;

export type MintWhatsAppAttributionTokenInput = {
  origin: string;
  equipmentSlug?: string;
  equipmentName?: string;
  pathname?: string;
  device?: string;
  attribution?: AttributionInput | null;
};

function generateRefCode() {
  return randomBytes(4).toString('hex').toUpperCase();
}

function phoneDisplayFromKey(phoneKey: string) {
  if (phoneKey.length === 11) {
    return `(${phoneKey.slice(0, 2)}) ${phoneKey.slice(2, 7)}-${phoneKey.slice(7)}`;
  }
  return phoneKey;
}

function mergeLeadAttribution(
  existing: {
    gclid: string | null;
    gbraid: string | null;
    wbraid: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmContent: string | null;
    utmTerm: string | null;
    referrer: string | null;
    landingPage: string | null;
  },
  incoming: ReturnType<typeof tokenRowToAttributionFields>,
) {
  return {
    gclid: existing.gclid ?? incoming.gclid,
    gbraid: existing.gbraid ?? incoming.gbraid,
    wbraid: existing.wbraid ?? incoming.wbraid,
    utmSource: existing.utmSource ?? incoming.utmSource,
    utmMedium: existing.utmMedium ?? incoming.utmMedium,
    utmCampaign: existing.utmCampaign ?? incoming.utmCampaign,
    utmContent: existing.utmContent ?? incoming.utmContent,
    utmTerm: existing.utmTerm ?? incoming.utmTerm,
    referrer: existing.referrer ?? incoming.referrer,
    landingPage: existing.landingPage ?? incoming.landingPage,
  };
}

function tokenRowToAttributionFields(row: typeof whatsappAttributionTokensSchema.$inferSelect) {
  return {
    gclid: row.gclid,
    gbraid: row.gbraid,
    wbraid: row.wbraid,
    utmSource: row.utmSource,
    utmMedium: row.utmMedium,
    utmCampaign: row.utmCampaign,
    utmContent: row.utmContent,
    utmTerm: row.utmTerm,
    referrer: row.referrer,
    landingPage: row.landingPage,
  };
}

/**
 * Stores a short-lived ref code for a campaign WhatsApp click.
 * @param input Click context and attribution from the browser.
 */
export async function mintWhatsAppAttributionToken(input: MintWhatsAppAttributionTokenInput) {
  const attribution = input.attribution;
  if (!attribution || !attributionQualifiesForWhatsAppBridge(attribution)) {
    return null;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_TTL_DAYS);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = generateRefCode();
    const inserted = await db
      .insert(whatsappAttributionTokensSchema)
      .values({
        token,
        origin: input.origin,
        equipmentSlug: input.equipmentSlug ?? null,
        equipmentName: input.equipmentName ?? null,
        pathname: input.pathname ?? null,
        device: input.device ?? null,
        utmSource: attribution.utmSource ?? null,
        utmMedium: attribution.utmMedium ?? null,
        utmCampaign: attribution.utmCampaign ?? null,
        utmContent: attribution.utmContent ?? null,
        utmTerm: attribution.utmTerm ?? null,
        gclid: attribution.gclid ?? null,
        gbraid: attribution.gbraid ?? null,
        wbraid: attribution.wbraid ?? null,
        referrer: attribution.referrer ?? null,
        landingPage: attribution.landingPage ?? null,
        expiresAt,
      })
      .onConflictDoNothing({ target: whatsappAttributionTokensSchema.token })
      .returning({ token: whatsappAttributionTokensSchema.token });

    if (inserted[0]?.token) {
      return inserted[0].token;
    }
  }

  return null;
}

async function createWhatsAppClickLead(
  phoneKey: string,
  tokenRow: typeof whatsappAttributionTokensSchema.$inferSelect,
) {
  const now = new Date();
  const attribution = tokenRowToAttributionFields(tokenRow);

  const [lead] = await db
    .insert(leadsSchema)
    .values({
      name: WHATSAPP_CAMPAIGN_PLACEHOLDER_NAME,
      email: null,
      phone: phoneDisplayFromKey(phoneKey),
      equipmentSlug: tokenRow.equipmentSlug,
      equipmentName: tokenRow.equipmentName,
      city: null,
      message: null,
      origin: tokenRow.origin,
      leadKind: 'whatsapp_click',
      status: 'new',
      whatsappOpened: true,
      lastActivityAt: now,
      ...attribution,
    })
    .returning();

  if (lead) {
    await linkLeadToClient(
      lead.id,
      {
        displayName: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
      },
      lead.lastActivityAt ?? lead.createdAt,
    );
  }

  return lead ?? null;
}

/**
 * Links a minted ref code to a ChatPro phone on first inbound message.
 * @param refCode Parsed ref from wa.me prefill.
 * @param phoneKey Normalized phone suffix from ChatPro.
 */
export async function claimWhatsAppAttributionToken(refCode: string, phoneKey: string) {
  const token = refCode.toUpperCase();
  const now = new Date();

  const rows = await db
    .select()
    .from(whatsappAttributionTokensSchema)
    .where(
      and(
        eq(whatsappAttributionTokensSchema.token, token),
        isNull(whatsappAttributionTokensSchema.claimedAt),
        gt(whatsappAttributionTokensSchema.expiresAt, now),
      ),
    )
    .limit(1);

  const tokenRow = rows[0];
  if (!tokenRow) {
    return null;
  }

  let leadId = await findLeadIdForChatProPhone(phoneKey);

  if (leadId) {
    const snapshot = await loadCampaignLeadSnapshot(leadId);
    if (snapshot && !leadHasCampaignAttribution(snapshot)) {
      const merged = mergeLeadAttribution(snapshot, tokenRowToAttributionFields(tokenRow));
      await db
        .update(leadsSchema)
        .set({
          ...merged,
          lastActivityAt: now,
          whatsappOpened: true,
        })
        .where(eq(leadsSchema.id, leadId));
    }
  } else {
    const lead = await createWhatsAppClickLead(phoneKey, tokenRow);
    leadId = lead?.id ?? null;
  }

  if (!leadId) {
    return null;
  }

  await db
    .update(whatsappAttributionTokensSchema)
    .set({
      leadId,
      phoneKey,
      claimedAt: now,
    })
    .where(eq(whatsappAttributionTokensSchema.id, tokenRow.id));

  logger.info('WhatsApp attribution ref claimed', { refCode: token, leadId, phoneKey });
  return leadId;
}

/**
 * Claims a ref code from an inbound ChatPro message when present.
 * @param phoneKey Normalized phone from ChatPro.
 * @param messageText Inbound message body.
 */
export async function claimWhatsAppAttributionFromMessage(
  phoneKey: string,
  messageText: string | null | undefined,
) {
  const refCode = extractWhatsAppAttributionRefCode(messageText);
  if (!refCode) {
    return null;
  }
  return claimWhatsAppAttributionToken(refCode, phoneKey);
}
