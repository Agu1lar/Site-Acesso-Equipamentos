import { describe, expect, it } from 'vitest';
import {
  collapseDuplicateWhatsAppClicks,
  isWithinWhatsAppClickDedupWindow,
  whatsappClickDedupKey,
} from '@/lib/whatsapp-click-idempotency';

describe('whatsappClickDedupKey', () => {
  it('treats empty click ids as the same visitor signal', () => {
    expect(
      whatsappClickDedupKey({
        createdAt: new Date(),
        origin: 'site-flutuante',
        pathname: '/',
      }),
    ).toBe(
      whatsappClickDedupKey({
        createdAt: new Date(),
        origin: 'site-flutuante',
        pathname: '/',
        gclid: '  ',
      }),
    );
  });

  it('separates paid click ids from direct clicks on the same button', () => {
    expect(
      whatsappClickDedupKey({
        createdAt: new Date(),
        origin: 'site-home',
        pathname: '/',
        gclid: 'abc',
      }),
    ).not.toBe(
      whatsappClickDedupKey({
        createdAt: new Date(),
        origin: 'site-home',
        pathname: '/',
      }),
    );
  });
});

describe('isWithinWhatsAppClickDedupWindow', () => {
  it('counts a 600ms double click as a duplicate', () => {
    expect(isWithinWhatsAppClickDedupWindow(1_000, 1_600)).toBe(true);
  });

  it('keeps clicks 10 seconds apart', () => {
    expect(isWithinWhatsAppClickDedupWindow(1_000, 11_000)).toBe(false);
  });
});

describe('collapseDuplicateWhatsAppClicks', () => {
  it('reads a 600ms double click as one event', () => {
    const first = new Date('2026-09-08T18:00:00.000Z');
    const duplicate = new Date('2026-09-08T18:00:00.600Z');
    const later = new Date('2026-09-08T18:00:20.000Z');

    expect(
      collapseDuplicateWhatsAppClicks([
        { createdAt: duplicate, origin: 'site-flutuante', pathname: '/' },
        { createdAt: first, origin: 'site-flutuante', pathname: '/' },
        { createdAt: later, origin: 'site-flutuante', pathname: '/' },
      ]),
    ).toHaveLength(2);
  });

  it('keeps different buttons even when they fire together', () => {
    const at = new Date('2026-09-08T18:00:00.000Z');
    const soon = new Date('2026-09-08T18:00:00.400Z');

    expect(
      collapseDuplicateWhatsAppClicks([
        { createdAt: at, origin: 'site-flutuante', pathname: '/' },
        { createdAt: soon, origin: 'site-home', pathname: '/' },
      ]),
    ).toHaveLength(2);
  });

  it('keeps the same button on a different page', () => {
    const at = new Date('2026-09-08T18:00:00.000Z');
    const soon = new Date('2026-09-08T18:00:00.400Z');

    expect(
      collapseDuplicateWhatsAppClicks([
        { createdAt: at, origin: 'site-flutuante', pathname: '/' },
        { createdAt: soon, origin: 'site-flutuante', pathname: '/equipamentos' },
      ]),
    ).toHaveLength(2);
  });

  it('keeps a third click after the window from the last stored one', () => {
    const first = new Date('2026-09-08T18:00:00.000Z');
    const inside = new Date('2026-09-08T18:00:09.000Z');
    const after = new Date('2026-09-08T18:00:18.000Z');

    const kept = collapseDuplicateWhatsAppClicks([
      { createdAt: first, origin: 'site-flutuante', pathname: '/' },
      { createdAt: inside, origin: 'site-flutuante', pathname: '/' },
      { createdAt: after, origin: 'site-flutuante', pathname: '/' },
    ]);

    expect(kept).toHaveLength(2);
    expect(kept[0]?.createdAt).toEqual(first);
    expect(kept[1]?.createdAt).toEqual(after);
  });
});
