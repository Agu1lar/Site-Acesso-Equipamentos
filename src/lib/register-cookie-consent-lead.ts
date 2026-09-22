import { readStoredAttribution } from '@/lib/attribution';
import { emailFromGoogleCredentialJwt, storeEnhancedConversionUser } from '@/lib/enhanced-conversions';
import { markOneTapLeadRegistered } from '@/lib/google-one-tap-client';
import { readStoredVisitorGeo } from '@/lib/visitor-geo';

export async function registerCookieConsentLead(credential: string) {
  const attribution = readStoredAttribution();
  const visitorGeo = readStoredVisitorGeo();
  const response = await fetch('/api/leads/cookie-consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      credential,
      attribution: attribution ?? undefined,
      visitorGeo: visitorGeo ?? undefined,
    }),
  });

  if (!response.ok) {
    return { ok: false as const, status: response.status };
  }

  const body = (await response.json()) as {
    ok?: boolean;
    created?: boolean;
    updated?: boolean;
    skipped?: string;
  };

  if (body.ok) {
    markOneTapLeadRegistered(window.sessionStorage);
    const email = emailFromGoogleCredentialJwt(credential);
    if (email) {
      storeEnhancedConversionUser({ email });
    }
    if (body.skipped === 'quote_exists') {
      return { ok: true as const, reason: 'quote_exists' as const };
    }
    if (body.created) {
      return { ok: true as const, reason: 'created' as const };
    }
    if (body.updated) {
      return { ok: true as const, reason: 'updated' as const };
    }
    return { ok: true as const, reason: 'acknowledged' as const };
  }

  return { ok: false as const, status: response.status };
}
