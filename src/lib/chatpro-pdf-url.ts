/** SSRF guards for ChatPro PDF attachments fetched for Claude analysis. */

const DEFAULT_ALLOWED_HOST_SUFFIXES = [
  'chatpro.com.br',
  'chatpro.com',
  'chatpro.io',
];

/**
 * True when the hostname resolves to a blocked local or private target.
 * @param hostname URL hostname (no port).
 */
export function isPrivateOrLocalHost(hostname: string) {
  const host = hostname.toLowerCase().trim();
  if (!host) {
    return true;
  }
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return true;
  }
  if (host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
    return true;
  }

  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) {
    return false;
  }

  const octets = ipv4Match.slice(1, 5).map((part) => Number(part));
  if (octets.some((octet) => Number.isNaN(octet) || octet > 255)) {
    return true;
  }

  const [first = 0, second = 0] = octets;
  if (first === 10 || first === 127 || first === 0) {
    return true;
  }
  if (first === 169 && second === 254) {
    return true;
  }
  if (first === 172 && second >= 16 && second <= 31) {
    return true;
  }
  if (first === 192 && second === 168) {
    return true;
  }
  if (first === 100 && second >= 64 && second <= 127) {
    return true;
  }
  if (first >= 224) {
    return true;
  }

  return false;
}

function hostMatchesSuffix(hostname: string, suffix: string) {
  const host = hostname.toLowerCase();
  const normalizedSuffix = suffix.toLowerCase().trim().replace(/^\./, '');
  if (!normalizedSuffix) {
    return false;
  }
  return host === normalizedSuffix || host.endsWith(`.${normalizedSuffix}`);
}

/**
 * True when a remote PDF URL is safe to fetch (HTTPS + allowlisted host, no private IPs).
 * @param url Remote media URL from ChatPro.
 * @param extraAllowedHostSuffixes Optional extra host suffixes from env.
 */
export function isAllowedPdfFetchUrl(url: string, extraAllowedHostSuffixes: string[] = []) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') {
    return false;
  }
  if (parsed.username || parsed.password) {
    return false;
  }
  if (isPrivateOrLocalHost(parsed.hostname)) {
    return false;
  }

  const suffixes = [...DEFAULT_ALLOWED_HOST_SUFFIXES, ...extraAllowedHostSuffixes];
  return suffixes.some((suffix) => hostMatchesSuffix(parsed.hostname, suffix));
}
