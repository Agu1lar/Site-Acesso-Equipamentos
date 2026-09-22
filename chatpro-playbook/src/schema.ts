import { z } from 'zod';
import { redactCustomerPii } from './redact.js';

export const HARD_RULE_NEVER_PRICE =
  'Nunca confirmar valor de locação, diária, mensalidade, desconto ou pacote.';
export const HARD_RULE_NEVER_FREIGHT =
  'Nunca confirmar valor, prazo ou condição de frete, entrega ou logística.';
export const HARD_RULE_MISSING_DATA =
  'Se o dado não estiver no playbook, dizer que vai confirmar com o comercial e retornar. Não inventar.';
export const HARD_RULE_NEVER_AVAILABILITY =
  'Nunca confirmar se o equipamento está disponível, locado, em estoque ou com previsão de retorno. Só dizer se trabalhamos com o tipo.';
export const HARD_RULE_NEVER_CLOSE =
  'Nunca fechar proposta, contrato, reserva ou orçamento. Só triagem inicial; o comercial fecha no horário útil.';
export const HARD_RULE_DISTANT_REGION =
  'Área padrão é BH e a RMBH. Fora disso não confirmar locação: passe os dados ao comercial (em geral plataforma ou Franna, período longo).';

/** Fixed safety rules. Generated playbook text never overrides these. */
export const PLAYBOOK_HARD_RULES = [
  HARD_RULE_NEVER_PRICE,
  HARD_RULE_NEVER_FREIGHT,
  HARD_RULE_NEVER_AVAILABILITY,
  HARD_RULE_NEVER_CLOSE,
  HARD_RULE_MISSING_DATA,
  HARD_RULE_DISTANT_REGION,
] as const;

/** Copies the code hard rules for playbook records and vault notes. */
export function playbookHardRules() {
  return [...PLAYBOOK_HARD_RULES];
}

export const PlaybookMethodSchema = z.object({
  name: z.string().min(3).max(80),
  whenToUse: z.string().min(8).max(400),
  steps: z.array(z.string().min(8).max(240)).min(2).max(8),
  paraphraseExample: z.string().min(8).max(400),
});

export const CapturedValueSchema = z.object({
  equipment: z.string().min(2).max(120),
  mentionedAs: z.string().min(2).max(240),
  conversationHint: z.string().min(8).max(400),
  isOfficial: z.literal(false),
  customerHint: z.string().min(2).max(80),
  rentalDays: z.string().min(1).max(80),
  freightMention: z.string().min(1).max(160),
});

export const OpportunitySchema = z.object({
  title: z.string().min(4).max(80),
  customerHint: z.string().min(2).max(80),
  equipment: z.string().min(2).max(120),
  rentalDays: z.string().min(1).max(80),
  priceMention: z.string().min(1).max(160),
  freightMention: z.string().min(1).max(160),
  stage: z.string().min(3).max(24),
  nextMove: z.string().min(8).max(240),
  whyItMatters: z.string().min(8).max(240),
});

export const PlaybookGapSchema = z.object({
  topic: z.string().min(3).max(80),
  whyMissing: z.string().min(8).max(400),
  treatment: z.string().min(8).max(400),
});

export const PlaybookImprovementSchema = z.object({
  dayOffset: z.number().int().min(1).max(7),
  action: z.string().min(8).max(240),
  why: z.string().min(8).max(400),
});

export const PlaybookCaseNoteSchema = z.object({
  problemType: z.string().min(3).max(80),
  situation: z.string().min(20).max(400),
  teamMove: z.string().min(20).max(400),
  outcome: z.string().min(8).max(240),
  humanizedTip: z.string().min(20).max(400),
});

export const CommercialPlaybookSchema = z.object({
  businessSummary: z.string().min(40).max(1200),
  workingStyle: z.string().min(40).max(1200),
  toneNotes: z.string().min(20).max(800),
  methods: z.array(PlaybookMethodSchema).min(3).max(10),
  capturedValues: z.array(CapturedValueSchema).max(20),
  opportunities: z.array(OpportunitySchema).max(16),
  gaps: z.array(PlaybookGapSchema).min(1).max(12),
  improvements7days: z.array(PlaybookImprovementSchema).length(7),
  hardRules: z.array(z.string().min(8).max(240)).length(PLAYBOOK_HARD_RULES.length),
  observedHeuristics: z.array(z.string().min(8).max(240)).max(8),
  caseNotes: z.array(PlaybookCaseNoteSchema).min(1).max(12),
});

export type CommercialPlaybook = z.infer<typeof CommercialPlaybookSchema>;

export const ModuleUpsertSchema = z.object({
  id: z.string().min(3).max(80),
  title: z.string().min(3).max(80),
  body: z.string().min(40).max(4000),
  reason: z.string().min(8).max(800),
});

export const ModuleRemovalSchema = z.object({
  id: z.string().min(3).max(80),
  reason: z.string().min(8).max(800),
});

export const ModulePlanSchema = z.object({
  upsert: z.array(ModuleUpsertSchema).max(8),
  remove: z.array(ModuleRemovalSchema).max(4),
});

export type ModulePlan = z.infer<typeof ModulePlanSchema>;

export const ThreadSummaryItemSchema = z.object({
  ref: z.string().min(1).max(12),
  summary: z.string().min(16).max(1200),
});

export const ThreadSummaryBatchSchema = z.object({
  items: z.array(ThreadSummaryItemSchema).min(1).max(10),
});

export type ThreadSummaryBatch = z.infer<typeof ThreadSummaryBatchSchema>;

/** JSON schema for incremental lead summaries. */
export function buildThreadSummaryOutputSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['items'],
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['ref', 'summary'],
          properties: {
            ref: { type: 'string' },
            summary: { type: 'string' },
          },
        },
      },
    },
  };
}

/** JSON schema for the living operational-module plan. */
export function buildModulePlanOutputSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['upsert', 'remove'],
    properties: {
      upsert: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'title', 'body', 'reason'],
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            body: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      },
      remove: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'reason'],
          properties: {
            id: { type: 'string' },
            reason: { type: 'string' },
          },
        },
      },
    },
  };
}

/** JSON schema for Claude structured output. */
export function buildPlaybookOutputSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'businessSummary',
      'workingStyle',
      'toneNotes',
      'methods',
      'capturedValues',
      'opportunities',
      'gaps',
      'improvements7days',
      'observedHeuristics',
      'caseNotes',
    ],
    properties: {
      businessSummary: { type: 'string' },
      workingStyle: { type: 'string' },
      toneNotes: { type: 'string' },
      methods: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'whenToUse', 'steps', 'paraphraseExample'],
          properties: {
            name: { type: 'string' },
            whenToUse: { type: 'string' },
            steps: { type: 'array', items: { type: 'string' } },
            paraphraseExample: { type: 'string' },
          },
        },
      },
      capturedValues: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'equipment',
            'mentionedAs',
            'conversationHint',
            'isOfficial',
            'customerHint',
            'rentalDays',
            'freightMention',
          ],
          properties: {
            equipment: { type: 'string' },
            mentionedAs: { type: 'string' },
            conversationHint: { type: 'string' },
            isOfficial: { type: 'boolean', const: false },
            customerHint: { type: 'string' },
            rentalDays: { type: 'string' },
            freightMention: { type: 'string' },
          },
        },
      },
      opportunities: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'title',
            'customerHint',
            'equipment',
            'rentalDays',
            'priceMention',
            'freightMention',
            'stage',
            'nextMove',
            'whyItMatters',
          ],
          properties: {
            title: { type: 'string' },
            customerHint: { type: 'string' },
            equipment: { type: 'string' },
            rentalDays: { type: 'string' },
            priceMention: { type: 'string' },
            freightMention: { type: 'string' },
            stage: { type: 'string' },
            nextMove: { type: 'string' },
            whyItMatters: { type: 'string' },
          },
        },
      },
      gaps: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['topic', 'whyMissing', 'treatment'],
          properties: {
            topic: { type: 'string' },
            whyMissing: { type: 'string' },
            treatment: { type: 'string' },
          },
        },
      },
      improvements7days: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['dayOffset', 'action', 'why'],
          properties: {
            dayOffset: { type: 'integer' },
            action: { type: 'string' },
            why: { type: 'string' },
          },
        },
      },
      observedHeuristics: { type: 'array', items: { type: 'string' } },
      caseNotes: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['problemType', 'situation', 'teamMove', 'outcome', 'humanizedTip'],
          properties: {
            problemType: { type: 'string' },
            situation: { type: 'string' },
            teamMove: { type: 'string' },
            outcome: { type: 'string' },
            humanizedTip: { type: 'string' },
          },
        },
      },
    },
  };
}

const MONEY_SPAN =
  /r\$\s*[\d.][\d.,]*|\b\d{1,6}(?:[.,]\d{2,3})?\s*reais\b|\b(?:vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|duzentos|trezentos)\s+reais\b/giu;
const DAILY_WITH_NUMBER = /\bdi[áa]ria\b[^.\n]{0,32}\d[\d.,]*/giu;
const FREIGHT_WITH_NUMBER = /\b(?:frete|entrega|mobiliza[cç][aã]o)\b[^.\n]{0,40}(?:r\$|\d[\d.,]*)/giu;
const STOCK_SPAN =
  /\b(?:est[áa] dispon[ií]vel|temos dispon|em estoque|unidade livre|sai hoje|pronto para retirar)\b/giu;
const HEURISTIC_BLOCKED =
  /r\$|\breais\b|tabela (?:de )?(?:pre[cç]o|di[áa]ria)|cravar valor|confirmar valor|valor de loca|di[áa]ria de |frete.{0,24}\d|prazo de (?:frete|entrega)|em estoque|est[áa] dispon|unidade livre|fechar (?:proposta|contrato|or[cç]amento)|composi[cç][aã]o do valor|composi[cç][aã]o/iu;

const HARD_RULE_SET = new Set<string>(PLAYBOOK_HARD_RULES);

/**
 * Removes unofficial money, freight numbers and stock claims from client-facing playbook text.
 */
export function stripUnofficialQuotes(text: string) {
  MONEY_SPAN.lastIndex = 0;
  DAILY_WITH_NUMBER.lastIndex = 0;
  FREIGHT_WITH_NUMBER.lastIndex = 0;
  STOCK_SPAN.lastIndex = 0;
  return text
    .replace(MONEY_SPAN, 'valor a confirmar com o comercial')
    .replace(DAILY_WITH_NUMBER, 'diária a confirmar com o comercial')
    .replace(FREIGHT_WITH_NUMBER, 'frete a confirmar com o comercial')
    .replace(STOCK_SPAN, 'disponibilidade a confirmar com o comercial')
    .replace(/comercialm\b/giu, 'comercial')
    .replace(/[ \t]{2,}/gu, ' ')
    .replace(/ \n/gu, '\n')
    .trim();
}

/**
 * Strips PF/PJ, CNPJ, plantão and quote language from text the attendance bot may read.
 */
export function scrubTriageCopy(text: string) {
  return stripUnofficialQuotes(text)
    .replace(/\bsolicitar tipo de pessoa\s*\(PF ou PJ\)[^.\n]*/giu, 'pedir cidade e prazo se ainda faltarem')
    .replace(/\b(?:é |me confirma se é )(?:empresa ou )?pessoa f[ií]sica(?: ou (?:pessoa )?jur[ií]dica)?\b/giu, 'cidade e prazo')
    .replace(/\bempresa ou pessoa f[ií]sica\b/giu, 'cidade e prazo')
    .replace(/\bpessoa f[ií]sica ou (?:pessoa )?jur[ií]dica\b/giu, 'cidade e prazo')
    .replace(/\bPF ou PJ\b/giu, 'cidade e prazo')
    .replace(/\btipo de pessoa\b/giu, 'dados da obra')
    .replace(/\bse PJ[,:]?\s*(?:coleta |colete |qual o |peça o )?CNPJ\b/giu, 'documento fica com o comercial no horário útil')
    .replace(/\bqual o CNPJ\b/giu, 'o comercial pede documento no horário útil')
    .replace(/\b(?:vou |vamos )or[cç]ar(?: com precis[aã]o)?\b/giu, 'o comercial orça no horário útil')
    .replace(/\bassim or[cç]o com precis[aã]o\b/giu, 'o comercial orça no horário útil')
    .replace(/\benvio proposta\b/giu, 'o comercial retorna com a proposta')
    .replace(/\b(?:fica|fico) (?:aqui|à disposição|a disposicao)\b/giu, 'a mensagem já chegou')
    .replace(/\b(?:é só chamar|qualquer d[uú]vida)\b/giu, 'o comercial retorna no horário')
    .replace(/\b(?:liga|ligue|chama|chame) agora\b/giu, 'o comercial retorna no horário útil')
    .replace(/\bligue em 24h\b/giu, 'o comercial retorna no horário útil')
    .replace(/\btabela geral\b/giu, 'proposta do comercial')
    .replace(/[ \t]{2,}/gu, ' ')
    .trim();
}

function moneyHitCount(text: string) {
  MONEY_SPAN.lastIndex = 0;
  return (text.match(MONEY_SPAN) ?? []).length;
}

function clientFacingText(text: string, fallback: string) {
  if (moneyHitCount(text) >= 2) {
    return fallback;
  }
  const next = scrubTriageCopy(text);
  return next.length >= 8 ? next : fallback;
}

function filterObservedHeuristics(rules: string[]) {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const rule of rules) {
    const key = rule.trim();
    if (key.length < 8 || key.length > 240) {
      continue;
    }
    if (HARD_RULE_SET.has(key) || HEURISTIC_BLOCKED.test(key)) {
      continue;
    }
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(key);
    if (next.length >= 8) {
      break;
    }
  }
  return next;
}

function collectObservedHeuristics(record: Record<string, unknown>) {
  return filterObservedHeuristics([
    ...asList(record.observedHeuristics).map((rule) => clipText(rule, 240, '')),
    ...asList(record.hardRules).map((rule) => clipText(rule, 240, '')),
  ]);
}

function clampOpportunityStage(stage: string) {
  const key = stage.trim().toLowerCase().replaceAll(/\s+/gu, '-');
  const allowed = new Set([
    'fria',
    'qualificacao',
    'proposta',
    'negociacao',
    'quente',
    'em-risco',
    'perdida',
    'fechada',
  ]);
  return allowed.has(key) ? key : 'qualificacao';
}

function clipText(value: unknown, max: number, fallback: string) {
  const text = typeof value === 'string' ? value.trim() : '';
  return (text || fallback).slice(0, max);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asList(value: unknown) {
  return Array.isArray(value) ? value : [];
}

const FALLBACK_METHOD = {
  name: 'Qualificação mínima',
  whenToUse: 'Quando a conversa ainda não tem cidade, equipamento ou prazo.',
  steps: [
    'Pedir cidade, equipamento e prazo da obra.',
    'Dizer que o comercial confirma o que faltar e retorna.',
  ],
  paraphraseExample: 'Para te orientar certo, me confirma cidade, prazo e o equipamento.',
};

/**
 * Clips Haiku fields so Zod parse does not fail on long hints or thin teams.
 */
export function prepareCommercialPlaybook(input: unknown): unknown {
  const record = asRecord(input);
  if (!record) {
    return input;
  }

  record.capturedValues = asList(record.capturedValues).slice(0, 20).map((item) => {
    const row = asRecord(item) ?? {};
    return {
      ...row,
      equipment: clipText(row.equipment, 120, 'equipamento'),
      mentionedAs: clipText(row.mentionedAs, 240, 'não citado'),
      conversationHint: clipText(row.conversationHint, 400, 'Citado na conversa, sem tabela oficial.'),
      isOfficial: false,
      customerHint: clipText(redactCustomerPii(String(row.customerHint ?? '')), 80, 'cliente'),
      rentalDays: clipText(row.rentalDays, 80, 'não citado'),
      freightMention: clipText(row.freightMention, 160, 'não citado'),
    };
  });

  record.opportunities = asList(record.opportunities).slice(0, 16).map((item) => {
    const row = asRecord(item) ?? {};
    return {
      ...row,
      title: clipText(row.title, 80, 'Oportunidade'),
      customerHint: clipText(redactCustomerPii(String(row.customerHint ?? '')), 80, 'cliente'),
      equipment: clipText(row.equipment, 120, 'equipamento'),
      rentalDays: clipText(row.rentalDays, 80, 'não citado'),
      priceMention: clipText(row.priceMention, 160, 'não citado'),
      freightMention: clipText(row.freightMention, 160, 'não citado'),
      stage: clipText(row.stage, 24, 'qualificacao'),
      nextMove: clipText(row.nextMove, 240, 'Comercial confirma dados e retorna.'),
      whyItMatters: clipText(row.whyItMatters, 240, 'Há pedido em aberto que vale acompanhar.'),
    };
  });

  const methods = asList(record.methods).map((item) => {
    const row = asRecord(item) ?? {};
    const steps = asList(row.steps)
      .map((step) => clipText(step, 240, 'Registrar o pedido e retornar.'))
      .filter((step) => step.length >= 8);
    while (steps.length < 2) {
      steps.push('Registrar o que falta e retornar com o comercial.');
    }
    return {
      ...row,
      name: clipText(row.name, 80, 'Método'),
      whenToUse: clipText(row.whenToUse, 400, 'Quando o cliente pede apoio no WhatsApp.'),
      steps: steps.slice(0, 8),
      paraphraseExample: clipText(row.paraphraseExample, 400, 'Vou confirmar com o comercial e te retorno.'),
    };
  });
  while (methods.length < 3) {
    methods.push({
      ...FALLBACK_METHOD,
      name: `${FALLBACK_METHOD.name} ${methods.length + 1}`,
    });
  }
  record.methods = methods.slice(0, 10);

  const gaps = asList(record.gaps).map((item) => {
    const row = asRecord(item) ?? {};
    return {
      ...row,
      topic: clipText(row.topic, 80, 'Dados da obra'),
      whyMissing: clipText(row.whyMissing, 400, 'Este recorte não mostra uma regra estável o bastante.'),
      treatment: clipText(row.treatment, 400, 'Confirmar com o comercial e retornar. Não inventar.'),
    };
  });
  if (gaps.length === 0) {
    gaps.push({
      topic: 'Dados da obra',
      whyMissing: 'Este recorte não mostra uma regra estável o bastante.',
      treatment: 'Confirmar com o comercial e retornar. Não inventar.',
    });
  }
  record.gaps = gaps.slice(0, 12);

  if (Array.isArray(record.improvements7days)) {
    record.improvements7days = record.improvements7days.map((item, index) => {
      const row = asRecord(item) ?? {};
      return {
        ...row,
        dayOffset: Math.min(7, Math.max(1, Number(row.dayOffset) || index + 1)),
        action: clipText(row.action, 240, 'Revisar o fluxo com o comercial e retornar.'),
        why: clipText(row.why, 400, 'A conversa mostrou um ponto que ainda trava o atendimento.'),
      };
    });
  }

  const caseNotes = asList(record.caseNotes).map((item) => {
    const row = asRecord(item) ?? {};
    return {
      ...row,
      problemType: clipText(row.problemType, 80, 'outro'),
      situation: clipText(row.situation, 400, 'Cliente pediu apoio sem dados suficientes da obra.'),
      teamMove: clipText(row.teamMove, 400, 'A equipe pediu cidade, prazo e equipamento e prometeu retorno.'),
      outcome: clipText(row.outcome, 240, 'Aguardando retorno do comercial.'),
      humanizedTip: clipText(row.humanizedTip, 400, 'Peça os dados da obra e devolva com pessoa, sem cravar número.'),
    };
  });
  if (caseNotes.length === 0) {
    caseNotes.push({
      problemType: 'qualificacao',
      situation: 'Cliente pediu apoio sem dados suficientes da obra.',
      teamMove: 'A equipe pediu cidade, prazo e equipamento e prometeu retorno.',
      outcome: 'Aguardando retorno do comercial.',
      humanizedTip: 'Peça os dados da obra e devolva com pessoa, sem cravar número.',
    });
  }
  record.caseNotes = caseNotes.slice(0, 12);

  record.observedHeuristics = collectObservedHeuristics(record);
  record.hardRules = playbookHardRules();

  return record;
}

/**
 * Forces unofficial pricing, strips client-facing quotes, and locks hard rules to code.
 */
export function sanitizeCommercialPlaybook(playbook: CommercialPlaybook): CommercialPlaybook {
  return {
    ...playbook,
    businessSummary: clientFacingText(
      playbook.businessSummary,
      'Locação de equipamentos para obra em MG. O comercial confirma o que faltar e retorna.',
    ),
    workingStyle: clientFacingText(
      playbook.workingStyle,
      'A equipe pede cidade, equipamento e prazo, e deixa o comercial orçar no horário útil.',
    ),
    toneNotes: clientFacingText(
      playbook.toneNotes,
      'Tom direto e cordial. Sem preço, frete nem estoque no WhatsApp.',
    ),
    capturedValues: playbook.capturedValues.map((value) => ({
      ...value,
      isOfficial: false as const,
      rentalDays: value.rentalDays.trim() || 'não citado',
      freightMention: value.freightMention.trim() || 'não citado',
      customerHint: redactCustomerPii(value.customerHint.trim()) || 'cliente',
      mentionedAs: value.mentionedAs.startsWith('Captado em conversa')
        ? value.mentionedAs
        : `Captado em conversa, não oficial: ${value.mentionedAs}`,
    })),
    opportunities: playbook.opportunities.slice(0, 16).map((item) => ({
      ...item,
      customerHint: redactCustomerPii(item.customerHint.trim()) || 'cliente',
      stage: clampOpportunityStage(item.stage),
      priceMention: item.priceMention.trim() || 'não citado',
      freightMention: item.freightMention.trim() || 'não citado',
      rentalDays: item.rentalDays.trim() || 'não citado',
    })),
    methods: playbook.methods.map((method) => ({
      ...method,
      whenToUse: clientFacingText(method.whenToUse, FALLBACK_METHOD.whenToUse),
      steps: method.steps.map((step) => (
        clientFacingText(step, 'Registrar o pedido e retornar com o comercial.')
      )),
      paraphraseExample: clientFacingText(method.paraphraseExample, FALLBACK_METHOD.paraphraseExample),
    })),
    gaps: playbook.gaps.map((gap) => {
      const treatment = clientFacingText(gap.treatment, 'Confirmar com o comercial e retornar. Não inventar.');
      if (/preço|valor|frete|entrega/iu.test(gap.topic) && !/confirmar com o comercial/iu.test(treatment)) {
        return {
          ...gap,
          whyMissing: clientFacingText(gap.whyMissing, gap.whyMissing),
          treatment: `${treatment} Não confirmar número. Prometer retorno do comercial.`,
        };
      }
      return {
        ...gap,
        whyMissing: clientFacingText(gap.whyMissing, gap.whyMissing),
        treatment,
      };
    }),
    improvements7days: playbook.improvements7days.map((item, index) => ({
      ...item,
      dayOffset: Math.min(7, Math.max(1, Number.isFinite(item.dayOffset) ? item.dayOffset : index + 1)),
      action: clientFacingText(item.action, `Revisar o roteiro do dia ${index + 1} com a equipe.`),
    })),
    hardRules: playbookHardRules(),
    observedHeuristics: filterObservedHeuristics([
      ...(playbook.observedHeuristics ?? []),
      ...playbook.hardRules,
    ]),
    caseNotes: playbook.caseNotes.slice(0, 12).map((note) => ({
      ...note,
      problemType: note.problemType.trim().slice(0, 80),
      situation: clientFacingText(note.situation, 'Cliente pediu apoio sem dados suficientes da obra.'),
      teamMove: clientFacingText(note.teamMove, 'A equipe pediu cidade, prazo e equipamento e prometeu retorno.'),
      outcome: clientFacingText(note.outcome, 'Aguardando retorno do comercial.'),
      humanizedTip: clientFacingText(
        note.humanizedTip,
        'Peça os dados da obra e devolva com pessoa, sem cravar número.',
      ),
    })),
  };
}
