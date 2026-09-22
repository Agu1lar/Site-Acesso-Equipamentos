/**
 * Google Ads Enhanced Conversions helpers: normalize, SHA-256 hash, session store.
 * Stores normalized plaintext in sessionStorage; hashes only when the Ads tag fires.
 */

export const ENHANCED_CONVERSION_USER_SESSION_KEY = 'acesso_ec_user';

export type EnhancedConversionUserInput = {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
};

export type StoredEnhancedConversionUser = {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
};

export type HashedEnhancedConversionUserData = {
  email?: string;
  phone_number?: string;
  address?: {
    first_name?: string;
    last_name?: string;
  };
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

/** Trims and lowercases an email for Enhanced Conversions. */
export function normalizeEnhancedConversionEmail(email: string) {
  return email.trim().toLowerCase();
}

/**
 * Formats a BR phone as E.164 (+55…).
 * @returns E.164 string or null when too short.
 */
export function normalizeEnhancedConversionPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) {
    return null;
  }

  let local = digits;
  if (local.startsWith('55') && local.length >= 12) {
    local = local.slice(2);
  }

  if (local.length > 11) {
    local = local.slice(-11);
  }

  if (local.length < 10 || local.length > 11) {
    return null;
  }

  return `+55${local}`;
}

/**
 * Splits a full name into first/last parts for Enhanced Conversions address fields.
 * Lowercases and strips punctuation per Google hashing guidance.
 */
export function normalizeEnhancedConversionName(name: string) {
  const cleaned = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return null;
  }

  const parts = cleaned.split(' ');
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ') || undefined;

  return { firstName, lastName };
}

/**
 * Builds a session-ready user record from raw form / One Tap fields.
 */
export function buildStoredEnhancedConversionUser(
  input: EnhancedConversionUserInput,
): StoredEnhancedConversionUser | null {
  const stored: StoredEnhancedConversionUser = {};

  if (input.email?.trim()) {
    stored.email = normalizeEnhancedConversionEmail(input.email);
  }

  if (input.phone?.trim()) {
    const phone = normalizeEnhancedConversionPhone(input.phone);
    if (phone) {
      stored.phone = phone;
    }
  }

  if (input.name?.trim()) {
    const parts = normalizeEnhancedConversionName(input.name);
    if (parts?.firstName) {
      stored.firstName = parts.firstName;
      if (parts.lastName) {
        stored.lastName = parts.lastName;
      }
    }
  }

  if (!stored.email && !stored.phone) {
    return null;
  }

  return stored;
}

/** True when the stored user can improve Ads attribution (email or phone). */
export function hasEnhancedConversionIdentifiers(
  user: StoredEnhancedConversionUser | null | undefined,
) {
  return Boolean(user?.email || user?.phone);
}

/**
 * Merges partial identifiers (e.g. One Tap email, then optional phone).
 */
export function mergeEnhancedConversionUsers(
  existing: StoredEnhancedConversionUser | null | undefined,
  incoming: StoredEnhancedConversionUser,
): StoredEnhancedConversionUser {
  return {
    email: incoming.email ?? existing?.email,
    phone: incoming.phone ?? existing?.phone,
    firstName: incoming.firstName ?? existing?.firstName,
    lastName: incoming.lastName ?? existing?.lastName,
  };
}

/** Reads the Enhanced Conversion user stored for this browser session. */
export function readEnhancedConversionUser(): StoredEnhancedConversionUser | null {
  const storage = readSessionStorage();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(ENHANCED_CONVERSION_USER_SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<StoredEnhancedConversionUser>;
    const user: StoredEnhancedConversionUser = {};
    if (typeof parsed.email === 'string' && parsed.email) {
      user.email = parsed.email;
    }
    if (typeof parsed.phone === 'string' && parsed.phone) {
      user.phone = parsed.phone;
    }
    if (typeof parsed.firstName === 'string' && parsed.firstName) {
      user.firstName = parsed.firstName;
    }
    if (typeof parsed.lastName === 'string' && parsed.lastName) {
      user.lastName = parsed.lastName;
    }
    return hasEnhancedConversionIdentifiers(user) ? user : null;
  } catch {
    return null;
  }
}

/**
 * Persists (and merges) Enhanced Conversion identifiers for later Ads clicks.
 * @param input Raw email/phone/name from a form or One Tap.
 * @returns The merged stored user, or null when nothing usable was provided.
 */
export function storeEnhancedConversionUser(
  input: EnhancedConversionUserInput,
): StoredEnhancedConversionUser | null {
  const incoming = buildStoredEnhancedConversionUser(input);
  if (!incoming) {
    return readEnhancedConversionUser();
  }

  const storage = readSessionStorage();
  const merged = mergeEnhancedConversionUsers(readEnhancedConversionUser(), incoming);

  if (!storage) {
    return merged;
  }

  try {
    storage.setItem(ENHANCED_CONVERSION_USER_SESSION_KEY, JSON.stringify(merged));
  } catch {
    // Session storage full or blocked — conversion can still use the in-call input.
  }

  return merged;
}

/** Clears the session EC user — test helper. */
export function clearEnhancedConversionUser() {
  const storage = readSessionStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(ENHANCED_CONVERSION_USER_SESSION_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * SHA-256 hex digest for Enhanced Conversions (lowercase hex).
 * @param value Already-normalized string.
 */
export async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Builds the hashed `user_data` object for gtag Enhanced Conversions.
 * @param user Normalized session user (or form input already stored-shaped).
 */
export async function buildHashedUserData(
  user: StoredEnhancedConversionUser,
): Promise<HashedEnhancedConversionUserData | null> {
  if (!hasEnhancedConversionIdentifiers(user)) {
    return null;
  }

  const hashed: HashedEnhancedConversionUserData = {};

  if (user.email) {
    hashed.email = await sha256Hex(user.email);
  }

  if (user.phone) {
    hashed.phone_number = await sha256Hex(user.phone);
  }

  if (user.firstName || user.lastName) {
    hashed.address = {};
    if (user.firstName) {
      hashed.address.first_name = await sha256Hex(user.firstName);
    }
    if (user.lastName) {
      hashed.address.last_name = await sha256Hex(user.lastName);
    }
  }

  return hashed;
}

/**
 * Extracts the email claim from a Google One Tap JWT without verifying the signature.
 * Safe for client-side Enhanced Conversion storage after the server already accepted the credential.
 */
export function emailFromGoogleCredentialJwt(credential: string) {
  const parts = credential.split('.');
  if (parts.length < 2 || !parts[1]) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json =
      typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('utf8');
    const payload = JSON.parse(json) as { email?: unknown };
    if (typeof payload.email !== 'string' || !payload.email.trim()) {
      return null;
    }
    return normalizeEnhancedConversionEmail(payload.email);
  } catch {
    return null;
  }
}
