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
  messages: Array<{
    id: number;
    fromMe: boolean;
    messageText: string | null;
    mediaType: string | null;
    mediaFilename: string | null;
    mediaMimetype: string | null;
    mediaUrl: string | null;
    eventAt: string | null;
  }>;
  messageCount: number;
  lastMessageId: number | null;
  priorEvaluation: {
    lastMessageId: number | null;
    messageCount: number;
    evaluatedAt: string | null;
    result: Record<string, unknown>;
  } | null;
};

export class ChatProRemoteApi {
  constructor(
    private readonly baseUrl: string,
    private readonly secret: string,
  ) {}

  private headers() {
    return {
      authorization: `Bearer ${this.secret}`,
      'content-type': 'application/json',
    };
  }

  /** Pulls pending outbox events from production (claims a lease when consumerId is set). */
  async fetchEvents(since: number, limit = 50, consumerId?: string) {
    const url = new URL('/api/internal/v1/chatpro-roi/events', this.baseUrl);
    url.searchParams.set('since', String(since));
    url.searchParams.set('limit', String(limit));
    if (consumerId) {
      url.searchParams.set('consumerId', consumerId);
    }

    const response = await fetch(url, {
      headers: this.headers(),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`fetch_events_failed:${response.status}`);
    }

    return (await response.json()) as RemoteEventsResponse;
  }

  /** Acknowledges events persisted in the local SQLite queue. */
  async ackEvents(outboxIds: number[]) {
    const response = await fetch(
      new URL('/api/internal/v1/chatpro-roi/events', this.baseUrl),
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ outboxIds }),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!response.ok) {
      throw new Error(`ack_events_failed:${response.status}`);
    }

    return (await response.json()) as { acked: number };
  }

  /** Posts a Claude evaluation back to Neon. */
  async submitEvaluation(body: Record<string, unknown>) {
    const response = await fetch(
      new URL('/api/internal/v1/chatpro-roi/evaluations', this.baseUrl),
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!response.ok) {
      throw new Error(`submit_evaluation_failed:${response.status}`);
    }

    return (await response.json()) as { ok: boolean; evaluationId?: number; duplicate?: boolean };
  }

  /** Loads full lead + ChatPro thread for Claude analysis. */
  async fetchLeadContext(leadId: number) {
    const response = await fetch(
      new URL(`/api/internal/v1/chatpro-roi/leads/${leadId}/context`, this.baseUrl),
      {
        headers: this.headers(),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!response.ok) {
      throw new Error(`fetch_lead_context_failed:${response.status}`);
    }

    return (await response.json()) as RemoteLeadContext;
  }

  /** Renews this PC's public IP as a trusted dashboard network. */
  async renewDashboardNetwork(body: { deviceId: string; label: string; ttlHours: number }) {
    const response = await fetch(
      new URL('/api/internal/v1/dashboard-network/heartbeat', this.baseUrl),
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!response.ok) {
      throw new Error(`dashboard_network_heartbeat_failed:${response.status}`);
    }

    return (await response.json()) as {
      ok: boolean;
      ipAddress: string;
      expiresAt: string;
    };
  }
}
