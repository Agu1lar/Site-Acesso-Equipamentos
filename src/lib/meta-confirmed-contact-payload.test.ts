import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildMetaConfirmedContactPayload } from '@/lib/meta-confirmed-contact-payload';

describe('Meta confirmed WhatsApp contact', () => {
  const now = new Date('2026-10-09T12:00:00Z');
  const input = { leadId: 42, phone: '(31) 99999-1234', repliedAt: now, context: { consent: true as const, fbp: 'fb.1.123.456' } };
  it('hashes the international phone and excludes conversation content', () => {
    const event = buildMetaConfirmedContactPayload(input, now);
    expect(event).toMatchObject({ event_name: 'Contact', action_source: 'chat', event_id: 'whatsapp-confirmed-lead-42' });
    expect(event?.user_data.ph).toEqual([createHash('sha256').update('5531999991234').digest('hex')]);
    expect(JSON.stringify(event)).not.toContain('99999');
    expect(event?.user_data.fbp).toBe(input.context.fbp);
  });
  it('retains the original event id and time on retries', () => {
    const first = buildMetaConfirmedContactPayload(input, now);
    const retry = buildMetaConfirmedContactPayload(input, new Date(now.getTime() + 86_400_000));
    expect(retry?.event_id).toBe(first?.event_id);
    expect(retry?.event_time).toBe(first?.event_time);
  });
  it('rejects invalid phones and events outside the allowed age', () => {
    expect(buildMetaConfirmedContactPayload({ ...input, phone: '123' }, now)).toBeNull();
    expect(buildMetaConfirmedContactPayload(input, new Date(now.getTime() + 8 * 86_400_000))).toBeNull();
    expect(buildMetaConfirmedContactPayload({ ...input, repliedAt: new Date('invalid') }, now)).toBeNull();
    expect(buildMetaConfirmedContactPayload(input, new Date(now.getTime() - 120_000))).toBeNull();
  });
});
