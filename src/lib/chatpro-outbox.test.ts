import { describe, expect, it } from 'vitest';
import { buildChatProOutboxPayload } from '@/lib/chatpro-outbox';
import type { ChatProInboundEvent } from '@/lib/chatpro-webhook';

const sampleEvent: ChatProInboundEvent = {
  event: 'received_message',
  phoneKey: '31999988770',
  fromMe: false,
  messagePreview: 'Quero orçamento',
  eventAt: new Date('2026-08-12T12:00:00.000Z'),
  externalId: 'msg-1',
  media: {
    mediaType: null,
    mediaUrl: null,
    mediaFilename: null,
    mediaMimetype: null,
  },
};

describe('buildChatProOutboxPayload', () => {
  it('maps parsed webhook event to outbox payload', () => {
    const payload = buildChatProOutboxPayload(42, 'msg-1', 7, sampleEvent);

    expect(payload).toEqual({
      messageId: 42,
      externalId: 'msg-1',
      leadId: 7,
      phoneKey: '31999988770',
      event: 'received_message',
      fromMe: false,
      messageText: 'Quero orçamento',
      mediaType: null,
      mediaUrl: null,
      mediaFilename: null,
      mediaMimetype: null,
      eventAt: '2026-08-12T12:00:00.000Z',
    });
  });
});
