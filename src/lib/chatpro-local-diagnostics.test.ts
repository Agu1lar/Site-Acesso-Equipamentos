import { describe, expect, it } from 'vitest';
import { safeResponsePreview } from '../../chatpro-local/src/api-client';
import { describeWorkerError, RemoteApiError } from '../../chatpro-local/src/diagnostics';

describe('ChatPro local diagnostics', () => {
  it('preserves typed remote request context', () => {
    const error = new RemoteApiError({
      code: 'fetch_events_http_500',
      category: 'remote_server',
      summary: 'Servidor remoto falhou.',
      action: 'Tentar novamente.',
      retryable: true,
      operation: 'fetch_events',
      method: 'GET',
      endpoint: '/api/internal/v1/chatpro-roi/events',
      status: 500,
    });

    expect(describeWorkerError(error)).toMatchObject({
      code: 'fetch_events_http_500',
      category: 'remote_server',
      operation: 'fetch_events',
      status: 500,
      retryable: true,
    });
  });

  it('explains a DNS fetch failure', () => {
    const cause = Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' });
    const error = new TypeError('fetch failed', { cause });

    expect(describeWorkerError(error)).toMatchObject({
      code: 'dns_not_found',
      category: 'network',
      causeCode: 'ENOTFOUND',
      retryable: true,
    });
  });

  it('redacts credentials from response previews', () => {
    const preview = safeResponsePreview(JSON.stringify({
      authorization: 'Bearer private-token',
      apiKey: 'sk-ant-api03-super-secret-value',
    }));

    expect(preview).not.toContain('private-token');
    expect(preview).not.toContain('super-secret-value');
    expect(preview).toContain('[redacted]');
  });
});
