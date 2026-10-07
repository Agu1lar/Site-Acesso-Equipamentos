const WWW_PUBLIC_HOST = 'www.acessoequipamentos.com.br';
const CANONICAL_PUBLIC_HOST = 'acessoequipamentos.com.br';

/** Returns the canonical URL when a public www URL needs redirecting. */
export function canonicalSiteUrl(input: string) {
  const url = new URL(input);
  if (url.hostname !== WWW_PUBLIC_HOST) {
    return null;
  }

  url.hostname = CANONICAL_PUBLIC_HOST;
  return url;
}
