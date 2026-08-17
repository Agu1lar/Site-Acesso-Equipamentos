import { getPostHog } from '@/lib/posthog-client';
import { GA_CONVERSION_EVENTS, captureGaEvent } from '@/lib/google-analytics';
import { fireAdsContactConversion } from '@/lib/ads-contact-conversion';

export type WhatsAppClickInput = {
  origin: string;
  equipmentSlug?: string;
  equipmentName?: string;
};

/**
 * Sends whatsapp_click to PostHog when a tracked WhatsApp link is used.
 */
export function captureWhatsAppClick(input: WhatsAppClickInput) {
  const posthog = getPostHog();
  if (!posthog) {
    return;
  }

  posthog.capture('whatsapp_click', {
    origin: input.origin,
    equipment_slug: input.equipmentSlug,
    equipment_name: input.equipmentName,
    pathname: typeof window === 'undefined' ? undefined : window.location.pathname,
  });
}

export type PhoneClickInput = {
  origin: string;
};

/**
 * Sends phone_click to PostHog when a tel: link is used.
 */
export function capturePhoneClick(input: PhoneClickInput) {
  const posthog = getPostHog();
  if (!posthog) {
    return;
  }

  posthog.capture('phone_click', {
    origin: input.origin,
    pathname: typeof window === 'undefined' ? undefined : window.location.pathname,
  });
}

export type SearchEventInput = {
  query: string;
  resultsCount: number;
};

/**
 * Sends search event to PostHog when the user searches equipment.
 */
export function captureSearch(input: SearchEventInput) {
  const posthog = getPostHog();
  if (!posthog) {
    return;
  }

  const query = input.query.trim();
  if (query.length < 2) {
    return;
  }

  posthog.capture('search', {
    query,
    results_count: input.resultsCount,
    pathname: typeof window === 'undefined' ? undefined : window.location.pathname,
  });
}

export type QuoteCartEventInput = {
  slug: string;
  name: string;
  kind: string;
  quantity: number;
  cartLineCount: number;
  cartTotalUnits: number;
};

/**
 * Sends add_to_quote to PostHog when an item enters the quote cart.
 */
export function captureAddToQuote(input: QuoteCartEventInput) {
  const posthog = getPostHog();
  if (!posthog) {
    return;
  }

  posthog.capture('add_to_quote', {
    equipment_slug: input.slug,
    equipment_name: input.name,
    item_kind: input.kind,
    quantity: input.quantity,
    cart_line_count: input.cartLineCount,
    cart_total_units: input.cartTotalUnits,
    pathname: typeof window === 'undefined' ? undefined : window.location.pathname,
  });
}

/**
 * Sends remove_from_quote to PostHog when an item leaves the quote cart.
 */
export function captureRemoveFromQuote(input: Pick<QuoteCartEventInput, 'slug' | 'name' | 'kind'>) {
  const posthog = getPostHog();
  if (!posthog) {
    return;
  }

  posthog.capture('remove_from_quote', {
    equipment_slug: input.slug,
    equipment_name: input.name,
    item_kind: input.kind,
    pathname: typeof window === 'undefined' ? undefined : window.location.pathname,
  });
}

export type QuoteSubmitEventInput = {
  origin: string;
  leadId?: number;
  cartLineCount: number;
  equipmentSlug?: string;
  equipmentName?: string;
};

/**
 * Sends quote_submit to PostHog after a successful lead API response.
 */
export function captureQuoteSubmit(input: QuoteSubmitEventInput) {
  const posthog = getPostHog();
  posthog?.capture('quote_submit', {
    origin: input.origin,
    lead_id: input.leadId,
    cart_line_count: input.cartLineCount,
    equipment_slug: input.equipmentSlug,
    equipment_name: input.equipmentName,
    pathname: typeof window === 'undefined' ? undefined : window.location.pathname,
  });

  captureGaEvent(GA_CONVERSION_EVENTS.generateLead, {
    origin: input.origin,
    lead_id: input.leadId,
    cart_line_count: input.cartLineCount,
    equipment_slug: input.equipmentSlug,
    equipment_name: input.equipmentName,
  });

  // Ads conversion must not depend on PostHog being ready.
  fireAdsContactConversion({
    source: 'quote',
    origin: input.origin,
    equipmentSlug: input.equipmentSlug,
    leadId: input.leadId,
  });
}
