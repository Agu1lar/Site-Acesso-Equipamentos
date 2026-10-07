import { describe, expect, it } from 'vitest';
import {
  chatProEventDedupKey,
  extractChatProPhone,
  isChatProClientReply,
  isChatProHumanAssignment,
  leadStatusAfterChatProEvent,
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

  it('parses alt_message transcription for voice notes', () => {
    const event = parseChatProWebhookPayload({
      event: 'received_message',
      message_data: {
        from_me: false,
        number: '5531999988770@s.whatsapp.net',
        type: 'ptt',
        alt_message: 'Preciso de plataforma tesoura por 30 dias',
        url: 'https://cdn.chatpro.com.br/media/voice.ogg',
        mimetype: 'audio/ogg',
      },
    });

    expect(event).toMatchObject({
      messagePreview: 'Preciso de plataforma tesoura por 30 dias',
      media: {
        mediaType: 'ptt',
        mediaUrl: 'https://cdn.chatpro.com.br/media/voice.ogg',
        mediaMimetype: 'audio/ogg',
      },
    });
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

  it('parses real assigned and transferred session fields', () => {
    const assigned = parseChatProWebhookPayload({
      event: 'assigned_session',
      event_ts: '2026-09-04T12:00:00.000Z',
      session_data: {
        id: 'session-1',
        session_id: 'session-1',
        number: '5531999988770',
        assing_to: 'seller-1',
        department_id: 'commercial-1',
      },
    });
    expect(assigned).toMatchObject({
      event: 'assigned_session',
      sessionId: 'session-1',
      assigneeId: 'seller-1',
      departmentId: 'commercial-1',
      externalId: null,
    });
    expect(isChatProHumanAssignment(assigned!)).toBe(true);
    expect(leadStatusAfterChatProEvent('new', assigned!)).toBe('contacted');

    const transferred = parseChatProWebhookPayload({
      event: 'transferred_session',
      session_data: {
        session_id: 'session-1',
        assing_to: '',
        department_id: 'logistics-1',
      },
    });
    expect(transferred).toMatchObject({
      departmentId: 'logistics-1',
      assigneeId: null,
    });
    expect(isChatProHumanAssignment(transferred!)).toBe(false);
    expect(leadStatusAfterChatProEvent('new', transferred!)).toBe('new');
  });

  it('does not mistake lead_id UUID for a phone number', () => {
    const event = parseChatProWebhookPayload({
      event: 'opened_session',
      session_data: {
        id: 'session-1',
        lead_id: '6ed19313-8e4b-445d-b8fd-4ac1f2410971',
      },
    });
    expect(event?.phoneKey).toBeNull();
  });

  it('parses sent_message delivery status and errors', () => {
    const event = parseChatProWebhookPayload({
      event: 'sent_message',
      message_data: {
        id: 'message-1',
        session_id: 'session-1',
        number: '5531999988770',
        from_me: true,
        status: -1,
        error_message: 'provider rejected message',
      },
    });
    expect(event).toMatchObject({
      event: 'sent_message',
      sessionId: 'session-1',
      deliveryStatus: -1,
      deliveryError: 'provider rejected message',
    });
    expect(chatProEventDedupKey(event!)).toBe('message-1:status:-1');
  });
});

describe('extractChatProPhone', () => {
  it('reads JID local part', () => {
    expect(extractChatProPhone('5531987654321@s.whatsapp.net')).toBe('31987654321');
  });
});
