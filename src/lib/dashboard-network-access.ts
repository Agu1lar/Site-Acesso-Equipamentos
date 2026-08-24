import { Env } from '@/libs/Env';

export function normalizeDashboardIp(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.startsWith('::ffff:')) {
    return trimmed.slice('::ffff:'.length);
  }
  if (trimmed.endsWith('/32')) {
    return trimmed.slice(0, -3);
  }
  if (trimmed.endsWith('/128')) {
    return trimmed.slice(0, -4);
  }
  return trimmed;
}

/** Resolves the client IP from headers set by Vercel. */
export function resolveDashboardClientIp(headers: Headers) {
  const forwarded =
    headers.get('x-vercel-forwarded-for')
    ?? headers.get('x-forwarded-for')
    ?? headers.get('x-real-ip');

  return forwarded?.split(',')[0] ? normalizeDashboardIp(forwarded.split(',')[0] ?? '') : null;
}

/** Restricts dashboard traffic when an IP allowlist is configured. */
export function isDashboardNetworkAllowed(
  headers: Headers,
  allowedIps = Env.DASHBOARD_ALLOWED_IPS,
) {
  if (!allowedIps) {
    return true;
  }

  const clientIp = resolveDashboardClientIp(headers);
  if (!clientIp) {
    return false;
  }

  const allowed = allowedIps
    .split(',')
    .map(normalizeDashboardIp)
    .filter(Boolean);

  return allowed.includes(clientIp);
}
