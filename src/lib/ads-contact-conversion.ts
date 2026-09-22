/**
 * Single Google Ads conversion shared by every contact CTA (WhatsApp, quote, phone).
 * Fires at most once per browser session so one visitor never counts as two leads.
 * When Enhanced Conversion identifiers appear later, re-sends the same transaction_id with user_data.
 */

import {
  buildHashedUserData,
  hasEnhancedConversionIdentifiers,
  readEnhancedConversionUser,
  storeEnhancedConversionUser,
  type EnhancedConversionUserInput,
  type StoredEnhancedConversionUser,
} from '@/lib/enhanced-conversions';
import {
  captureGoogleAdsConversion,
  getGoogleAdsContactConversionSendTo,
} from '@/lib/google-analytics';

export const ADS_CONTACT_CONVERSION_SESSION_KEY = 'acesso_ads_contact_conversion';

export type AdsContactSource = 'whatsapp' | 'quote' | 'phone';

export type AdsContactConversionInput = {
  source: AdsContactSource;
  origin: string;
  equipmentSlug?: string;
  leadId?: number;
  /** Optional PII for Enhanced Conversions; otherwise the session store is used. */
  user?: EnhancedConversionUserInput;
};

export type AdsContactConversionResult = {
  fired: boolean;
  transactionId: string | null;
  reason?: 'already_fired' | 'not_configured' | 'unavailable' | 'enhanced_upgrade';
};

type StoredConversion = {
  transactionId: string;
  source: AdsContactSource;
  firedAt: string;
  withUserData: boolean;
};

function readSessionStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function readStoredConversion(): StoredConversion | null {
  const storage = readSessionStorage();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(ADS_CONTACT_CONVERSION_SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredConversion>;
    if (!parsed.transactionId) {
      return null;
    }
    return {
      transactionId: parsed.transactionId,
      source: (parsed.source as AdsContactSource | undefined) ?? 'whatsapp',
      firedAt: parsed.firedAt ?? new Date().toISOString(),
      withUserData: Boolean(parsed.withUserData),
    };
  } catch {
    return null;
  }
}

function storeConversion(entry: StoredConversion) {
  const storage = readSessionStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(ADS_CONTACT_CONVERSION_SESSION_KEY, JSON.stringify(entry));
  } catch {
    // Session storage full or blocked — the Ads-side "count one" setting still dedupes.
  }
}

function createTransactionId() {
  const cryptoRef = typeof globalThis === 'undefined' ? undefined : globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveEnhancedConversionUser(
  input: EnhancedConversionUserInput | undefined,
): StoredEnhancedConversionUser | null {
  if (input) {
    const stored = storeEnhancedConversionUser(input);
    if (hasEnhancedConversionIdentifiers(stored)) {
      return stored;
    }
  }

  return readEnhancedConversionUser();
}

/** True when this session already reported a contact conversion. */
export function hasFiredAdsContactConversion() {
  return readStoredConversion() !== null;
}

/** Clears the session lock — test and debug helper. */
export function resetAdsContactConversion() {
  const storage = readSessionStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(ADS_CONTACT_CONVERSION_SESSION_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * Reports one Google Ads contact conversion for this session.
 * Attaches hashed Enhanced Conversion user_data when email/phone is available.
 * Runs without analytics cookies (essential ad click measurement).
 * @param input CTA that triggered the contact and its page context.
 * @returns Whether the conversion beacon was sent and the transaction id used.
 */
export async function fireAdsContactConversion(
  input: AdsContactConversionInput,
): Promise<AdsContactConversionResult> {
  const sendTo = getGoogleAdsContactConversionSendTo();
  if (!sendTo) {
    return { fired: false, transactionId: null, reason: 'not_configured' };
  }

  const enhancedUser = resolveEnhancedConversionUser(input.user);
  const hashedUserData = enhancedUser ? await buildHashedUserData(enhancedUser) : null;
  const hasUserData = Boolean(hashedUserData);

  const existing = readStoredConversion();
  if (existing) {
    if (existing.withUserData || !hasUserData) {
      return { fired: false, transactionId: existing.transactionId, reason: 'already_fired' };
    }

    storeConversion({
      ...existing,
      withUserData: true,
    });

    captureGoogleAdsConversion(
      sendTo,
      {
        value: 1,
        currency: 'BRL',
        transaction_id: existing.transactionId,
        contact_source: input.source,
        origin: input.origin,
        equipment_slug: input.equipmentSlug,
        lead_id: input.leadId,
      },
      { requireAnalyticsConsent: false, userData: hashedUserData },
    );

    return {
      fired: true,
      transactionId: existing.transactionId,
      reason: 'enhanced_upgrade',
    };
  }

  const transactionId = createTransactionId();

  storeConversion({
    transactionId,
    source: input.source,
    firedAt: new Date().toISOString(),
    withUserData: hasUserData,
  });

  captureGoogleAdsConversion(
    sendTo,
    {
      value: 1,
      currency: 'BRL',
      transaction_id: transactionId,
      contact_source: input.source,
      origin: input.origin,
      equipment_slug: input.equipmentSlug,
      lead_id: input.leadId,
    },
    { requireAnalyticsConsent: false, userData: hashedUserData },
  );

  return { fired: true, transactionId };
}
