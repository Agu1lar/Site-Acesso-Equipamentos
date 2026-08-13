import { normalizeLeadEmail } from '@/lib/lead-contact';

export const WHATSAPP_CAMPAIGN_PLACEHOLDER_NAME = 'Lead WhatsApp (campanha)';

const SYNTHETIC_INBOUND_EMAIL_RE = /^wa\+.+@inbound\.acessoequipamentos\.com\.br$/iu;
const BASIC_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/**
 * True when the stored name is the WhatsApp-click placeholder (safe to replace).
 */
export function isWhatsAppCampaignPlaceholderName(name: string | null | undefined) {
  return (name?.trim() || '') === WHATSAPP_CAMPAIGN_PLACEHOLDER_NAME;
}

/**
 * True when the email is missing or a synthetic wa+…@inbound address.
 */
export function isMissingOrSyntheticLeadEmail(email: string | null | undefined) {
  const trimmed = email?.trim() ?? '';
  if (!trimmed) {
    return true;
  }
  return SYNTHETIC_INBOUND_EMAIL_RE.test(trimmed);
}

function sanitizeDetectedEmail(raw: string | null | undefined) {
  const trimmed = raw?.trim();
  if (!trimmed || !BASIC_EMAIL_RE.test(trimmed)) {
    return null;
  }
  const normalized = normalizeLeadEmail(trimmed);
  if (isMissingOrSyntheticLeadEmail(normalized)) {
    return null;
  }
  return normalized.slice(0, 320);
}

/**
 * Decides which contact fields Claude may write onto the lead.
 */
export function resolveLeadContactEnrichment(options: {
  currentName: string;
  currentEmail: string | null | undefined;
  detectedContactName: string | null | undefined;
  detectedEmail: string | null | undefined;
}) {
  const nextName =
    isWhatsAppCampaignPlaceholderName(options.currentName)
    && options.detectedContactName?.trim()
      ? options.detectedContactName.trim().slice(0, 200)
      : null;

  const nextEmail = isMissingOrSyntheticLeadEmail(options.currentEmail)
    ? sanitizeDetectedEmail(options.detectedEmail)
    : null;

  return {
    name: nextName,
    email: nextEmail,
    shouldUpdate: Boolean(nextName || nextEmail),
  };
}
