import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readMetaConversionContext } from '@/lib/meta-conversion-context';

const state = vi.hoisted(() => ({ consent: false }));
vi.mock('@/lib/meta-pixel', () => ({ canTrackMetaPixel: () => state.consent }));

describe('Meta conversion context', () => {
  beforeEach(() => {
    state.consent = false;
    vi.stubGlobal('document', { cookie: '' });
    const values = new Map<string, string>();
    vi.stubGlobal('window', { location: { search: '?fbclid=ActualClick' }, sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('ignores a click before consent', () => {
    expect(readMetaConversionContext()).toBeUndefined();
  });

  it('includes a real click after consent without requiring SDK cookies', () => {
    state.consent = true;
    expect(readMetaConversionContext()).toMatchObject({ consent: true, fbc: expect.stringMatching(/^fb\.1\.\d+\.ActualClick$/u) });
  });
});
