export type WorkerErrorCategory =
  | 'authentication'
  | 'configuration'
  | 'invalid_response'
  | 'network'
  | 'not_found'
  | 'rate_limit'
  | 'remote_server'
  | 'timeout'
  | 'unknown';

export type WorkerErrorDescription = {
  code: string;
  category: WorkerErrorCategory;
  summary: string;
  action: string;
  retryable: boolean;
  operation?: string;
  method?: string;
  endpoint?: string;
  status?: number;
  causeCode?: string;
  responsePreview?: string;
};

type RemoteApiErrorOptions = WorkerErrorDescription & {
  cause?: unknown;
};

/** Carries safe remote request diagnostics without headers or credentials. */
export class RemoteApiError extends Error {
  readonly details: WorkerErrorDescription;

  constructor(options: RemoteApiErrorOptions) {
    super(options.code, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'RemoteApiError';
    this.details = {
      code: options.code,
      category: options.category,
      summary: options.summary,
      action: options.action,
      retryable: options.retryable,
      operation: options.operation,
      method: options.method,
      endpoint: options.endpoint,
      status: options.status,
      causeCode: options.causeCode,
      responsePreview: options.responsePreview,
    };
  }
}

function unknownErrorCode(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const directCode = Reflect.get(error, 'code');
  if (typeof directCode === 'string') {
    return directCode;
  }
  const cause = Reflect.get(error, 'cause');
  if (typeof cause !== 'object' || cause === null) {
    return undefined;
  }
  const causeCode = Reflect.get(cause, 'code');
  return typeof causeCode === 'string' ? causeCode : undefined;
}

function unknownErrorName(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return '';
  }
  const name = Reflect.get(error, 'name');
  return typeof name === 'string' ? name : '';
}

function unknownErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function knownLocalError(message: string): WorkerErrorDescription | null {
  if (message === 'anthropic_auth_invalid') {
    return {
      code: message,
      category: 'authentication',
      summary: 'A chave da Anthropic foi recusada.',
      action: 'Atualize ANTHROPIC_API_KEY em chatpro-local/.env e reinicie o worker.',
      retryable: false,
    };
  }
  if (message === 'anthropic_not_configured' || message.includes('ANTHROPIC_API_KEY is required')) {
    return {
      code: 'anthropic_not_configured',
      category: 'configuration',
      summary: 'A chave da Anthropic não está configurada.',
      action: 'Configure ANTHROPIC_API_KEY em chatpro-local/.env e reinicie o worker.',
      retryable: false,
    };
  }
  if (message === 'worker_already_running') {
    return {
      code: message,
      category: 'configuration',
      summary: 'Já existe outro ChatPro local usando esta fila SQLite.',
      action: 'Feche a outra instância ou use npm run status; não mantenha dois workers na mesma fila.',
      retryable: false,
    };
  }
  if (/^[A-Z][A-Z0-9_]+ is required$/u.test(message)) {
    return {
      code: 'config_required',
      category: 'configuration',
      summary: `Configuração ausente: ${message.replace(' is required', '')}.`,
      action: 'Confira chatpro-local/.env e reinicie o worker.',
      retryable: false,
    };
  }
  if (message === 'anthropic_incomplete_response' || message === 'anthropic_empty_response') {
    return {
      code: message,
      category: 'invalid_response',
      summary: 'Claude respondeu de forma incompleta.',
      action: 'O lead continuará na fila e será tentado novamente.',
      retryable: true,
    };
  }
  if (message === 'media_url_not_allowed' || message === 'media_invalid_mimetype') {
    return {
      code: message,
      category: 'configuration',
      summary: 'Uma mídia do atendimento foi bloqueada pela política local.',
      action: 'Confira o host e o tipo do arquivo antes de alterar CHATPRO_PDF_URL_ALLOWLIST.',
      retryable: false,
    };
  }
  return null;
}

/** Converts unknown failures into safe, actionable terminal diagnostics. */
export function describeWorkerError(error: unknown): WorkerErrorDescription {
  if (error instanceof RemoteApiError) {
    return error.details;
  }

  const message = unknownErrorMessage(error);
  const known = knownLocalError(message);
  if (known) {
    return known;
  }

  const causeCode = unknownErrorCode(error);
  const errorName = unknownErrorName(error);
  if (errorName === 'TimeoutError' || errorName === 'AbortError') {
    return {
      code: 'request_timeout',
      category: 'timeout',
      summary: 'A operação excedeu o tempo limite.',
      action: 'O worker tentará novamente no próximo ciclo.',
      retryable: true,
      causeCode,
    };
  }

  if (causeCode === 'ENOTFOUND') {
    return {
      code: 'dns_not_found',
      category: 'network',
      summary: 'O endereço do servidor não pôde ser encontrado no DNS.',
      action: 'Confira a internet e CHATPRO_LOCAL_API_URL.',
      retryable: true,
      causeCode,
    };
  }
  if (causeCode === 'ECONNREFUSED') {
    return {
      code: 'connection_refused',
      category: 'network',
      summary: 'O servidor recusou a conexão.',
      action: 'Confira se a URL/servidor está ativo; o worker tentará novamente.',
      retryable: true,
      causeCode,
    };
  }
  if (causeCode === 'ECONNRESET' || causeCode === 'UND_ERR_SOCKET') {
    return {
      code: 'connection_reset',
      category: 'network',
      summary: 'A conexão foi interrompida durante a requisição.',
      action: 'Normalmente é transitório; o worker tentará novamente.',
      retryable: true,
      causeCode,
    };
  }
  if (message === 'fetch failed') {
    return {
      code: 'fetch_failed',
      category: 'network',
      summary: 'Não foi possível conectar ao servidor remoto.',
      action: 'Confira a internet e a URL; o worker tentará novamente.',
      retryable: true,
      causeCode,
    };
  }

  return {
    code: message.slice(0, 160) || 'unknown_error',
    category: 'unknown',
    summary: 'O worker encontrou uma falha não classificada.',
    action: 'Use npm run status e consulte o código/categoria abaixo.',
    retryable: true,
    causeCode,
  };
}

function detailLines(description: WorkerErrorDescription, context: Record<string, unknown>) {
  const details: Record<string, unknown> = {
    categoria: description.category,
    codigo: description.code,
    repetira: description.retryable ? 'sim' : 'não',
    ...context,
  };
  if (description.operation) {
    details.operacao = description.operation;
  }
  if (description.method && description.endpoint) {
    details.endpoint = `${description.method} ${description.endpoint}`;
  }
  if (description.status) {
    details.http = description.status;
  }
  if (description.causeCode) {
    details.causa = description.causeCode;
  }
  if (description.responsePreview) {
    details.resposta = description.responsePreview;
  }
  return details;
}

/** Prints a concise error followed by safe diagnostic fields and next action. */
export function logWorkerError(
  event: string,
  error: unknown,
  context: Record<string, unknown> = {},
) {
  const description = describeWorkerError(error);
  console.error(`[chatpro-local] ERRO ${event} — ${description.summary}`);
  console.error('  detalhes:', detailLines(description, context));
  console.error(`  ação: ${description.action}`);
  return description;
}

/** Prints a warning with a stable event name and bounded structured context. */
export function logWorkerWarning(event: string, summary: string, context: Record<string, unknown> = {}) {
  console.warn(`[chatpro-local] AVISO ${event} — ${summary}`, context);
}
