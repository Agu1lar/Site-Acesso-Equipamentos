import { COOKIE_CONSENT_STORAGE_KEY } from '@/lib/cookie-consent';
import { isInternalAnalyticsPath } from '@/lib/analytics-internal-paths';
import { Env } from '@/libs/Env';

type PixelCommand = [string, ...unknown[]];
type PixelFunction = ((...args: PixelCommand) => void) & {
  callMethod?: (...args: PixelCommand) => void;
  queue: PixelCommand[];
  push?: PixelFunction;
  loaded: boolean;
  version: string;
};

declare global {
  // Declaration merging requires an interface for the browser global.
  // oxlint-disable-next-line typescript/consistent-type-definitions
  interface Window {
    fbq?: PixelFunction;
    _fbq?: PixelFunction;
  }
}

const CONTACT_KEY = 'acesso_meta_contact_conversion';
// Public browser identifier created for this domain in Meta Events Manager.
const META_PIXEL_ID = Env.NEXT_PUBLIC_META_PIXEL_ID ?? '1447966330544118';
let initialized = false;
let lastPage: string | null = null;
const sentContacts = new Set<string>();

/** Block marketing events when consent or browser storage is unavailable. */
export function canTrackMetaPixel() {
  if (typeof window === 'undefined' || !META_PIXEL_ID) { return false; }
  try {
    return window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) === 'analytics'
      && !isInternalAnalyticsPath(window.location.pathname);
  } catch {
    return false;
  }
}

/** Set up the official Pixel queue; the script component loads the SDK after consent. */
export function initializeMetaPixel() {
  if (!canTrackMetaPixel()) { return false; }
  if (!window.fbq) {
    const pixel: PixelFunction = Object.assign((...args: PixelCommand) => {
      if (pixel.callMethod) { pixel.callMethod(...args); }
      else { pixel.queue.push(args); }
    }, { queue: [] as PixelCommand[], loaded: true, version: '2.0' });
    pixel.push = pixel;
    window.fbq = pixel;
    window._fbq = pixel;
  }
  window.fbq('consent', 'grant');
  if (!initialized) {
    window.fbq('set', 'autoConfig', false, META_PIXEL_ID);
    window.fbq('init', META_PIXEL_ID);
    initialized = true;
  }
  return true;
}

/** Pause an already loaded Pixel when the visitor withdraws consent. */
export function revokeMetaPixelConsent() {
  if (typeof window !== 'undefined') { window.fbq?.('consent', 'revoke'); }
  lastPage = null;
}

/** SPA page views, excluding the private dashboard and repeat renders. */
export function captureMetaPageView(path: string) {
  if (!initializeMetaPixel() || isInternalAnalyticsPath(path) || lastPage === path) { return; }
  window.fbq?.('track', 'PageView');
  lastPage = path;
}

/** Diagnostic CTA events; only a confirmed inbound WhatsApp message is a conversion. */
export function captureMetaContact(input: { source: 'whatsapp' | 'phone' | 'quote'; equipmentSlug?: string }) {
  if (!initializeMetaPixel()) { return false; }
  const event = input.source === 'whatsapp' ? 'WhatsAppButtonClick' : input.source === 'phone' ? 'PhoneButtonClick' : 'QuoteFormSubmitted';
  const key = `${event}:${input.source}`;
  if (sentContacts.has(key)) { return false; }
  try {
    const stored: unknown = JSON.parse(window.sessionStorage.getItem(CONTACT_KEY) ?? '[]');
    if (Array.isArray(stored) && stored.includes(key)) { return false; }
    window.sessionStorage.setItem(CONTACT_KEY, JSON.stringify([
      ...(Array.isArray(stored) ? stored.filter((item): item is string => typeof item === 'string') : []), key,
    ]));
  } catch {
    // In-memory deduplication still works when session storage is blocked.
  }
  sentContacts.add(key);
  window.fbq?.('trackCustom', event, {
    contact_channel: input.source,
    ...(input.equipmentSlug ? { content_ids: [input.equipmentSlug] } : {}),
  });
  return true;
}
