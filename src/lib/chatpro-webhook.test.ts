import { describe, expect, it } from 'vitest';
import {
  extractChatProPhone,
  isChatProClientReply,
  parseChatProWebhookPayload,
} from '@/lib/chatpro-webhook';
import { phoneMatchKey } from '@/lib/lead-contact';

describe('phoneMatchKey', () => {
  it('strips BR country code for ChatPro-style numbers', () => {
    expect(phoneMatchKey('553199998877')).toBe('3199998877');
    expect(phoneMatchKey('3199998877')).toBe('3199998877');
    expect(phoneMatchKey('(31) 99998-8770')).toBe('31999988770');
  });
});

describe('parseChatProWebhookPayload', () => {
  it('parses inbound received_message', () => {
    const event = parseChatProWebhookPayload({
      event: 'received_message',
      event_ts: '2026-07-14T12:00:00.000Z',
      message_data: {
        from_me: false,
        message: 'Quero orçamento',
        number: '5531999988770@s.whatsapp.net',
      },
    });

    expect(event).toMatchObject({
      event: 'received_message',
      fromMe: false,
      phoneKey: '31999988770',
      messagePreview: 'Quero orçamento',
      externalId: null,
      media: {
        mediaType: null,
        mediaUrl: null,
        mediaFilename: null,
        mediaMimetype: null,
      },
    });
    expect(isChatProClientReply(event!)).toBe(true);
  });

  it('parses document attachment fields', () => {
    const event = parseChatProWebhookPayload({
      event: 'received_message',
      message_data: {
        from_me: false,
        message: 'Segue contrato',
        number: '5531999988770@s.whatsapp.net',
        message_id: 'msg-99',
        type: 'document',
        filename: 'contrato-locacao.pdf',
        mimetype: 'application/pdf',
        media_url: 'https://cdn.chatpro.example/contrato.pdf',
      },
    });

    expect(event).toMatchObject({
      externalId: 'msg-99',
      media: {
        mediaType: 'document',
        mediaFilename: 'contrato-locacao.pdf',
        mediaMimetype: 'application/pdf',
        mediaUrl: 'https://cdn.chatpro.example/contrato.pdf',
      },
    });
  });

  it('ignores outbound messages from the company', () => {
    const event = parseChatProWebhookPayload({
      event: 'received_message',
      message_data: {
        from_me: true,
        number: '5531999988770@s.whatsapp.net',
        message: 'Olá, tudo bem?',
      },
    });

    expect(event?.fromMe).toBe(true);
    expect(isChatProClientReply(event!)).toBe(false);
  });
});

describe('extractChatProPhone', () => {
  it('reads JID local part', () => {
    expect(extractChatProPhone('5531987654321@s.whatsapp.net')).toBe('31987654321');
  });
});
