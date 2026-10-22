const STORAGE_KEY = 'acesso_meta_click_context';
const FBC_PATTERN = /^fb\.\d+\.(\d+)\.([\w-]+)$/u;
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

/** Preserves an actual Meta click after consent; callers enforce consent. */
export function captureMetaClickContext() {
  if (typeof window === 'undefined' || typeof document === 'undefined') { return undefined; }
  const now = Date.now();
  const valid = (value: string | null | undefined) => {
    const match = value?.match(FBC_PATTERN);
    const timestamp = Number(match?.[1]);
    return value && value.length <= 500 && match && timestamp <= now && now - timestamp <= MAX_AGE_MS
      ? value : undefined;
  };
  let stored: string | undefined;
  try { stored = valid(window.sessionStorage.getItem(STORAGE_KEY)); } catch { /* Storage may be unavailable. */ }
  const click = new URLSearchParams(window.location.search).get('fbclid');
  const cookie = document.cookie.split(';').map(item => item.trim()).find(item => item.startsWith('_fbc='))?.slice(5);
  const cookieValue = valid(cookie);
  const existing = stored && cookieValue
    ? Number(stored.match(FBC_PATTERN)?.[1]) >= Number(cookieValue.match(FBC_PATTERN)?.[1]) ? stored : cookieValue
    : stored ?? cookieValue;
  const sameClick = existing?.match(FBC_PATTERN)?.[2] === click;
  const fbc = click && /^[\w-]+$/u.test(click) && click.length <= 450
    ? sameClick ? existing : `fb.1.${now}.${click}`
    : existing;
  if (fbc) {
    try { window.sessionStorage.setItem(STORAGE_KEY, fbc); } catch { /* Cookie or URL remains usable. */ }
  }
  return fbc;
}

/** Removes the consented click context when tracking is withdrawn. */
export function clearMetaClickContext() {
  if (typeof window === 'undefined') { return; }
  try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be unavailable. */ }
}
