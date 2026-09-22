import {
  parseChatProMessageList,
  parseChatProSentMessageId,
  parseChatProSessionList,
  parseChatProSessionResult,
} from './parse-chatpro.js';
import { isAfterHoursSandbox } from './sandbox.js';

const CHATPRO_CHAT_BASE = 'https://sparks.chatpro.com.br';

export type ChatProChatClientOptions = {
  instanceId: string;
  instanceToken: string;
};

/**
 * ChatPro Chat inbox API (sessions + messages). Does not use the site or Neon.
 */
export class ChatProChatClient {
  private readonly instanceId: string;
  private readonly instanceToken: string;

  constructor(options: ChatProChatClientOptions) {
    this.instanceId = options.instanceId;
    this.instanceToken = options.instanceToken;
  }

  private async postJson(path: string, body: Record<string, unknown>) {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const response = await fetch(new URL(path, CHATPRO_CHAT_BASE), {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'instance-token': this.instanceToken,
          },
          body: JSON.stringify({ instanceId: this.instanceId, ...body }),
          signal: AbortSignal.timeout(45_000),
        });
        const text = await response.text();
        if (response.status === 429) {
          lastError = new Error(`chatpro_http_429:${path}`);
          await new Promise((resolve) => setTimeout(resolve, 8_000 * (attempt + 1)));
          continue;
        }
        if (response.status === 404 && path === '/messages/getAll') {
          return [];
        }
        if (!response.ok) {
          throw new Error(`chatpro_http_${response.status}:${path}:${text.slice(0, 180)}`);
        }
        try {
          return JSON.parse(text) as unknown;
        } catch {
          throw new Error(`chatpro_invalid_json:${path}`);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const retryable = lastError.message.startsWith('chatpro_http_429')
          || lastError.name === 'TimeoutError'
          || lastError.message.includes('fetch failed')
          || lastError.message.includes('UND_ERR')
          || lastError.message.includes('ECONNRESET');
        if (!retryable || attempt === 4) {
          if (error instanceof Error) {
            throw error;
          }
          throw new Error(String(error), { cause: error });
        }
        await new Promise((resolve) => setTimeout(resolve, 8_000 * (attempt + 1)));
      }
    }
    throw lastError ?? new Error(`chatpro_request_failed:${path}`);
  }

  /**
   * Lists inbox sessions. `offset` pages past already-read rows.
   */
  async listSessions(options: {
    start: Date;
    end: Date;
    open?: boolean;
    limit?: number;
    offset?: number;
    number?: string;
  }) {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;
    const payload = await this.postJson('/sessions/list', {
      start: options.start.toISOString(),
      end: options.end.toISOString(),
      ...(options.open === undefined ? {} : { open: options.open }),
      ...(options.number ? { number: options.number } : {}),
      limit,
      offset,
    });
    return parseChatProSessionList(payload).slice(0, limit);
  }

  /** Reloads one session after an assignment change; partial payloads are rejected by verification. */
  async getSession(sessionId: string) {
    const payload = await this.postJson('/sessions/getSessionById', {
      sessionId,
    });
    const session = parseChatProSessionResult(payload);
    return session?.id === sessionId ? session : null;
  }

  /** Lists configured departments so queue ids can be checked before a send. */
  async listDepartments() {
    const payload = await this.postJson('/departments/list', {});
    const rows = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object' && !Array.isArray(payload)
        ? Object.values(payload as Record<string, unknown>).find(Array.isArray) ?? []
        : [];
    return rows.flatMap((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return [];
      }
      const raw = value as Record<string, unknown>;
      return typeof raw.id === 'string' && raw.id.trim()
        ? [{ id: raw.id.trim(), name: typeof raw.name === 'string' ? raw.name : null, raw }]
        : [];
    });
  }

  /**
   * Lists messages of one inbox session.
   */
  async listMessages(sessionId: string, options?: { maxMessages?: number }) {
    const messages = [];
    let offset = 0;
    const limit = 100;
    const cap = options?.maxMessages ?? 500;

    while (offset < cap) {
      const payload = await this.postJson('/messages/getAll', {
        sessionId,
        limit,
        offset,
      });
      const page = parseChatProMessageList(payload, sessionId);
      messages.push(...page);
      if (page.length < limit) {
        break;
      }
      offset += limit;
    }

    return messages.slice(0, cap);
  }

  /** Reads the provider status of one sent message from ChatPro's message history. */
  async getMessageDeliveryStatus(sessionId: string, messageId: string) {
    const messages = await this.listMessages(sessionId, { maxMessages: 500 });
    const message = messages.find((candidate) => candidate.id === messageId);
    if (!message) {
      return null;
    }
    const status = typeof message.raw.status === 'number' ? message.raw.status : null;
    return {
      status,
      error: typeof message.raw.error_message === 'string'
        ? message.raw.error_message
        : typeof message.raw.error === 'string' ? message.raw.error : null,
    };
  }

  /**
   * Sends a session text on Cloud. Used only for the after-hours notice.
   * Throws in sandbox so a logic bug cannot hit WhatsApp.
   */
  async sendSessionMessage(options: {
    sessionId: string;
    message: string;
    provider: string;
  }) {
    if (isAfterHoursSandbox()) {
      throw new Error('sandbox_blocks_whatsapp_send');
    }
    const payload = await this.postJson('/messages/sendMessage', {
      sessionId: options.sessionId,
      message: options.message,
      provider: options.provider,
    });
    return {
      payload,
      messageId: parseChatProSentMessageId(payload, options.sessionId),
    };
  }

  /**
   * Puts the session back in "aguardando atendimento" after a bot send.
   * `assing_to` is ChatPro's own typo for the attendant field and only an empty string clears it.
   */
  async returnSessionToWaiting(options: {
    sessionId: string;
    departmentId: string;
  }) {
    if (isAfterHoursSandbox()) {
      throw new Error('sandbox_blocks_whatsapp_send');
    }
    return this.postJson('/sessions/assignDepartment', {
      sessionId: options.sessionId,
      department_id: options.departmentId,
      unassign: true,
    });
  }
}
