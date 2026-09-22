import { storeEnhancedConversionUser } from '@/lib/enhanced-conversions';
import {
  markOptionalPhonePromptDismissed,
  markOptionalPhonePromptSaved,
} from '@/lib/google-one-tap-client';

export async function saveCookieConsentPhone(credential: string, phone: string) {
  const response = await fetch('/api/leads/cookie-consent/phone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential, phone }),
  });

  if (!response.ok) {
    return { ok: false as const };
  }

  const body = (await response.json()) as {
    ok?: boolean;
    updated?: boolean;
    skipped?: string;
  };

  if (body.ok && (body.updated || body.skipped === 'already_has_phone')) {
    markOptionalPhonePromptSaved(window.sessionStorage);
    storeEnhancedConversionUser({ phone });
    return { ok: true as const, saved: true as const };
  }

  return { ok: true as const, saved: false as const };
}

export function dismissOptionalPhonePrompt() {
  markOptionalPhonePromptDismissed(window.sessionStorage);
}
