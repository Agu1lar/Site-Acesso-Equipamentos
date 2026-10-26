import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseAcessoChatWebhook, verifyAcessoChatSignature } from '@/lib/acesso-chat-webhook';
import {
  chatProEventDedupKey,
  isChatProClientReply,
  isChatProHumanAssignment,
} from '@/lib/chatpro-webhook';

const conversation = {
  id: 25,
  inbox_id: 2,
  created_at: 1792440000,
  updated_at: 1792440000,
  meta: {
    sender: { phone_number: '+5531999990000' },
    assignee: { id: 5 },
    assignee_type: 'User',
    team: { id: 8 },
  },
  messages: [{ id: 100, status: 'delivered' }],
};
const message = {
  event: 'message_created',
  account: { id: 3 },
  id: 100,
  private: false,
  message_type: 'incoming',
  content: 'Quero alugar. Cód. ABCD1234',
  created_at: '2026-10-19T19:00:00Z',
  conversation,
};

describe('parseAcessoChatWebhook', () => {
  it('maps customer replies to the existing attribution pipeline', () => {
    const event = parseAcessoChatWebhook(message);
    expect(event).toMatchObject({
      phoneKey: '31999990000',
      event: 'received_message',
      externalId: 'chatwoot:3:message:100',
      departmentId: '8',
      assigneeId: '5',
    });
    expect(event && isChatProClientReply(event)).toBe(true);
    expect(event?.messagePreview).toContain('Cód. ABCD1234');
  });
  it('accepts native customer messages still waiting for an attendant', () => {
    const event = parseAcessoChatWebhook({
      ...message,
      conversation: { ...conversation, meta: { ...conversation.meta, assignee: null, assignee_type: null } },
    });
    expect(event?.event).toBe('received_message');
    expect(event?.assigneeId).toBeNull();
    expect(event && isChatProClientReply(event)).toBe(true);
  });
  it('keeps outgoing messages separate from customer conversions', () => {
    const event = parseAcessoChatWebhook({ ...message, message_type: 'outgoing' });
    expect(event?.fromMe).toBe(true);
    expect(event && isChatProClientReply(event)).toBe(false);
    expect(event?.deliveryStatus).toBe(1);
  });
  it('ignores a WhatsApp call so it does not count as a customer reply', () => {
    const event = parseAcessoChatWebhook({ ...message, content_type: 'voice_call', content: 'Chamada do WhatsApp' });
    expect(event).toBeNull();
  });
  it('ignores private notes and system activities', () => {
    expect(parseAcessoChatWebhook({ ...message, private: true })).toBeNull();
    expect(parseAcessoChatWebhook({ ...message, message_type: 'activity' })).toBeNull();
  });
  it('ignores the test inbox and other accounts', () => {
    expect(
      parseAcessoChatWebhook({ ...message, conversation: { ...conversation, inbox_id: 4 } }),
    ).toBeNull();
    expect(parseAcessoChatWebhook({ ...message, account: { id: 4 } })).toBeNull();
  });
  it('maps explicit human assignments without inventing a customer reply', () => {
    const event = parseAcessoChatWebhook({
      ...conversation,
      event: 'conversation_updated',
      account: { id: 3 },
      changed_attributes: [{ assignee_id: { previous_value: null, current_value: 5 } }],
    });
    expect(event && isChatProHumanAssignment(event)).toBe(true);
    expect(event && isChatProClientReply(event)).toBe(false);
    expect(
      parseAcessoChatWebhook({
        ...conversation,
        event: 'conversation_updated',
        account: { id: 3 },
        changed_attributes: [{ waiting_since: {} }],
      }),
    ).toBeNull();
  });
  it('deduplicates message retries using a separate provider namespace', () => {
    const event = parseAcessoChatWebhook(message)!;
    expect(chatProEventDedupKey(event)).toBe('chatwoot:3:message:100');
    expect(chatProEventDedupKey(parseAcessoChatWebhook(message)!)).toBe(
      chatProEventDedupKey(event),
    );
  });
  it('rejects malformed messages', () => {
    expect(parseAcessoChatWebhook(null)).toBeNull();
    expect(parseAcessoChatWebhook({ ...message, created_at: 'invalid' })).toBeNull();
    expect(parseAcessoChatWebhook({ ...message, private: undefined })).toBeNull();
  });
});

describe('verifyAcessoChatSignature', () => {
  const secret = 'integration-test-secret-with-32-characters';
  const timestamp = '1792440000';
  const body = JSON.stringify(message);
  const signature = `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
  const input = { secret, timestamp, body, signature, now: Number(timestamp) * 1000 };
  it('accepts the native Chatwoot signature', () => {
    expect(verifyAcessoChatSignature(input)).toBe(true);
  });
  it('rejects altered content and missing signatures', () => {
    expect(verifyAcessoChatSignature({ ...input, body: '{}' })).toBe(false);
    expect(verifyAcessoChatSignature({ ...input, signature: null })).toBe(false);
    expect(verifyAcessoChatSignature({ ...input, signature: 'sha256=00' })).toBe(false);
  });
  it('rejects expired signed requests', () => {
    expect(verifyAcessoChatSignature({ ...input, now: input.now + 301000 })).toBe(false);
  });
});
