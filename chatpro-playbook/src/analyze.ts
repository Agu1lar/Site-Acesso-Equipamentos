import type { Pool } from 'pg';
import type { AttendanceTeam } from './attendance-team.js';
import {
  listThreadSummaries,
  upsertThreadSummary,
  type MessageRow,
  type SessionRow,
} from './db.js';
import { redactCustomerPii } from './redact.js';
import {
  buildModulePlanOutputSchema,
  buildPlaybookOutputSchema,
  buildThreadSummaryOutputSchema,
  CommercialPlaybookSchema,
  ModulePlanSchema,
  ThreadSummaryBatchSchema,
  prepareCommercialPlaybook,
  sanitizeCommercialPlaybook,
  type CommercialPlaybook,
  type ModulePlan,
} from './schema.js';
import {
  formatPlaybookSummaryThread,
  selectPlaybookSummaryMessages,
} from './thread-summary.js';
import { pickSummariesForPlaybook } from './playbook-learn.js';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

type ClaudeResponse = {
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: string;
  error?: { message?: string };
};

function teamAnalyzeLabel(team: AttendanceTeam) {
  if (team === 'logistica') {
    return 'logística (troca, devolução, programação)';
  }
  if (team === 'mecanica') {
    return 'mecânica (chamado, plataformas, andaimes, ferramentas)';
  }
  return 'comercial (locação e orçamento)';
}

function teamAnalyzeFocus(team: AttendanceTeam) {
  if (team === 'logistica') {
    return 'Foque em troca, devolução, coleta e programação. Ignore orçamento de locação.';
  }
  if (team === 'mecanica') {
    return 'Foque em chamado, sintoma e encaminhamento. Não invente diagnóstico nem peça.';
  }
  return 'Foque em locação, objeção, frete (sem cravar valor) e negociação humanizada.';
}

function teamPlaybookFocus(team: AttendanceTeam) {
  if (team === 'logistica') {
    return 'Este playbook é da logística: troca, devolução e programação. Não misture venda de locação.';
  }
  if (team === 'mecanica') {
    return 'Este playbook é da mecânica: triagem de chamado. Não misture orçamento nem invente conserto.';
  }
  return 'Este playbook é do comercial: locação e orçamento. Não misture troca, devolução nem reparo.';
}

function chunkThreads<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function callClaude(options: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  jsonSchema?: Record<string, unknown>;
}) {
  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
      'x-api-key': options.apiKey,
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: options.maxTokens,
      system: options.system,
      messages: [{ role: 'user', content: options.user }],
      ...(options.jsonSchema
        ? {
            output_config: {
              format: {
                type: 'json_schema',
                schema: options.jsonSchema,
              },
            },
          }
        : {}),
    }),
    signal: AbortSignal.timeout(180_000),
  });

  const payload = (await response.json()) as ClaudeResponse;
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('anthropic_auth_invalid');
    }
    throw new Error(payload.error?.message || 'anthropic_request_failed');
  }
  if (payload.stop_reason === 'max_tokens') {
    throw new Error('anthropic_incomplete_response');
  }
  const text = payload.content?.find((block) => block.type === 'text')?.text;
  if (!text) {
    throw new Error('anthropic_empty_response');
  }
  return text;
}

export type PlaybookAnalysis = {
  playbook: CommercialPlaybook;
  modulePlan: ModulePlan;
};

const EMPTY_MODULE_PLAN: ModulePlan = { upsert: [], remove: [] };

type ThreadSummaryNote = {
  sessionId: string;
  summary: string;
};

type PendingSummary = {
  ref: string;
  sessionId: string;
  lastMessageId: string;
  messageCount: number;
  sourceKey: string;
  priorSummary: string | null;
  payload: string;
};

function compactMessages(messages: MessageRow[]) {
  return messages
    .filter((message) => !message.bot_origin)
    .map((message) => ({
      id: message.id,
      from_me: message.from_me,
      body: message.body ? redactCustomerPii(message.body) : null,
      media_type: message.media_type,
      media_text: message.media_text ? redactCustomerPii(message.media_text) : null,
    }));
}

async function refreshThreadSummaries(options: {
  pool: Pool;
  apiKey: string;
  model: string;
  team: AttendanceTeam;
  threads: Array<{ session: SessionRow; messages: MessageRow[] }>;
}): Promise<ThreadSummaryNote[]> {
  const stored = await listThreadSummaries({
    pool: options.pool,
    team: options.team,
    sessionIds: options.threads.map((thread) => thread.session.id),
  });
  const bySession = new Map(stored.map((row) => [row.session_id, row]));
  const notes: ThreadSummaryNote[] = [];
  const pending: PendingSummary[] = [];
  let refIndex = 0;

  for (const thread of options.threads) {
    const prior = bySession.get(thread.session.id) ?? null;
    const compact = compactMessages(thread.messages);
    const selection = selectPlaybookSummaryMessages({
      messages: compact,
      lastMessageId: prior?.last_message_id ?? null,
      sourceKey: prior?.source_key ?? null,
    });
    if (selection.mode === 'unchanged' && prior) {
      notes.push({ sessionId: thread.session.id, summary: prior.summary });
      continue;
    }
    refIndex += 1;
    const ref = `T${refIndex}`;
    pending.push({
      ref,
      sessionId: thread.session.id,
      lastMessageId: compact.at(-1)?.id ?? thread.session.id,
      messageCount: thread.messages.length,
      sourceKey: selection.sourceKey,
      priorSummary: prior?.summary ?? null,
      payload: formatPlaybookSummaryThread({
        ref,
        priorSummary: prior?.summary ?? null,
        selection,
        contactName: thread.session.contact_name
          ? redactCustomerPii(thread.session.contact_name)
          : null,
      }),
    });
  }

  console.log('[chatpro-playbook] resumos', {
    equipe: options.team,
    reuso: notes.length,
    haiku: pending.length,
  });

  const teamLabel = teamAnalyzeLabel(options.team);
  for (const [index, batch] of chunkThreads(pending, 6).entries()) {
    console.log('[chatpro-playbook] haiku resumo', {
      equipe: options.team,
      lote: index + 1,
      sessoes: batch.length,
    });
    try {
      const text = await callClaude({
        apiKey: options.apiKey,
        model: options.model,
        maxTokens: 2500,
        jsonSchema: buildThreadSummaryOutputSchema(),
        system: [
          `Você resume atendimento de ${teamLabel} da Acesso Equipamentos (MG).`,
          'Não copie só o início da conversa. Conte o arco: problema, o que a equipe fez, resultado.',
          'Cada items[].summary no formato:',
          'Tipo: qualificacao | negociacao | objecao | frete | logistica | mecanica | follow-up | transferencia | outro',
          'Situação: o que o cliente precisava e qual dificuldade apareceu.',
          'O que a equipe fez: jeito humanizado, ou o que faltou.',
          'Resultado: andamento, aguardando, proposta, transferido, parado, ou fechamento só se estiver explícito.',
          'Lição: o que isso ensina sobre como a Acesso opera e como atender melhor. Nunca cravar preço nem frete.',
          'Preço: só se alguém citou diária, mês ou pacote — senão "não citado".',
          'Dias: prazo de locação citado — senão "não citado".',
          'Frete: valor ou prazo de entrega citado — senão "não citado".',
          'Oportunidade: fria | qualificacao | proposta | negociacao | quente | em-risco | perdida | fechada.',
          'Se houver resumo anterior, atualize só com as mensagens novas.',
          teamAnalyzeFocus(options.team),
        ].join(' '),
        user: [
          `Lote ${index + 1}. JSON items[].ref e items[].summary. Recorte é abertura + desfecho, não a transcrição inteira.`,
          batch.map((item) => item.payload).join('\n\n----\n\n'),
        ].join('\n\n'),
      });
      const parsed = ThreadSummaryBatchSchema.parse(JSON.parse(text));
      const byRef = new Map(parsed.items.map((item) => [item.ref, item.summary.trim()]));
      for (const item of batch) {
        const summary = redactCustomerPii(byRef.get(item.ref) || item.priorSummary || '').trim();
        if (!summary) {
          continue;
        }
        await upsertThreadSummary({
          pool: options.pool,
          sessionId: item.sessionId,
          team: options.team,
          lastMessageId: item.lastMessageId,
          messageCount: item.messageCount,
          sourceKey: item.sourceKey,
          summary,
        });
        notes.push({ sessionId: item.sessionId, summary });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[chatpro-playbook] resumo falhou', { team: options.team, message });
      for (const item of batch) {
        if (item.priorSummary) {
          notes.push({ sessionId: item.sessionId, summary: redactCustomerPii(item.priorSummary) });
        }
      }
    }
  }

  return notes;
}

async function proposeModulePlan(options: {
  apiKey: string;
  model: string;
  team: AttendanceTeam;
  notes: string[];
  playbook: CommercialPlaybook;
  existing: Array<{ id: string; title: string; excerpt: string }>;
}): Promise<ModulePlan> {
  const catalog = options.existing.length === 0
    ? 'Nenhum módulo ainda.'
    : options.existing.map((module) => `- ${module.id} | ${module.title} | ${module.excerpt}`).join('\n');
  const text = await callClaude({
    apiKey: options.apiKey,
    model: options.model,
    maxTokens: 12000,
    jsonSchema: buildModulePlanOutputSchema(),
    system: [
      'Você mantém módulos operacionais no Obsidian a partir de como a equipe REALMENTE resolveu as conversas.',
      teamPlaybookFocus(options.team),
      'Aprenda com a resolução: o que o consultor fez, o que destravou o cliente, o que falhou. Não copie teoria de vendas.',
      'Se já existe módulo para o mesmo problema, faça upsert no MESMO id e reescreva o body com a evidência nova.',
      'Crie módulo novo só se o padrão aparecer em pelo menos 2 leads ou for um fluxo claro (tesoura, andaime tubo e braçadeira, frete-processo, follow-up, chamado). Não crie módulo de PF/PJ nem de tabela de preço.',
      'Cada body em markdown: ## Quando usar / ## Como a equipe resolve / ## O que o bot pode dizer / ## O que não fazer.',
      'O que o bot pode dizer: só triagem (tipo do catálogo, cidade, para quando começa, quantos dias). Nunca PF/PJ, CNPJ, tabela, valor, orço, envio proposta, fico à disposição, liga agora. Fora do expediente o telefone não é atendido.',
      'Como a equipe resolve pode descrever o comercial no horário útil. Não ensine o bot a pedir documento.',
      'Neste ciclo: no máximo 4 upserts e 2 removes. Não reescreva o catálogo inteiro; só o que a evidência nova mudou. Apague duplicata de frete, follow-up ou PF/PJ.',
      'Não apague só por falta de exemplo neste lote. remove só com evidência de que o fluxo morreu ou era invenção.',
      'body curto, sem preço nem frete oficiais. Português do Brasil.',
    ].join(' '),
    user: [
      `Equipe: ${options.team}. Resumo do negócio: ${options.playbook.businessSummary}`,
      'Métodos atuais do playbook (atualize os módulos para bater com eles):',
      options.playbook.methods.map((method) => `- ${method.name}: ${method.whenToUse}`).join('\n') || 'ainda sem métodos',
      `Como a empresa opera: ${options.playbook.workingStyle}`,
      'Módulos já no cofre (reutilize o id se for o mesmo fluxo):',
      catalog,
      'Resumos das conversas (problema → o que a equipe fez → resultado → lição):',
      options.notes.join('\n\n'),
      'Responda JSON com upsert (criar ou reescrever) e remove (ids a apagar).',
    ].join('\n\n'),
  });
  return ModulePlanSchema.parse(JSON.parse(text));
}

/**
 * Builds the playbook from stored lead summaries, like ROI incremental analysis.
 */
export async function analyzeThreadsWithClaude(options: {
  pool: Pool;
  apiKey: string;
  model: string;
  threads: Array<{ session: SessionRow; messages: MessageRow[] }>;
  team?: AttendanceTeam;
  existingModules?: Array<{ id: string; title: string; excerpt: string }>;
  priorPlaybook?: string | null;
}): Promise<PlaybookAnalysis> {
  const team = options.team ?? 'comercial';
  const summaries = await refreshThreadSummaries({
    pool: options.pool,
    apiKey: options.apiKey,
    model: options.model,
    team,
    threads: options.threads,
  });
  const notes = pickSummariesForPlaybook(summaries, 14).map((item, index) => `## Lead ${index + 1}\n${item.summary}`);
  if (notes.length === 0) {
    throw new Error('playbook_summaries_empty');
  }

  const synthesized = await callClaude({
    apiKey: options.apiKey,
    model: options.model,
    maxTokens: 16000,
    jsonSchema: buildPlaybookOutputSchema(),
    system: [
      'Você atualiza o playbook da Acesso Equipamentos a partir de resumos de atendimento real.',
      teamPlaybookFocus(team),
      'Aprenda com as resoluções: o que a equipe fez, o que funcionou, o que travou. workingStyle descreve como a empresa realmente atende (sequência observada), não um texto institucional.',
      'A nota humana do cofre vence o playbook gerado. Não contradiga essa nota.',
      'methods: atualize os fluxos observados (qualificação, objeção, frete sem cravar valor, follow-up, chamado). Não jogue fora um método que ainda aparece nas conversas.',
      'methods e caseNotes: nunca escreva R$, reais, tabela de diária nem prazo de frete. Descreva o jeito (pedir cidade, passar ao comercial).',
      'methods.paraphraseExample: voz da triagem noturna — cidade, para quando começa e prazo em dias. Nunca PF/PJ, CNPJ, orço, envio proposta, fico à disposição, liga agora.',
      'caseNotes: exemplos anônimos com problemType, situation, teamMove, outcome, humanizedTip — o teamMove é o jeito que o consultor resolveu. Sem CNPJ, sem nome próprio, sem endereço com número.',
      'gaps: o que o time ainda não cobre bem. improvements7days: melhorias concretas a partir dessas lacunas. Tratamento do bot: cidade, para quando começa e prazo, nunca documento.',
      'capturedValues e opportunities: só o que foi citado; isOfficial sempre false. customerHint sem CNPJ e sem nome. Esses campos não vão para o bot.',
      'observedHeuristics: hábitos da equipe, sem preço, frete, estoque nem fechamento. Não gere regra que permita cravar valor se explicar a composição.',
      'As regras de segurança são fixas no código. Não as reescreva.',
      'Tom: arte de negociar com empatia. Nunca cravar preço, frete nem estoque.',
      'Campos curtos: no máximo duas frases por string, exceto caseNotes.',
      'Exatamente 7 melhorias. Português do Brasil.',
    ].join(' '),
    user: [
      options.priorPlaybook
        ? `Playbook atual (atualize em cima disto; não apague o que ainda vale). A nota humana vence o restante:\n${options.priorPlaybook}`
        : 'Ainda não há playbook no cofre. Monte o primeiro a partir dos resumos.',
      'Resumos persistidos (problema → ação da equipe → resultado → lição):',
      notes.join('\n\n'),
    ].join('\n\n'),
  });

  const parsed: unknown = JSON.parse(synthesized);
  const playbook = sanitizeCommercialPlaybook(
    CommercialPlaybookSchema.parse(prepareCommercialPlaybook(parsed)),
  );
  let modulePlan = EMPTY_MODULE_PLAN;
  try {
    console.log('[chatpro-playbook] haiku módulos', { equipe: team, existentes: options.existingModules?.length ?? 0 });
    modulePlan = await proposeModulePlan({
      apiKey: options.apiKey,
      model: options.model,
      team,
      notes,
      playbook,
      existing: options.existingModules ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[chatpro-playbook] módulos falhou', { team, message });
  }
  return { playbook, modulePlan };
}
