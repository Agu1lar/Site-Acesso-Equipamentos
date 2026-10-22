import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureMetaClickContext, clearMetaClickContext } from '@/lib/meta-click-context';

describe('Meta click context', () => {
  const now = 1792674000000;
  const storage = new Map<string, string>();
  let location: { search: string };
  let page: { cookie: string };
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(now);
    storage.clear();
    location = { search: '?fbclid=Real_Click-123' };
    page = { cookie: '' };
    vi.stubGlobal('document', page);
    vi.stubGlobal('window', { location, sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    } });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('preserves the real click and timestamp across navigation', () => {
    const first = captureMetaClickContext();
    expect(first).toBe(`fb.1.${now}.Real_Click-123`);
    vi.spyOn(Date, 'now').mockReturnValue(now + 1000);
    expect(captureMetaClickContext()).toBe(first);
    location.search = '';
    expect(captureMetaClickContext()).toBe(first);
  });

  it('replaces an older click with the current URL click', () => {
    page.cookie = `other=x; _fbc=fb.1.${now - 1000}.OlderClick`;
    expect(captureMetaClickContext()).toBe(`fb.1.${now}.Real_Click-123`);
  });

  it('keeps a valid cookie without inventing a click', () => {
    location.search = '';
    expect(captureMetaClickContext()).toBeUndefined();
    page.cookie = `_fbc=fb.1.${now - 1000}.CookieClick`;
    expect(captureMetaClickContext()).toBe(`fb.1.${now - 1000}.CookieClick`);
  });

  it('rejects malformed and expired identifiers', () => {
    location.search = '?fbclid=bad%20click';
    page.cookie = '_fbc=fb.1.1.Expired';
    expect(captureMetaClickContext()).toBeUndefined();
  });

  it('clears stored context on withdrawal', () => {
    captureMetaClickContext();
    clearMetaClickContext();
    location.search = '';
    expect(captureMetaClickContext()).toBeUndefined();
  });
});
