/** Pure helpers for WhatsApp click → ChatPro attribution bridge (no DB). */

import type { AttributionInput } from '@/lib/attribution';

export const WHATSAPP_ATTRIBUTION_REF_PREFIX = 'Cód.';
export const WHATSAPP_ATTRIBUTION_REF_LENGTH = 8;
const REF_CODE_PATTERN = /\bCód\.\s*([A-Z0-9]{8})\b/i;

/** True when stored attribution qualifies for the paid-campaign ROI bridge. */
export function attributionQualifiesForWhatsAppBridge(attribution: AttributionInput) {
  if (attribution.gclid?.trim() || attribution.gbraid?.trim() || attribution.wbraid?.trim()) {
    return true;
  }
  const medium = attribution.utmMedium?.trim().toLowerCase();
  if (medium === 'cpc' || medium === 'ppc' || medium === 'paid') {
    return true;
  }
  return false;
}

/**
 * Extracts an attribution ref code from a WhatsApp prefill or inbound message.
 * @param text Message body from wa.me prefill or ChatPro.
 */
export function extractWhatsAppAttributionRefCode(text: string | null | undefined) {
  if (!text?.trim()) {
    return null;
  }
  const match = text.match(REF_CODE_PATTERN);
  return match?.[1]?.toUpperCase() ?? null;
}

/**
 * Builds the suffix appended to wa.me prefill for ChatPro matching.
 * @param refCode Eight-character attribution ref.
 */
export function buildWhatsAppAttributionRefSuffix(refCode: string) {
  return ` ${WHATSAPP_ATTRIBUTION_REF_PREFIX} ${refCode.toUpperCase()}`;
}

/**
 * Appends an attribution ref suffix to a wa.me URL text parameter.
 * @param href Full wa.me URL including encoded text.
 * @param refCode Attribution ref from mint endpoint.
 */
export function appendWhatsAppAttributionRefToUrl(href: string, refCode: string) {
  const url = new URL(href);
  const text = url.searchParams.get('text') ?? '';
  url.searchParams.set('text', `${text}${buildWhatsAppAttributionRefSuffix(refCode)}`);
  return url.toString();
}
