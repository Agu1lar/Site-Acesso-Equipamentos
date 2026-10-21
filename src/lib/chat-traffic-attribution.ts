import type { TrafficChannelInput } from '@/lib/traffic-channel';
import { classifyPaidPlatform, classifyTrafficChannel } from '@/lib/traffic-channel';

/** Returns only evidence captured on the website visit; never infers paid from a social click alone. */
export function buildChatTrafficAttribution(input: TrafficChannelInput & {
  utmCampaign?: string | null;
  landingPage?: string | null;
  leadId?: number | null;
}) {
  const paidPlatform = classifyPaidPlatform(input);
  let channel: string = paidPlatform ?? classifyTrafficChannel(input);
  if (channel === 'direct' && input.referrer && !input.referrer.includes('acessoequipamentos.com.br')) {
    channel = 'referral';
  }
  return {
    channel,
    source: input.utmSource ?? null,
    medium: input.utmMedium ?? null,
    campaign: input.utmCampaign ?? null,
    landing_page: input.landingPage?.split('?')[0] ?? null,
    google_click_linked: Boolean(input.gclid || input.gbraid || input.wbraid),
    site_lead_id: input.leadId ?? null,
    evidence: 'website_ref',
  };
}
