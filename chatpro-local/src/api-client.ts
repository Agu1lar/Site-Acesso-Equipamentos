import { describeWorkerError, RemoteApiError } from './diagnostics.js';
import type { WorkerErrorDescription } from './diagnostics.js';

export type RemoteOutboxEvent = {
  outboxId: number;
  messageId: number;
  externalId: string;
  leadId: number | null;
  phoneKey: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type RemoteEventsResponse = {
  since: number;
  nextSince: number;
  count: number;
  claimed?: boolean;
  events: RemoteOutboxEvent[];
};

export type RemoteLeadContext = {
  lead: {
    id: number;
    name: string;
    status: string;
    equipmentName: string | null;
    city: string | null;
    message: string | null;
    utmCampaign: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    gclid: string | null;
  };
  messages: {
    id: number;
    fromMe: boolean;
    messageText: string | null;
    mediaType: string | null;
    mediaFilename: string | null;
    mediaMimetype: string | null;
    mediaUrl: string | null;
    eventAt: string | null;
  }[];
  messageCount: number;
  lastMessageId: number | null;
  priorEvaluation: {
    lastMessageId: number | null;
    messageCount: number;
    evaluatedAt: string | null;
    result: Record<string, unknown>;
  } | null;
};

type RemoteOperation =
  | 'ack_events'
  | 'dashboard_network_heartbeat'
  | 'fetch_events'
  | 'fetch_lead_context'
  | 'fetch_summary'
  | 'submit_evaluation';

export function safeResponsePreview(body: string) {
  return body
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/giu, 'Bearer [redacted]')
    .replace(/sk-(?:ant-)?[A-Za-z0-9_-]{12,}/giu, '[redacted-key]')
    .replace(/("(?:token|secret|password|authorization|apiKey)"\s*:\s*")[^"]+/giu, '$1[redacted]')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 400);
}

function httpFailureDescription(status: number): Pick<
  WorkerErrorDescription,
  'action' | 'category' | 'retryable' | 'summary'
> {
  if (status === 401 || status === 403) {
    return {
      category: 'authentication',
      summary: `O servidor recusou a autorização HTTP ${status}.`,
      action: status === 401
        ? 'Confira se INTERNAL_API_SECRET local é o mesmo configurado na Vercel.'
        : 'Confira a autorização; em contexto de lead, 403 também pode indicar lead inelegível.',
      retryable: false,
    };
  }
  if (status === 404) {
    return {
      category: 'not_found',
      summary: 'A rota do ChatPro local não existe neste ambiente (HTTP 404).',
      action: 'Confira CHATPRO_LOCAL_API_URL e se o deploy contém as rotas internas atuais.',
      retryable: false,
    };
  }
  if (status === 408 || status === 429) {
    return {
      category: status === 429 ? 'rate_limit' : 'timeout',
      summary: status === 429
        ? 'O servidor limitou temporariamente as requisições (HTTP 429).'
        : 'O servidor excedeu o tempo da requisição (HTTP 408).',
      action: 'O worker tentará novamente no próximo ciclo.',
      retryable: true,
    };
  }
  if (status >= 500) {
    return {
      category: 'remote_server',
      summary: `O servidor remoto falhou (HTTP ${status}).`,
      action: 'Confira o deploy/banco se persistir; o worker tentará novamente.',
      retryable: true,
    };
  }
  return {
    category: 'invalid_response',
    summary: `O servidor rejeitou a requisição (HTTP ${status}).`,
    action: 'Confira a resposta segura e o contrato da rota antes de repetir manualmente.',
    retryable: false,
  };
}

export class ChatProRemoteApi {
  private readonly baseUrl: string;
  private readonly secret: string;

  constructor(
    baseUrl: string,
    secret: string,
  ) {
    this.baseUrl = baseUrl;
    this.secret = secret;
  }

  private headers() {
    return {
      authorization: `Bearer ${this.secret}`,
      'content-type': 'application/json',
    };
  }

  private async requestJson<T>(options: {
    operation: RemoteOperation;
    path: string;
    method?: 'GET' | 'POST';
    body?: Record<string, unknown>;
  }): Promise<T> {
    const method = options.method ?? 'GET';
    const url = new URL(options.path, this.baseUrl);
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: this.headers(),
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      const described = describeWorkerError(error);
      throw new RemoteApiError({
        ...described,
        code: `${options.operation}_${described.code}`,
        operation: options.operation,
        method,
        endpoint: url.pathname,
        cause: error,
      });
    }

    const responseText = await response.text();
    if (!response.ok) {
      const description = httpFailureDescription(response.status);
      throw new RemoteApiError({
        code: `${options.operation}_http_${response.status}`,
        ...description,
        operation: options.operation,
        method,
        endpoint: url.pathname,
        status: response.status,
        responsePreview: safeResponsePreview(responseText),
      });
    }

    try {
      return JSON.parse(responseText) as T;
    } catch (error) {
      throw new RemoteApiError({
        code: `${options.operation}_invalid_json`,
        category: 'invalid_response',
        summary: 'O servidor respondeu com conteúdo inválido para esta rota.',
        action: 'Confira se a URL aponta para a aplicação correta e se o deploy retornou JSON.',
        retryable: true,
        operation: options.operation,
        method,
        endpoint: url.pathname,
        status: response.status,
        responsePreview: safeResponsePreview(responseText),
        cause: error,
      });
    }
  }

  /** Pulls pending outbox events from production (claims a lease when consumerId is set). */
  async fetchEvents(since: number, limit = 50, consumerId?: string) {
    const url = new URL('/api/internal/v1/chatpro-roi/events', this.baseUrl);
    url.searchParams.set('since', String(since));
    url.searchParams.set('limit', String(limit));
    if (consumerId) {
      url.searchParams.set('consumerId', consumerId);
    }

    return this.requestJson<RemoteEventsResponse>({
      operation: 'fetch_events',
      path: `${url.pathname}${url.search}`,
    });
  }

  /** Acknowledges events persisted in the local SQLite queue. */
  async ackEvents(outboxIds: number[]) {
    return this.requestJson<{ acked: number }>({
      operation: 'ack_events',
      path: '/api/internal/v1/chatpro-roi/events',
      method: 'POST',
      body: { outboxIds },
    });
  }

  /** Posts a Claude evaluation back to Neon. */
  async submitEvaluation(body: Record<string, unknown>) {
    return this.requestJson<{ ok: boolean; evaluationId?: number; duplicate?: boolean }>({
      operation: 'submit_evaluation',
      path: '/api/internal/v1/chatpro-roi/evaluations',
      method: 'POST',
      body,
    });
  }

  /** Loads full lead + ChatPro thread for Claude analysis. */
  async fetchLeadContext(leadId: number) {
    return this.requestJson<RemoteLeadContext>({
      operation: 'fetch_lead_context',
      path: `/api/internal/v1/chatpro-roi/leads/${leadId}/context`,
    });
  }

  /** Loads the read-only ChatPro ROI pipeline summary. */
  async fetchSummary<T>(limit = 10) {
    return this.requestJson<T>({
      operation: 'fetch_summary',
      path: `/api/internal/v1/chatpro-roi/summary?limit=${limit}`,
    });
  }

  /** Renews this PC's public IP as a trusted dashboard network. */
  async renewDashboardNetwork(body: { deviceId: string; label: string; ttlHours: number }) {
    return this.requestJson<{
      ok: boolean;
      ipAddress: string;
      expiresAt: string;
    }>({
      operation: 'dashboard_network_heartbeat',
      path: '/api/internal/v1/dashboard-network/heartbeat',
      method: 'POST',
      body,
    });
  }
}
