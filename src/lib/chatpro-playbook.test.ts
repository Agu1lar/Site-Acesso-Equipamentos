import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatProChatClient } from '../../chatpro-playbook/src/chatpro-chat';
import {
  parseChatProMessage,
  parseChatProSentMessageId,
  parseChatProSession,
  parseChatProSessionList,
  parseChatProSessionResult,
  phoneKeyFromWhatsAppAddress,
} from '../../chatpro-playbook/src/parse-chatpro';
import { redactCustomerPii } from '../../chatpro-playbook/src/redact';
import { resolveMentionedStartDate } from '../../chatpro-playbook/src/attendance-clock';
import {
  formatFleetCatalogHits,
  formatFleetRecommendation,
  recommendFleetEquipment,
  retrievedFleetBlock,
  searchFleetCatalog,
} from '../../chatpro-playbook/src/fleet-catalog';
import {
  HARD_RULE_NEVER_FREIGHT,
  HARD_RULE_NEVER_PRICE,
  HARD_RULE_NEVER_AVAILABILITY,
  HARD_RULE_NEVER_CLOSE,
  HARD_RULE_MISSING_DATA,
  HARD_RULE_DISTANT_REGION,
  CommercialPlaybookSchema,
  prepareCommercialPlaybook,
  sanitizeCommercialPlaybook,
  scrubTriageCopy,
  type CommercialPlaybook,
} from '../../chatpro-playbook/src/schema';
import { readPlaybookVaultKnowledge, readPriorPlaybookContext, writePlaybookVault } from '../../chatpro-playbook/src/vault';
import {
  formatCapturedEstimateBlock,
  matchCapturedEstimates,
  mentionsRentalStart,
  parseCapturedValueNotes,
  shouldRetrieveCapturedEstimate,
} from '../../chatpro-playbook/src/captured-estimates';
import { ensureMecanicaKnowledge } from '../../chatpro-playbook/src/mecanica-knowledge';
import {
  applyOperationalModules,
  isAiOwnedModule,
  slugifyModuleId,
  TRIAGE_UNSAFE_MODULE_IDS,
} from '../../chatpro-playbook/src/operational-modules';
import {
  pickSummariesForPlaybook,
  summaryLearningHeat,
} from '../../chatpro-playbook/src/playbook-learn';
import {
  fingerprintKey,
  isStaleJobLock,
  mediaIdempotencyKey,
  playbookIdempotencyKey,
  resolveEnqueueStatus,
  shouldSkipVaultWrite,
} from '../../chatpro-playbook/src/ops-keys';
import {
  searchVaultKnowledge,
  shouldSearchAttendanceModules,
  shouldSearchMechanicKnowledge,
} from '../../chatpro-playbook/src/vault-search';
import {
  learnTriageFromThread,
  learnTriageFromThreads,
  parseTriageLearnNote,
  recordSandboxTriageRun,
  sandboxFailuresToLines,
  writeTriageLearnFromThreads,
} from '../../chatpro-playbook/src/triage-learn';
import {
  contactFollowUp,
  findContactNoteByPhone,
  writeContactNotes,
} from '../../chatpro-playbook/src/contact-note';
import {
  classifyAttendanceDesk,
  companyFolderFromPlaybookFolder,
  deskBelongsInPlaybook,
  desksTouchedByThread,
  partitionAttendanceThreads,
  WAITING_QUEUE_DEPARTMENT_ID,
  waitingQueueDepartmentId,
  vaultFolderForTeam,
  vaultTeamForDesk,
} from '../../chatpro-playbook/src/attendance-team';
import {
  bodiesMatchBotOutbound,
  matchBotOutbound,
} from '../../chatpro-playbook/src/bot-origin';
import {
  pickArcMessages,
  selectPlaybookSummaryMessages,
  threadSummarySourceKey,
} from '../../chatpro-playbook/src/thread-summary';
import { takeSessionsForUniqueLeads } from '../../chatpro-playbook/src/playbook-leads';
import {
  runWaitingQueueHandoffAttempt,
  verifyWaitingQueueSession,
} from '../../chatpro-playbook/src/waiting-queue-handoff';

const vaultDirs: string[] = [];

function samplePlaybook(): CommercialPlaybook {
  return {
    businessSummary:
      'A Acesso atende locação de plataformas e equipamentos pesados para obra, com conversa direta no WhatsApp e retorno humano no horário comercial.',
    workingStyle:
      'A equipe cumprimenta, pede cidade, equipamento, prazo e acesso ao canteiro antes de orçar. Negociação de preço fica com o comercial, não no primeiro toque.',
    toneNotes: 'Tom direto, cordial, sem prometer prazo de entrega sem checar logística.',
    methods: [
      {
        name: 'Qualificação inicial',
        whenToUse: 'Primeira mensagem de quem pede máquina sem dados da obra.',
        steps: [
          'Cumprimentar e confirmar o equipamento pedido.',
          'Pedir cidade, prazo e se já tem acesso de carga.',
        ],
        paraphraseExample: 'Para te orientar certo, me confirma cidade, prazo e o modelo que você precisa.',
      },
      {
        name: 'Pedido de orçamento',
        whenToUse: 'Cliente já disse máquina e cidade e pede valor.',
        steps: [
          'Anotar o pedido com equipamento, prazo e local.',
          'Dizer que o comercial confirma valor e retorna, sem fechar número na hora.',
        ],
        paraphraseExample: 'Vou passar para o comercial confirmar o valor e te retorno ainda hoje.',
      },
      {
        name: 'Handoff para humano',
        whenToUse: 'Cliente pede pessoa, contrato, reclamação ou frete fechado.',
        steps: [
          'Assumir o retorno humano sem discutir preço.',
          'Registrar o que falta para o comercial completar.',
        ],
        paraphraseExample: 'Vou deixar o comercial com você para fechar os detalhes.',
      },
    ],
    capturedValues: [
      {
        equipment: 'plataforma tesoura',
        mentionedAs: 'R$ 4.800 no mês',
        conversationHint: 'Apareceu em uma conversa de campanha, sem tabela anexada.',
        isOfficial: false,
        customerHint: 'obra em BH',
        rentalDays: '30 dias',
        freightMention: 'não citado',
      },
    ],
    opportunities: [
      {
        title: 'Tesoura 30 dias em BH',
        customerHint: 'obra em BH',
        equipment: 'plataforma tesoura',
        rentalDays: '30 dias',
        priceMention: 'R$ 4.800 no mês',
        freightMention: 'não citado',
        stage: 'negociacao',
        nextMove: 'Comercial confirma valor e prazo de entrega com a logística.',
        whyItMatters: 'Período e equipamento já estão claros; falta só fechar sem cravar frete no WhatsApp.',
      },
    ],
    gaps: [
      {
        topic: 'Frete',
        whyMissing: 'As conversas não mostram uma regra estável de entrega.',
        treatment: 'Não informar prazo nem valor. Confirmar com o comercial e retornar.',
      },
    ],
    improvements7days: [1, 2, 3, 4, 5, 6, 7].map((dayOffset) => ({
      dayOffset,
      action: `Revisar o roteiro do dia ${dayOffset} com a equipe.`,
      why: 'As conversas mostram variação no jeito de pedir dados da obra.',
    })),
    hardRules: ['Não inventar disponibilidade de frota.'],
    observedHeuristics: ['Pessoa física loca; a triagem não pede CNPJ.'],
    caseNotes: [
      {
        problemType: 'qualificacao',
        situation: 'Cliente pediu articulada sem dizer cidade nem prazo da obra.',
        teamMove: 'A equipe cumprimentou, pediu cidade, prazo e acesso de carga, sem fechar valor.',
        outcome: 'Aguardando os dados para o comercial orçar.',
        humanizedTip: 'Acolher o pedido e explicar por que cidade e prazo mudam a proposta, sem pressa de vender.',
      },
      {
        problemType: 'frete',
        situation: 'Cliente queria o valor da entrega na hora, ainda sem obra fechada.',
        teamMove: 'A equipe registrou o destino e disse que o comercial confirma o frete depois.',
        outcome: 'Conversa seguindo, sem número de frete na ponta.',
        humanizedTip: 'Validar a urgência, anotar o local e nunca cravar frete no primeiro toque.',
      },
      {
        problemType: 'objecao',
        situation: 'Cliente achou a diária alta e ameaçou buscar outro fornecedor.',
        teamMove: 'A equipe ouviu, perguntou o que travava (prazo vs custo) e passou ao comercial.',
        outcome: 'Negociação aberta com o comercial humano.',
        humanizedTip: 'Não discutir desconto no WhatsApp. Entender a objeção e oferecer retorno humano.',
      },
    ],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  for (const dir of vaultDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('resolveMentionedStartDate', () => {
  it('resolves a weekday from the previous calendar week', () => {
    const now = new Date('2026-09-16T15:00:00.000Z');

    expect(resolveMentionedStartDate('começou na sexta passada', now)?.toISOString())
      .toBe('2026-09-11T15:00:00.000Z');
  });
});

describe('redactCustomerPii', () => {
  it('masks brazilian mobile numbers and emails', () => {
    expect(redactCustomerPii('Me liga 31 98888-1234 ou  ana@obra.com')).toBe(
      'Me liga •••1234 ou  [e-mail omitido]',
    );
  });

  it('masks a cnpj number', () => {
    expect(redactCustomerPii('Empresa CNPJ 01.251.682/0001-78 na obra')).toBe(
      'Empresa CNPJ [CNPJ omitido] na obra',
    );
  });
});

describe('scrubTriageCopy', () => {
  it('drops pf/pj and plantão language from bot-facing copy', () => {
    const text = scrubTriageCopy(
      'Solicitar tipo de pessoa (PF ou PJ); se PJ, CNPJ fica com comercial. Fico à disposição, liga agora.',
    );
    expect(text).not.toMatch(/PF ou PJ/i);
    expect(text).not.toMatch(/liga agora/i);
    expect(text).not.toMatch(/fico à disposição/i);
    expect(text).toMatch(/cidade e prazo/i);
  });

  it('keeps pessoa física can rent as a team note', () => {
    expect(scrubTriageCopy('Pessoa física loca; a triagem não pede CNPJ.')).toContain('Pessoa física loca');
  });
});

describe('parseChatProSession', () => {
  it('reads id phone and open flag from nested lead', () => {
    const session = parseChatProSession({
      id: 'sess-1',
      open: true,
      createdAt: '2026-08-20T12:00:00.000Z',
      lead: { name: 'Obra Sul', phone: '31988881234' },
    });

    expect(session).toMatchObject({
      id: 'sess-1',
      phoneKey: '31988881234',
      contactName: 'Obra Sul',
      isOpen: true,
    });
  });

  it('unwraps session arrays from data', () => {
    expect(parseChatProSessionList({ data: [{ id: 'a' }, { id: 'b' }] })).toHaveLength(2);
  });

  it('reads the direct getSessionById payload', () => {
    expect(parseChatProSessionResult({
      id: 'session-real',
      open: true,
      department_id: 'department-real',
      assing_to: '',
    })?.raw).toMatchObject({ id: 'session-real', assing_to: '' });
  });
});

describe('ChatProChatClient', () => {
  it('loads one session through the documented endpoint', async () => {
    const fetchMock = vi.fn(async () => Response.json({
      id: 'session-real',
      department_id: 'department-real',
      assing_to: '',
      open: true,
    }, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new ChatProChatClient({ instanceId: 'instance-1', instanceToken: 'secret' });

    const session = await client.getSession('session-real');

    expect(session?.id).toBe('session-real');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/sessions/getSessionById');
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      instanceId: 'instance-1',
      sessionId: 'session-real',
    });
  });

  it('sends only the whitelisted fields when returning a session to the queue', async () => {
    const fetchMock = vi.fn(async () => Response.json({ success: true }, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('AFTER_HOURS_SANDBOX', 'false');
    const client = new ChatProChatClient({ instanceId: 'instance-1', instanceToken: 'secret' });

    await client.returnSessionToWaiting({
      sessionId: 'session-real',
      departmentId: WAITING_QUEUE_DEPARTMENT_ID,
    });

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/sessions/assignDepartment');
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      instanceId: 'instance-1',
      sessionId: 'session-real',
      department_id: WAITING_QUEUE_DEPARTMENT_ID,
      unassign: true,
    });
  });

  it('reconciles delivery status from message history', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json([{
      id: 'message-1',
      from_me: true,
      status: 2,
    }])));
    const client = new ChatProChatClient({ instanceId: 'instance-1', instanceToken: 'secret' });

    await expect(client.getMessageDeliveryStatus(
      'session-1',
      'session-1:message-1',
    )).resolves.toEqual({ status: 2, error: null });
  });
});

describe('parseChatProMessage', () => {
  it('namespaces message id with session id', () => {
    const message = parseChatProMessage(
      { id: 'm1', fromMe: true, message: 'Oi', timestamp: '2026-08-20T12:01:00.000Z' },
      'sess-1',
    );

    expect(message).toMatchObject({
      id: 'sess-1:m1',
      fromMe: true,
      body: 'Oi',
    });
  });

  it('reads the id returned by sendMessage', () => {
    expect(parseChatProSentMessageId({ data: { id: 'abc' } }, 'sess-1')).toBe('sess-1:abc');
    expect(parseChatProSentMessageId({ data: { messageId: 'sess-1:xyz' } }, 'sess-1')).toBe('sess-1:xyz');
    expect(parseChatProSentMessageId({}, 'sess-1')).toBeNull();
  });
});

describe('sanitizeCommercialPlaybook', () => {
  it('keeps captured prices unofficial and injects never-confirm rules', () => {
    const sanitized = sanitizeCommercialPlaybook(samplePlaybook());

    expect(sanitized.capturedValues[0]).toMatchObject({
      isOfficial: false,
      mentionedAs: expect.stringContaining('não oficial'),
      rentalDays: '30 dias',
      freightMention: 'não citado',
    });
    expect(sanitized.opportunities[0]).toMatchObject({
      stage: 'negociacao',
      priceMention: 'R$ 4.800 no mês',
    });
    expect(sanitized.hardRules[0]).toBe(HARD_RULE_NEVER_PRICE);
    expect(sanitized.hardRules[1]).toBe(HARD_RULE_NEVER_FREIGHT);
    expect(sanitized.hardRules[2]).toBe(HARD_RULE_NEVER_AVAILABILITY);
    expect(sanitized.hardRules[3]).toBe(HARD_RULE_NEVER_CLOSE);
    expect(sanitized.hardRules).toHaveLength(6);
    expect(sanitized.observedHeuristics).toContain('Pessoa física loca; a triagem não pede CNPJ.');
    expect(sanitized.hardRules.join('\n')).not.toContain('Não inventar disponibilidade de frota.');
  });

  it('strips unofficial prices from methods and case notes', () => {
    const playbook = samplePlaybook();
    playbook.methods[0].paraphraseExample =
      'A tabela é: diária R$60, semanal (7 dias) R$96, mensal (30 dias) R$240. Detalho tudo por telefone.';
    playbook.methods[0].steps[1] = 'Repetir estrutura da proposta por escrito (ex: Diária R$60, 7 dias R$96).';
    playbook.caseNotes[0].humanizedTip = 'Mande a tabela: diária R$60 e semanal R$96.';
    const sanitized = sanitizeCommercialPlaybook(playbook);
    const methodBlob = `${sanitized.methods[0].paraphraseExample} ${sanitized.methods[0].steps.join(' ')}`;
    expect(methodBlob).not.toMatch(/R\$\s*60/i);
    expect(methodBlob).not.toMatch(/R\$\s*96/i);
    expect(sanitized.caseNotes[0].humanizedTip).not.toMatch(/R\$/i);
  });

  it('drops a generated rule that contradicts the code hard rules', () => {
    const raw = {
      ...samplePlaybook(),
      hardRules: [
        'NUNCA cravar valor sem deixar clara a composição',
        'Pessoa física loca; a triagem não pede CNPJ.',
      ],
      observedHeuristics: [],
    };
    const parsed = CommercialPlaybookSchema.parse(prepareCommercialPlaybook(raw));
    const sanitized = sanitizeCommercialPlaybook(parsed);
    expect(sanitized.hardRules).toEqual([
      HARD_RULE_NEVER_PRICE,
      HARD_RULE_NEVER_FREIGHT,
      HARD_RULE_NEVER_AVAILABILITY,
      HARD_RULE_NEVER_CLOSE,
      HARD_RULE_MISSING_DATA,
      HARD_RULE_DISTANT_REGION,
    ]);
    expect(sanitized.hardRules.join('\n')).not.toMatch(/composi/i);
    expect(sanitized.observedHeuristics.join('\n')).not.toMatch(/cravar valor/i);
    expect(sanitized.observedHeuristics).toContain('Pessoa física loca; a triagem não pede CNPJ.');
  });

  it('clamps unknown opportunity stages to qualificacao', () => {
    const playbook = samplePlaybook();
    playbook.opportunities[0].stage = 'hot';
    expect(sanitizeCommercialPlaybook(playbook).opportunities[0].stage).toBe('qualificacao');
  });

  it('clips long customer hints so parse still succeeds', () => {
    const raw = {
      ...samplePlaybook(),
      capturedValues: [{
        ...samplePlaybook().capturedValues[0],
        customerHint: 'obra '.repeat(40),
      }],
    };
    const parsed = CommercialPlaybookSchema.parse(prepareCommercialPlaybook(raw));
    expect(parsed.capturedValues[0].customerHint.length).toBeLessThanOrEqual(80);
  });

  it('pads methods when a thin team returns fewer than three', () => {
    const raw = {
      ...samplePlaybook(),
      methods: samplePlaybook().methods.slice(0, 1),
    };
    const parsed = CommercialPlaybookSchema.parse(prepareCommercialPlaybook(raw));
    expect(parsed.methods.length).toBeGreaterThanOrEqual(3);
  });

  it('scrubs pf/pj from methods the bot reads', () => {
    const playbook = samplePlaybook();
    playbook.methods[0].steps[0] = 'Solicitar tipo de pessoa (PF ou PJ) antes de orçar.';
    playbook.methods[0].paraphraseExample = 'Me confirma se é empresa ou pessoa física?';
    const sanitized = sanitizeCommercialPlaybook(playbook);
    const blob = `${sanitized.methods[0].steps.join(' ')} ${sanitized.methods[0].paraphraseExample}`;
    expect(blob).not.toMatch(/PF ou PJ/i);
    expect(blob).not.toMatch(/empresa ou pessoa física/i);
  });

  it('redacts cnpj from captured customer hints', () => {
    const playbook = samplePlaybook();
    playbook.capturedValues[0].customerHint = 'Empresa CNPJ 01.251.682/0001-78';
    expect(sanitizeCommercialPlaybook(playbook).capturedValues[0].customerHint).toContain('[CNPJ omitido]');
    expect(sanitizeCommercialPlaybook(playbook).capturedValues[0].customerHint).not.toMatch(/01\.251/);
  });
});

describe('writePlaybookVault', () => {
  it('writes generated notes and skips existing human notes', () => {
    const vaultPath = mkdtempSync(join(tmpdir(), 'playbook-vault-'));
    vaultDirs.push(vaultPath);
    const folder = 'Acesso Equipamentos/Comercial';
    const first = writePlaybookVault({
      vaultPath,
      folder,
      playbook: sanitizeCommercialPlaybook(samplePlaybook()),
      now: new Date('2026-08-31T13:00:00.000Z'),
    });

    const humanPath = join(first.folder, 'Notas humanas.md');
    writeFileSync(humanPath, 'nota da equipe', 'utf8');

    writePlaybookVault({
      vaultPath,
      folder,
      playbook: sanitizeCommercialPlaybook(samplePlaybook()),
      now: new Date('2026-08-31T14:00:00.000Z'),
    });

    expect(readFileSync(humanPath, 'utf8')).toBe('nota da equipe');
    expect(readFileSync(join(first.folder, 'Regras da IA.md'), 'utf8')).toContain(
      'Nunca confirmar valor de locação',
    );
    expect(readFileSync(join(first.folder, 'Oportunidades.md'), 'utf8')).toContain(
      'Tesoura 30 dias em BH',
    );
    expect(readFileSync(join(first.folder, 'Valores captados.md'), 'utf8')).toContain(
      '30 dias',
    );
    expect(readFileSync(join(first.folder, 'Exemplos de atendimento.md'), 'utf8')).toContain(
      'Como atender melhor',
    );
    expect(readFileSync(join(first.folder, 'Heuristicas observadas.md'), 'utf8')).toContain(
      'Pessoa física loca',
    );
    expect(readFileSync(join(first.folder, 'Indice.md'), 'utf8')).toContain('Aprendizado da triagem');

    writeFileSync(
      join(first.folder, 'Aprendizado da triagem.md'),
      '# Aprendizado da triagem\n\n## O que não repetir\n\n- Peça para quando começa a locação.\n',
      'utf8',
    );

    const knowledge = readPlaybookVaultKnowledge({
      vaultPath,
      folder,
    });
    expect(knowledge).toContain('Notas humanas');
    expect(knowledge).toContain('Aprendizado da triagem');
    expect(knowledge).toContain('Peça para quando começa');
    expect(knowledge).toContain('A nota humana vence o playbook gerado');
    expect(knowledge).toContain('Nunca confirmar valor de locação');
    expect(knowledge).not.toContain('Tesoura 30 dias em BH');
    expect(knowledge).not.toContain('R$ 4.800');
    expect(knowledge).not.toContain('Como atender melhor');
    expect(knowledge).not.toContain('Exemplos de atendimento.md');
  });

  it('keeps human notes in bot knowledge when generated files fill the budget', () => {
    const vaultPath = mkdtempSync(join(tmpdir(), 'playbook-human-'));
    vaultDirs.push(vaultPath);
    const folder = 'Acesso Equipamentos/Comercial';
    const root = join(vaultPath, folder);
    mkdirSync(root, { recursive: true });
    const filler = `${'Pedir cidade e período. '.repeat(400)}R$60 a diária.\n`;
    writeFileSync(join(root, 'Regras da IA.md'), `Preço/Frete: NUNCA cravar valor sem deixar clara a composição.\n${filler}`, 'utf8');
    writeFileSync(join(root, 'Como atendemos.md'), filler, 'utf8');
    writeFileSync(join(root, 'Exemplos de atendimento.md'), `Diária R$60, semanal R$96, mensal R$240.\n${filler}`, 'utf8');
    writeFileSync(join(root, 'Negocio e tom.md'), filler, 'utf8');
    writeFileSync(join(root, 'Notas humanas.md'), 'OVERRIDE_HUMANO: PF loca e a triagem não pede CNPJ.\n', 'utf8');
    writeFileSync(join(root, 'Lacunas e tratamentos.md'), filler, 'utf8');

    const knowledge = readPlaybookVaultKnowledge({
      vaultPath,
      folder,
      maxChars: 3_000,
    });
    expect(knowledge).toContain('OVERRIDE_HUMANO');
    expect(knowledge).toContain('Nunca confirmar valor de locação');
    expect(knowledge).not.toContain('NUNCA cravar valor sem deixar clara a composição');
    expect(knowledge).not.toContain('R$60');
    expect(knowledge).not.toContain('Exemplos de atendimento.md');

    const prior = readPriorPlaybookContext({
      vaultPath,
      folder,
      maxChars: 2_000,
    });
    expect(prior).toContain('OVERRIDE_HUMANO');
    expect(prior).toContain('A nota humana vence o playbook gerado');
  });
});

describe('phoneKeyFromWhatsAppAddress', () => {
  it('keeps digits and drops group chats', () => {
    expect(phoneKeyFromWhatsAppAddress('5531971086336@s.whatsapp.net')).toBe('5531971086336');
    expect(phoneKeyFromWhatsAppAddress('120363@g.us')).toBeNull();
  });
});

describe('contactFollowUp', () => {
  it('flags a thread whose last real line is the customer', () => {
    expect(contactFollowUp({
      session: {
        id: 's1',
        phone_key: '5531999999999',
        contact_name: 'Obra',
        is_open: true,
        opened_at: null,
        closed_at: null,
      },
      messages: [
        {
          id: '1',
          session_id: 's1',
          from_me: false,
          body: 'manda o orçamento',
          media_type: 'receveid_message',
          sent_at: new Date('2026-08-31T20:00:00.000Z'),
        },
      ],
    }).needed).toBe(true);
  });

  it('keeps follow-up when only the bot answered', () => {
    expect(contactFollowUp({
      session: {
        id: 's1',
        phone_key: '5531999999999',
        contact_name: 'Obra',
        is_open: true,
        opened_at: null,
        closed_at: null,
      },
      messages: [
        {
          id: '1',
          session_id: 's1',
          from_me: false,
          body: 'manda o orçamento',
          media_type: 'receveid_message',
          sent_at: new Date('2026-08-31T20:00:00.000Z'),
        },
        {
          id: '2',
          session_id: 's1',
          from_me: true,
          body: 'Recebemos. O comercial retorna no horário.',
          media_type: 'send_message',
          sent_at: new Date('2026-08-31T20:01:00.000Z'),
          bot_origin: true,
        },
      ],
    }).needed).toBe(true);
  });
});

describe('writeContactNotes', () => {
  it('keeps human notes and finds the file by phone', () => {
    const vaultPath = mkdtempSync(join(tmpdir(), 'contact-notes-'));
    vaultDirs.push(vaultPath);
    const folder = 'Acesso Equipamentos/Comercial';
    const thread = {
      session: {
        id: 's1',
        phone_key: '5531999999999',
        contact_name: 'Obra Sul',
        is_open: true,
        opened_at: null,
        closed_at: null,
        raw: { group: false },
      },
      messages: [
        {
          id: '1',
          session_id: 's1',
          from_me: false,
          body: 'preciso de plataforma',
          media_type: 'receveid_message',
          sent_at: new Date('2026-08-31T20:00:00.000Z'),
        },
      ],
    };

    writeContactNotes({ vaultPath, folder, threads: [thread] });
    const path = join(vaultPath, folder, 'Clientes', 'c-5531999999999.md');
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace('(escreva aqui; o worker não apaga este bloco)', 'cliente da Bianca'),
      'utf8',
    );
    writeContactNotes({ vaultPath, folder, threads: [thread] });

    expect(readFileSync(path, 'utf8')).toContain('cliente da Bianca');
    expect(findContactNoteByPhone({ vaultPath, folder, query: '99999999' })?.noteId).toBe(
      '5531999999999',
    );
  });
});

function threadWith(options: {
  departmentId?: string;
  messages: Array<{ from_me: boolean; body: string }>;
  phone?: string;
}) {
  return {
    session: {
      id: 's-desk',
      phone_key: options.phone ?? '5531988000000',
      contact_name: 'Obra',
      is_open: true,
      opened_at: null,
      closed_at: null,
      raw: options.departmentId ? { department_id: options.departmentId, group: false } : { group: false },
    },
    messages: options.messages.map((message, index) => ({
      id: String(index),
      session_id: 's-desk',
      from_me: message.from_me,
      body: message.body,
      media_type: 'chat',
      sent_at: new Date(`2026-08-31T12:0${index}:00.000Z`),
    })),
  };
}

describe('bot origin', () => {
  it('matches a synced body to the outbound we posted', () => {
    expect(bodiesMatchBotOutbound(
      'Olá! Recebemos sua mensagem.\n\nRetornamos no próximo dia útil.',
      'Olá! Recebemos sua mensagem.  Retornamos no próximo dia útil.',
    )).toBe(true);
    expect(matchBotOutbound({
      messageId: 'sess-1:m9',
      body: 'Olá! Recebemos sua mensagem.',
      rows: [{
        id: 'out-1',
        body: 'Olá! Recebemos sua mensagem.',
        chatpro_message_id: null,
      }],
    })?.id).toBe('out-1');
    expect(matchBotOutbound({
      messageId: 'sess-1:m9',
      body: 'texto diferente',
      rows: [{
        id: 'out-2',
        body: 'Olá! Recebemos sua mensagem.',
        chatpro_message_id: 'sess-1:m9',
      }],
    })?.id).toBe('out-2');
  });

  it('reads the department used to return the chat to waiting', () => {
    expect(waitingQueueDepartmentId({
      department_id: 'b8398ed0-56e9-4516-9828-e9f6f5278535',
    })).toBe('b8398ed0-56e9-4516-9828-e9f6f5278535');
    expect(waitingQueueDepartmentId({})).toBeNull();
  });
});

describe('classifyAttendanceDesk', () => {
  it('routes logistics department to the logistics vault', () => {
    const thread = threadWith({
      departmentId: 'a3497569-a552-4b5d-a0f4-131c8a3f15d3',
      messages: [{ from_me: false, body: 'Programa a devolução pra mim' }],
    });

    expect(classifyAttendanceDesk(thread)).toBe('logistica');
    expect(vaultTeamForDesk('logistica')).toBe('logistica');
    expect(deskBelongsInPlaybook('logistica', 'logistica')).toBe(true);
    expect(deskBelongsInPlaybook('logistica', 'comercial')).toBe(false);
  });

  it('keeps rental departments on the commercial desk', () => {
    const thread = threadWith({
      departmentId: 'b8398ed0-56e9-4516-9828-e9f6f5278535',
      messages: [{ from_me: false, body: 'quero uma articulada' }],
    });

    expect(classifyAttendanceDesk(thread)).toBe('comercial');
    expect(vaultTeamForDesk('comercial')).toBe('comercial');
  });

  it('reads existing-client menu option 6 as logistics', () => {
    const thread = threadWith({
      messages: [
        { from_me: true, body: '*6*.  LOGÍSTICA/ TROCA E DEVOLUÇÃO' },
        { from_me: false, body: '6' },
      ],
    });

    expect(classifyAttendanceDesk(thread)).toBe('logistica');
  });

  it('puts finance on the commercial folder without training the rental playbook', () => {
    expect(vaultTeamForDesk('financeiro')).toBe('comercial');
    expect(deskBelongsInPlaybook('financeiro', 'comercial')).toBe(false);
    expect(companyFolderFromPlaybookFolder('Acesso Equipamentos/Comercial')).toBe(
      'Acesso Equipamentos',
    );
    expect(vaultFolderForTeam('Acesso Equipamentos', 'logistica')).toBe(
      'Acesso Equipamentos/Logistica',
    );
  });

  it('routes maintenance menu and department to the mechanic vault', () => {
    const byDept = threadWith({
      departmentId: 'c8b80b2d-9587-4cc6-af7e-0b89d991c0a2',
      messages: [{ from_me: false, body: 'Julio abrir chamado para manutenção corretiva' }],
    });
    const byMenu = threadWith({
      messages: [
        { from_me: true, body: '*3*. MANUTENÇÃO\n*6*.  LOGÍSTICA/ TROCA E DEVOLUÇÃO' },
        { from_me: false, body: '3' },
      ],
    });

    expect(classifyAttendanceDesk(byDept)).toBe('manutencao');
    expect(classifyAttendanceDesk(byMenu)).toBe('manutencao');
    expect(vaultTeamForDesk('manutencao')).toBe('mecanica');
    expect(deskBelongsInPlaybook('manutencao', 'mecanica')).toBe(true);
    expect(vaultFolderForTeam('Acesso Equipamentos', 'mecanica')).toBe(
      'Acesso Equipamentos/Mecanica',
    );
  });

  it('keeps a transferred client on every desk that owned the chat', () => {
    const thread = threadWith({
      departmentId: 'a3497569-a552-4b5d-a0f4-131c8a3f15d3',
      messages: [
        { from_me: false, body: 'quero uma articulada em BH' },
        { from_me: true, body: 'Sessão transferida para o departamento `b8398ed0-56e9-4516-9828-e9f6f5278535`' },
        { from_me: true, body: 'Sessão transferida para o departamento `a3497569-a552-4b5d-a0f4-131c8a3f15d3`' },
        { from_me: false, body: 'Programa a devolução pra mim' },
      ],
    });
    const split = partitionAttendanceThreads([thread]);

    expect(classifyAttendanceDesk(thread)).toBe('logistica');
    expect(desksTouchedByThread(thread)).toEqual(['logistica', 'comercial']);
    expect(split.vault.comercial).toHaveLength(1);
    expect(split.vault.logistica).toHaveLength(1);
    expect(split.playbook.comercial).toHaveLength(1);
    expect(split.playbook.logistica).toHaveLength(1);
  });
});

describe('takeSessionsForUniqueLeads', () => {
  it('keeps transfer sessions of the same WhatsApp inside the lead cap', () => {
    const sessions = [
      { id: 's1', phoneKey: '5531911111111' },
      { id: 's2', phoneKey: '5531911111111' },
      { id: 's3', phoneKey: '5531922222222' },
      { id: 's4', phoneKey: '5531933333333' },
    ];
    const taken = takeSessionsForUniqueLeads(sessions, 2);

    expect(taken.leadCount).toBe(2);
    expect(taken.sessions.map((session) => session.id)).toEqual(['s1', 's2', 's3']);
  });
});

describe('selectPlaybookSummaryMessages', () => {
  const messages = [
    { id: 'a', from_me: false, body: 'oi', media_type: 'chat' },
    { id: 'b', from_me: true, body: 'bom dia', media_type: 'chat' },
    { id: 'c', from_me: false, body: 'quero plataforma', media_type: 'chat' },
  ];

  it('reuses the stored summary when the source key matches', () => {
    const sourceKey = threadSummarySourceKey(messages);
    expect(selectPlaybookSummaryMessages({
      messages,
      lastMessageId: 'c',
      sourceKey,
    }).mode).toBe('unchanged');
  });

  it('rewrites the full arc when the summary version changes', () => {
    const selected = selectPlaybookSummaryMessages({
      messages,
      lastMessageId: 'c',
      sourceKey: 'v3:3:c:0',
    });
    expect(selected.mode).toBe('full');
    expect(selected.sourceKey.startsWith('v4:')).toBe(true);
  });

  it('sends only messages after the watermark like ROI', () => {
    const selected = selectPlaybookSummaryMessages({
      messages,
      lastMessageId: 'a',
      sourceKey: 'v4:2:a:0',
    });
    expect(selected.mode).toBe('incremental');
    expect(selected.messages.map((message) => message.id)).toEqual(['b', 'c']);
  });

  it('keeps the opening and the outcome of a long thread', () => {
    const longThread = Array.from({ length: 12 }, (_, index) => ({
      id: `m${index + 1}`,
      from_me: index % 2 === 1,
      body: `fala ${index + 1}`,
      media_type: 'chat',
    }));
    const selected = selectPlaybookSummaryMessages({
      messages: longThread,
      lastMessageId: null,
      sourceKey: null,
    });
    expect(pickArcMessages(longThread).map((message) => message.id)).toEqual([
      'm1', 'm2', 'm3', 'm8', 'm9', 'm10', 'm11', 'm12',
    ]);
    expect(selected.messages.map((message) => message.id)).toEqual([
      'm1', 'm2', 'm3', 'm8', 'm9', 'm10', 'm11', 'm12',
    ]);
  });

  it('keeps mid-thread price and rental-day quotes in the summary arc', () => {
    const longThread = Array.from({ length: 12 }, (_, index) => ({
      id: `m${index + 1}`,
      from_me: index % 2 === 1,
      body: index === 5 ? 'A diária fica R$ 480 por 15 dias mais frete' : `fala ${index + 1}`,
      media_type: 'chat',
    }));
    expect(pickArcMessages(longThread).map((message) => message.id)).toContain('m6');
  });
});

describe('writeContactNotes team split', () => {
  it('moves a logistics note out of the commercial folder and keeps human notes', () => {
    const vaultPath = mkdtempSync(join(tmpdir(), 'team-notes-'));
    vaultDirs.push(vaultPath);
    const comercial = 'Acesso Equipamentos/Comercial';
    const logistica = 'Acesso Equipamentos/Logistica';
    const thread = threadWith({
      departmentId: 'a3497569-a552-4b5d-a0f4-131c8a3f15d3',
      phone: '5531911111111',
      messages: [{ from_me: false, body: 'Programa a devolução pra mim' }],
    });

    writeContactNotes({ vaultPath, folder: comercial, threads: [thread], team: 'comercial' });
    const oldPath = join(vaultPath, comercial, 'Clientes', 'c-5531911111111.md');
    writeFileSync(
      oldPath,
      readFileSync(oldPath, 'utf8').replace('(escreva aqui; o worker não apaga este bloco)', 'obra com coleta'),
      'utf8',
    );

    writeContactNotes({ vaultPath, folder: logistica, threads: [thread], team: 'logistica' });

    const newPath = join(vaultPath, logistica, 'Clientes', 'c-5531911111111.md');
    expect(existsSync(oldPath)).toBe(false);
    expect(readFileSync(newPath, 'utf8')).toContain('obra com coleta');
    expect(readFileSync(newPath, 'utf8')).toContain('equipe: logistica');
    expect(findContactNoteByPhone({
      vaultPath,
      folders: [comercial, logistica],
      query: '11111111',
    })?.noteId).toBe('5531911111111');
  });
});

describe('mechanic vault knowledge', () => {
  it('seeds notes once and retrieves platform content for a breakdown query', () => {
    const vaultPath = mkdtempSync(join(tmpdir(), 'mecanica-kb-'));
    vaultDirs.push(vaultPath);
    const first = ensureMecanicaKnowledge({
      vaultPath,
      companyFolder: 'Acesso Equipamentos',
    });
    const notePath = join(vaultPath, 'Acesso Equipamentos', 'Mecanica', 'Conhecimento', 'Plataformas elevatorias.md');
    writeFileSync(notePath, `${readFileSync(notePath, 'utf8')}\nnota da oficina`, 'utf8');

    const second = ensureMecanicaKnowledge({
      vaultPath,
      companyFolder: 'Acesso Equipamentos',
    });

    expect(first.written.length).toBeGreaterThan(0);
    expect(second.written).toEqual([]);
    expect(readFileSync(notePath, 'utf8')).toContain('nota da oficina');
    expect(shouldSearchMechanicKnowledge('a articulada Z34 não abaixa a gaiola')).toBe(true);

    const hits = searchVaultKnowledge({
      vaultPath,
      roots: ['Acesso Equipamentos/Mecanica/Conhecimento'],
      query: 'plataforma articulada Z34 não abaixa a gaiola',
    });
    expect(hits[0]?.title).toMatch(/Plataformas/i);
    expect(hits[0]?.excerpt).toContain('Z34');
  });
});

describe('playbook learning', () => {
  it('ranks resolved lessons above a price-only quote', () => {
    const resolved = [
      'Tipo: qualificacao',
      'Situação: tesoura em Contagem.',
      'O que a equipe fez: pediu altura e período e passou ao comercial.',
      'Resultado: proposta',
      'Lição: PF não pede CNPJ na triagem.',
      'Preço: não citado',
    ].join('\n');
    const priced = 'Tipo: negociacao\nPreço: R$ 350 a diária\nDias: 3 dias\nFrete: não citado';
    expect(summaryLearningHeat(resolved)).toBeGreaterThan(summaryLearningHeat(priced));
    const picked = pickSummariesForPlaybook(
      [{ summary: priced }, { summary: resolved }],
      1,
    );
    expect(picked[0]?.summary).toContain('Lição');
  });

  it('searches trained modules on a rental turn', () => {
    expect(shouldSearchAttendanceModules('ola')).toBe(false);
    expect(shouldSearchAttendanceModules('quero locar tesoura em contagem')).toBe(true);
  });

  it('feeds current methods and modules into the next training pass', () => {
    const vaultPath = mkdtempSync(join(tmpdir(), 'prior-playbook-'));
    vaultDirs.push(vaultPath);
    const folder = 'Acesso Equipamentos/Comercial';
    mkdirSync(join(vaultPath, folder), { recursive: true });
    writeFileSync(
      join(vaultPath, folder, 'Como atendemos.md'),
      '---\ntitle: Como atendemos\nfonte: chatpro-playbook\n---\n# Como atendemos\nPedir cidade e período.\n',
      'utf8',
    );
    applyOperationalModules({
      vaultPath,
      folder,
      team: 'comercial',
      now: new Date('2026-09-01T12:00:00.000Z'),
      plan: {
        upsert: [{
          id: 'qualificacao-obra',
          title: 'Qualificação da obra',
          body: 'Pedir cidade, prazo e equipamento. Não fechar valor na hora. O comercial orça no horário.',
          reason: 'fluxo observado',
        }],
        remove: [],
      },
    });
    const prior = readPriorPlaybookContext({ vaultPath, folder });
    expect(prior).toContain('Pedir cidade e período');
    expect(prior).toContain('qualificacao-obra');
    expect(prior).toContain('A nota humana vence o playbook gerado');
  });
});

describe('applyOperationalModules', () => {
  it('creates edits and deletes ai-owned modules and skips human notes', () => {
    const vaultPath = mkdtempSync(join(tmpdir(), 'modulos-'));
    vaultDirs.push(vaultPath);
    const folder = 'Acesso Equipamentos/Comercial';
    const humanPath = join(vaultPath, folder, 'Notas humanas.md');
    mkdirSync(join(vaultPath, folder, 'Manuais'), { recursive: true });
    writeFileSync(humanPath, '---\ntitle: Notas humanas\nfonte: humano\n---\n# humano\n', 'utf8');
    writeFileSync(join(vaultPath, folder, 'Manuais', 'Z34.md'), '# emergência\n', 'utf8');

    const created = applyOperationalModules({
      vaultPath,
      folder,
      team: 'comercial',
      now: new Date('2026-08-31T18:00:00.000Z'),
      plan: {
        upsert: [{
          id: 'qualificacao-obra',
          title: 'Qualificação da obra',
          body: 'Pedir cidade, prazo, equipamento e se já tem ART antes de orçar. Não fechar valor na hora.',
          reason: 'fluxo recorrente nas conversas',
        }],
        remove: [],
      },
    });
    const modulePath = join(vaultPath, folder, 'Modulos', 'qualificacao-obra.md');
    expect(created.created).toEqual(['Modulos/qualificacao-obra.md']);
    expect(readFileSync(modulePath, 'utf8')).toContain('Qualificação da obra');
    expect(isAiOwnedModule(readFileSync(modulePath, 'utf8'), 'Modulos/qualificacao-obra.md')).toBe(true);

    applyOperationalModules({
      vaultPath,
      folder,
      team: 'comercial',
      now: new Date('2026-08-31T18:10:00.000Z'),
      plan: {
        upsert: [{
          id: 'qualificacao-obra',
          title: 'Qualificação da obra',
          body: 'Pedir cidade, prazo, equipamento, acesso de carga e se já tem ART. Comercial confirma valor depois.',
          reason: 'o time passou a pedir acesso de carga',
        }],
        remove: [],
      },
    });
    expect(readFileSync(modulePath, 'utf8')).toContain('acesso de carga');

    const removed = applyOperationalModules({
      vaultPath,
      folder,
      team: 'comercial',
      now: new Date('2026-08-31T18:20:00.000Z'),
      plan: {
        upsert: [],
        remove: [
          { id: 'qualificacao-obra', reason: 'fluxo absorvido pelo comercial humano' },
          { id: slugifyModuleId('Notas humanas'), reason: 'não deveria apagar' },
        ],
      },
    });
    expect(existsSync(modulePath)).toBe(false);
    expect(removed.deleted).toEqual(['Modulos/qualificacao-obra.md']);
    expect(existsSync(humanPath)).toBe(true);
    expect(existsSync(join(vaultPath, folder, 'Manuais', 'Z34.md'))).toBe(true);
  });

  it('skips rewrite when title and body are unchanged', () => {
    const vaultPath = mkdtempSync(join(tmpdir(), 'modulos-skip-'));
    vaultDirs.push(vaultPath);
    const folder = 'Acesso Equipamentos/Comercial';
    const plan = {
      upsert: [{
        id: 'qualificacao-obra',
        title: 'Qualificação da obra',
        body: 'Pedir cidade, prazo, equipamento e se já tem ART antes de orçar. Não fechar valor na hora.',
        reason: 'fluxo recorrente nas conversas',
      }],
      remove: [] as { id: string; reason: string }[],
    };
    applyOperationalModules({
      vaultPath,
      folder,
      team: 'comercial',
      now: new Date('2026-08-31T18:00:00.000Z'),
      plan,
    });
    const modulePath = join(vaultPath, folder, 'Modulos', 'qualificacao-obra.md');
    const first = readFileSync(modulePath, 'utf8');
    const second = applyOperationalModules({
      vaultPath,
      folder,
      team: 'comercial',
      now: new Date('2026-08-31T19:00:00.000Z'),
      plan,
    });
    expect(second.skipped).toContain('qualificacao-obra');
    expect(second.updated).toEqual([]);
    expect(readFileSync(modulePath, 'utf8')).toBe(first);
  });

  it('deletes modules that teach the night bot to ask cnpj', () => {
    const vaultPath = mkdtempSync(join(tmpdir(), 'modulos-unsafe-'));
    vaultDirs.push(vaultPath);
    const folder = 'Acesso Equipamentos/Comercial';
    const dir = join(vaultPath, folder, 'Modulos');
    mkdirSync(dir, { recursive: true });
    const unsafePath = join(dir, `${TRIAGE_UNSAFE_MODULE_IDS[0]}.md`);
    writeFileSync(unsafePath, [
      '---',
      'title: Qualificação PF/PJ',
      'tipo: modulo-operacional',
      `id: ${TRIAGE_UNSAFE_MODULE_IDS[0]}`,
      'equipe: comercial',
      'fonte: chatpro-playbook',
      'protegido: false',
      '---',
      '',
      '# Qualificação PF/PJ',
      '',
      'Pedir CNPJ na primeira mensagem.',
      '',
    ].join('\n'), 'utf8');
    const removed = applyOperationalModules({
      vaultPath,
      folder,
      team: 'comercial',
      now: new Date('2026-08-31T18:00:00.000Z'),
      plan: { upsert: [], remove: [] },
    });
    expect(removed.deleted).toContain(`Modulos/${TRIAGE_UNSAFE_MODULE_IDS[0]}.md`);
    expect(existsSync(unsafePath)).toBe(false);
  });
});

describe('ops keys', () => {
  it('builds stable playbook and media idempotency keys', () => {
    const fingerprint = {
      messageCount: 12,
      lastSentAt: '2026-08-31T12:00:00.000Z',
      mediaTextCount: 3,
    };
    expect(fingerprintKey(fingerprint)).toBe('12:2026-08-31T12:00:00.000Z:3');
    expect(playbookIdempotencyKey('comercial', fingerprint))
      .toBe('playbook:comercial:12:2026-08-31T12:00:00.000Z:3');
    expect(mediaIdempotencyKey('msg-1')).toBe('media:msg-1');
  });

  it('skips vault write when the fingerprint matches and force is off', () => {
    expect(shouldSkipVaultWrite({
      cachedKey: '12:none:0',
      currentKey: '12:none:0',
      force: false,
    })).toBe(true);
    expect(shouldSkipVaultWrite({
      cachedKey: '12:none:0',
      currentKey: '12:none:0',
      force: true,
    })).toBe(false);
    expect(shouldSkipVaultWrite({
      cachedKey: '12:none:0',
      currentKey: '13:none:0',
      force: false,
    })).toBe(false);
  });

  it('requeues failed jobs and keeps queued running or done', () => {
    expect(resolveEnqueueStatus({ existing: null, force: false })).toBe('queued');
    expect(resolveEnqueueStatus({ existing: 'queued', force: false })).toBe('keep');
    expect(resolveEnqueueStatus({ existing: 'running', force: false })).toBe('keep');
    expect(resolveEnqueueStatus({ existing: 'done', force: false })).toBe('keep');
    expect(resolveEnqueueStatus({ existing: 'done', force: true })).toBe('queued');
    expect(resolveEnqueueStatus({ existing: 'failed', force: false })).toBe('queued');
  });

  it('steals a running lock after twenty minutes', () => {
    const now = new Date('2026-08-31T18:00:00.000Z');
    expect(isStaleJobLock(new Date('2026-08-31T17:39:00.000Z'), now)).toBe(true);
    expect(isStaleJobLock(new Date('2026-08-31T17:41:00.000Z'), now)).toBe(false);
  });
});

describe('searchFleetCatalog', () => {
  it('returns a few matching types and refuses off-catalog names', () => {
    const tesoura = searchFleetCatalog({ query: 'plataforma tesoura' });
    expect(tesoura.length).toBeGreaterThan(0);
    expect(tesoura.length).toBeLessThanOrEqual(5);
    expect(tesoura.some((hit) => /tesoura|plataforma|gs /iu.test(hit.name))).toBe(true);

    const misses = searchFleetCatalog({ query: 'caminhao bitrem' });
    expect(formatFleetCatalogHits(misses)).toContain('não locamos');
  });

  it('finds tesoura models and does not swap in articulada', () => {
    const hits = searchFleetCatalog({
      query: 'gostaria de fazer a locação de uma plataforma tesoura para o municipio de contagem',
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((hit) => hit.kind === 'tesoura')).toBe(true);
    expect(hits.some((hit) => /s-?80|160\s*atj|z45|z60|articulada/iu.test(hit.name))).toBe(false);
    expect(formatFleetCatalogHits(hits)).toMatch(/plataforma tesoura/iu);
    expect(formatFleetCatalogHits(hits)).toMatch(/GS 1930|GS 2632|GS 3246|GS 4655/iu);
  });

  it('ranks tesouras near 13 m when the lead asks that height', () => {
    const hits = searchFleetCatalog({
      query: 'plataforma tesoura de 13 metros de altura, locação por 3 dias',
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((hit) => hit.kind === 'tesoura')).toBe(true);
    expect(hits[0]?.name).toMatch(/4740|4632|4655|4046/iu);
  });

  it('finds tubo e bracadeira for andaimes and skips invented lines', () => {
    const hits = searchFleetCatalog({
      query: 'boa noite, voces trabalham com que tipo de andaimes?',
    });
    expect(hits.some((hit) => /tubo e bra/iu.test(hit.name))).toBe(true);
    expect(hits[0]?.name).toMatch(/tubo e bra/iu);
    expect(hits.every((hit) => /andaime tipo|tubo e bra/iu.test(hit.name))).toBe(true);
    expect(hits.every((hit) => !/alum[ií]nio/iu.test(hit.name))).toBe(true);
  });

  it('keeps tesoura in the sandbox retrieval block for the contagem thread', () => {
    const block = retrievedFleetBlock([
      'ola',
      'gostaria de fazer a locação de uma plataforma tesoura para o municipio de contagem',
      'de 13 metros de altura, locação por 3 dias',
    ]);
    expect(block).toMatch(/plataforma tesoura/iu);
    expect(block).not.toMatch(/Nenhum tipo com esse nome/iu);
  });

  it('marks caminhao pipa as off catalog', () => {
    const block = retrievedFleetBlock(['voces alugam caminhao pipa?']);
    expect(block).toMatch(/não locamos/iu);
  });

  it('keeps a supported gerador in a mixed equipment request', () => {
    const block = retrievedFleetBlock([
      'Preciso de um gerador 7 kVA e uma empilhadeira elétrica para Nova Lima por 30 dias.',
    ]);
    expect(block).toMatch(/gerador/iu);
    expect(block).not.toMatch(/Nenhum tipo com esse nome/iu);
    expect(block).toMatch(/fora do catálogo: empilhadeira/iu);
  });
});

describe('deterministic fleet recommendation', () => {
  it('recommends only an item whose catalog specs meet the requested load', () => {
    const result = recommendFleetEquipment({
      query: 'Qual equipamento recomenda para içar 200 kg de material na obra?',
      items: [{
        name: 'Guincho de Coluna 200kg',
        brands: [],
        models: [],
        description: 'Içamento vertical de materiais em obra',
        specs: [
          { label: 'Aplicação', value: 'Içamento vertical de materiais em obra' },
          { label: 'Capacidade', value: '200 kg' },
        ],
      }],
    });
    expect(result?.status).toBe('recommended');
    expect(formatFleetRecommendation(result!)).toContain('Guincho de Coluna 200kg');
    expect(formatFleetRecommendation(result!)).toContain('não confirma estoque nem disponibilidade');
  });

  it('does not invent a machine when no catalog capacity satisfies the need', () => {
    const result = recommendFleetEquipment({
      query: 'Preciso elevar pallets de 2 toneladas a 5 metros, qual equipamento recomenda?',
      items: [{
        name: 'Plataforma Mastro 6 m',
        brands: [],
        models: [],
        kind: 'mastro',
        heightM: 6,
        specs: [{ label: 'Capacidade / peso na plataforma', value: '227 kg' }],
      }],
    });
    expect(result).toMatchObject({ status: 'no_verified_match', item: null });
  });

  it('does not recommend any real catalog item for an unsupported two-ton pallet lift', () => {
    const result = recommendFleetEquipment({
      query: 'Preciso elevar pallets de 2 toneladas a 5 metros, qual equipamento recomenda?',
    });
    expect(result).toMatchObject({ status: 'no_verified_match', item: null });
  });
});

describe('ChatPro waiting queue handoff', () => {
  const departmentId = 'b8398ed0-56e9-4516-9828-e9f6f5278535';

  it('keeps sent_awaiting_unassign when the API fails', async () => {
    const result = await runWaitingQueueHandoffAttempt({
      sessionId: 'session-1',
      departmentId,
      previousAttempts: 0,
      client: {
        returnSessionToWaiting: async () => { throw new Error('chatpro_http_503'); },
        getSession: async () => ({
          raw: { department_id: departmentId, assing_to: 'bot-user', open: true },
        }),
      },
    });
    expect(result).toMatchObject({
      status: 'sent_awaiting_unassign',
      attempts: 1,
      shouldAlert: false,
    });
    expect(result.error).toContain('chatpro_http_503');
  });

  it('retries on the following cycle until ChatPro confirms the queue', async () => {
    let calls = 0;
    const sessions = [
      { raw: { department_id: departmentId, assing_to: 'bot-user', open: true } },
      { raw: { department_id: departmentId, assing_to: 'bot-user', open: true } },
      { raw: { department_id: departmentId, assing_to: '', open: true } },
    ];
    const client = {
      returnSessionToWaiting: async () => {
        calls += 1;
        if (calls === 1) {
          throw new Error('temporary_failure');
        }
        return { success: true };
      },
      getSession: async () => sessions.shift() ?? null,
    };
    const first = await runWaitingQueueHandoffAttempt({
      sessionId: 'session-retry', departmentId, previousAttempts: 0, client,
    });
    const second = await runWaitingQueueHandoffAttempt({
      sessionId: 'session-retry', departmentId, previousAttempts: first.attempts, client,
    });
    expect(first.status).toBe('sent_awaiting_unassign');
    expect(second).toMatchObject({ status: 'queued_verified', attempts: 2 });
    expect(calls).toBe(2);
  });

  it('never completes without a department and raises an alert after retries', async () => {
    let unassignCalls = 0;
    const result = await runWaitingQueueHandoffAttempt({
      sessionId: 'session-2',
      departmentId: null,
      previousAttempts: 2,
      client: {
        returnSessionToWaiting: async () => { unassignCalls += 1; },
        getSession: async () => null,
      },
    });
    expect(unassignCalls).toBe(0);
    expect(result).toEqual({
      status: 'sent_awaiting_unassign',
      attempts: 3,
      error: 'missing_department',
      shouldAlert: true,
    });
  });

  it('rejects a partial ChatPro response that does not confirm unassign', async () => {
    const result = await runWaitingQueueHandoffAttempt({
      sessionId: 'session-3',
      departmentId,
      previousAttempts: 0,
      client: {
        returnSessionToWaiting: async () => ({ success: true }),
        getSession: async () => ({ raw: { id: 'session-3', department_id: departmentId, open: true } }),
      },
    });
    expect(result).toMatchObject({
      status: 'sent_awaiting_unassign',
      error: 'unassign_not_confirmed',
    });
  });

  it('completes only after the fresh session is unassigned in the expected queue', async () => {
    expect(verifyWaitingQueueSession({
      department_id: departmentId,
      user_id: null,
      status: 'waiting',
      open: true,
    }, departmentId)).toEqual({ verified: true, reason: 'waiting_queue_confirmed' });

    const sessions = [
      { raw: { department_id: departmentId, assing_to: 'bot-user', open: true } },
      { raw: { department_id: departmentId, assing_to: '', open: true } },
    ];
    const result = await runWaitingQueueHandoffAttempt({
      sessionId: 'session-4',
      departmentId,
      previousAttempts: 1,
      client: {
        returnSessionToWaiting: async () => ({ success: true }),
        getSession: async () => sessions.shift() ?? null,
      },
    });
    expect(result).toEqual({
      status: 'queued_verified',
      attempts: 2,
      error: null,
      shouldAlert: false,
    });
  });

  it('does not accept a session that still has an attendant or changed queue', () => {
    expect(verifyWaitingQueueSession({
      department_id: departmentId,
      attendant_id: 'seller-1',
      status: 'waiting',
      open: true,
    }, departmentId).verified).toBe(false);
    expect(verifyWaitingQueueSession({
      department_id: 'another-department',
      attendant_id: null,
      status: 'waiting',
      open: true,
    }, departmentId).reason).toBe('wrong_department');
  });

  it('accepts the real ChatPro assing_to field only when it is empty', () => {
    expect(verifyWaitingQueueSession({
      department_id: departmentId,
      assing_to: '',
      open: true,
    }, departmentId)).toEqual({ verified: true, reason: 'waiting_queue_confirmed' });
    expect(verifyWaitingQueueSession({
      department_id: departmentId,
      assing_to: 'seller-1',
      open: true,
    }, departmentId).reason).toBe('attendant_still_assigned');
  });

  it('does not unassign when a human claims the session between attempts', async () => {
    let unassignCalls = 0;
    const result = await runWaitingQueueHandoffAttempt({
      sessionId: 'session-human',
      departmentId,
      previousAttempts: 1,
      originalAssignment: { departmentId, assigneeId: 'bot-user', assignedAt: 'before' },
      client: {
        returnSessionToWaiting: async () => { unassignCalls += 1; },
        getSession: async () => ({
          raw: { department_id: departmentId, assing_to: 'seller-1', date_assign: 'after' },
        }),
      },
    });
    expect(result.status).toBe('human_claimed');
    expect(unassignCalls).toBe(0);
  });

  it('moves the chat from its own department into the waiting queue', async () => {
    const assigned: Array<{ sessionId: string; departmentId: string }> = [];
    const sessions = [
      { raw: { department_id: departmentId, assing_to: 'bianca', date_assign: 'before', open: true } },
      { raw: { department_id: WAITING_QUEUE_DEPARTMENT_ID, assing_to: '', open: true } },
    ];
    const result = await runWaitingQueueHandoffAttempt({
      sessionId: 'session-queue',
      departmentId: WAITING_QUEUE_DEPARTMENT_ID,
      previousAttempts: 0,
      originalAssignment: { departmentId, assigneeId: 'bianca', assignedAt: 'before' },
      client: {
        returnSessionToWaiting: async (options) => { assigned.push(options); },
        getSession: async () => sessions.shift() ?? null,
      },
    });
    expect(result).toMatchObject({ status: 'queued_verified', attempts: 1 });
    expect(assigned).toEqual([
      { sessionId: 'session-queue', departmentId: WAITING_QUEUE_DEPARTMENT_ID },
    ]);
  });

  it('keeps unassigning on the pilot when ChatPro re-assigns the attendant', async () => {
    let unassignCalls = 0;
    const sessions = [
      { raw: { department_id: departmentId, assing_to: 'bianca', date_assign: 'after', open: true } },
      { raw: { department_id: departmentId, assing_to: '', open: true } },
    ];
    const result = await runWaitingQueueHandoffAttempt({
      sessionId: 'session-force',
      departmentId,
      previousAttempts: 0,
      forceUnassign: true,
      originalAssignment: { departmentId, assigneeId: 'bot-user', assignedAt: 'before' },
      client: {
        returnSessionToWaiting: async () => { unassignCalls += 1; },
        getSession: async () => sessions.shift() ?? null,
      },
    });
    expect(result).toMatchObject({ status: 'queued_verified', attempts: 1 });
    expect(unassignCalls).toBe(1);
  });

  it('does not move the session back after a department transfer', async () => {
    let unassignCalls = 0;
    const result = await runWaitingQueueHandoffAttempt({
      sessionId: 'session-transfer',
      departmentId,
      previousAttempts: 1,
      originalAssignment: { departmentId, assigneeId: 'bot-user', assignedAt: null },
      client: {
        returnSessionToWaiting: async () => { unassignCalls += 1; },
        getSession: async () => ({
          raw: { department_id: 'new-department', assing_to: '', open: true },
        }),
      },
    });
    expect(result.status).toBe('transferred');
    expect(unassignCalls).toBe(0);
  });
});

describe('triage learn', () => {
  it('asks the bot to collect start when the commercial had to complete it', () => {
    const lessons = [...learnTriageFromThread({
      messages: [
        { from_me: false, body: 'preciso de tesoura em contagem por 3 dias' },
        { from_me: true, bot_origin: true, body: 'Recebemos. O comercial retorna no horário.' },
        { from_me: true, bot_origin: false, body: 'Para quando você precisa da máquina?' },
      ],
    }).values()];
    expect(lessons.some((lesson) => lesson.id === 'fix-start-missing')).toBe(true);
  });

  it('flags a bot that re-asks when the customer already gave the full triage', () => {
    const lessons = [...learnTriageFromThread({
      messages: [
        { from_me: false, body: 'tesoura em betim por 10 dias a partir de amanhã' },
        { from_me: true, bot_origin: true, body: 'Qual a cidade da obra e para quando você precisa?' },
      ],
    }).values()];
    expect(lessons.some((lesson) => lesson.id === 'fix-reask-complete')).toBe(true);
  });

  it('keeps a clean handoff when triage was already complete', () => {
    const learned = learnTriageFromThreads([{
      messages: [
        { from_me: false, body: 'tesoura em betim por 10 dias amanhã' },
        { from_me: true, bot_origin: true, body: 'Trabalhamos com tesoura. Sua mensagem já chegou. O comercial retorna no horário útil.' },
      ],
    }]);
    expect(learned.keep.join(' ')).toMatch(/confirme o tipo/iu);
    expect(learned.fix).toEqual([]);
  });

  it('turns sandbox judge names into bot-facing fixes', () => {
    expect(sandboxFailuresToLines(['dois-equipamentos#1: confirma tesoura'])).toEqual([
      'Nomeie tesoura quando o pedido for tesoura. Não omita o tipo nem troque por articulada.',
    ]);
  });

  it('writes sandbox failures without wiping WhatsApp lessons', () => {
    const vaultPath = mkdtempSync(join(tmpdir(), 'triage-learn-'));
    vaultDirs.push(vaultPath);
    const folder = 'Acesso Equipamentos/Comercial';
    writeTriageLearnFromThreads({
      vaultPath,
      folder,
      now: new Date('2026-09-03T12:00:00.000Z'),
      threads: [{
        messages: [
          { from_me: false, body: 'tesoura em contagem por 3 dias' },
          { from_me: true, bot_origin: true, body: 'Recebemos.' },
          { from_me: true, body: 'Para quando você precisa?' },
        ],
      }],
    });
    recordSandboxTriageRun({
      vaultPath,
      folder,
      suite: 'battery',
      failures: ['andaime-pf#2: pede para quando começa'],
      now: new Date('2026-09-03T13:00:00.000Z'),
    });
    const note = parseTriageLearnNote(readFileSync(
      join(vaultPath, folder, 'Aprendizado da triagem.md'),
      'utf8',
    ));
    expect(note.fix.join(' ')).toMatch(/para quando começa/iu);
    expect(note.sandbox.join(' ')).toMatch(/para quando começa a locação/iu);
  });
});

describe('mentionsRentalStart', () => {
  it('detects when the customer already said the rental start', () => {
    expect(mentionsRentalStart('preciso para amanhã')).toBe(true);
    expect(mentionsRentalStart('para quando seria a locação? 15/09')).toBe(true);
    expect(mentionsRentalStart('urgente, esta semana')).toBe(true);
    expect(mentionsRentalStart('plataforma tesoura 3 dias em BH')).toBe(false);
  });
});

describe('captured estimates', () => {
  const notes = [
    '## Plataforma tesoura',
    'Período citado: 30 dias',
    'Captado em conversa, não oficial: R$ 4.800 no mês',
    'Frete citado: R$ 16.320',
    '',
    '## Martelete 5kg',
    'Período citado: diária, semanal (7 dias)',
    'Captado em conversa, não oficial: Martelete 5kg',
    'Frete citado: não citado',
  ].join('\n');

  it('matches the same family and day count and ignores freight', () => {
    const rows = parseCapturedValueNotes(notes);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.amount).toMatch(/4\.800/);
    expect(matchCapturedEstimates({
      rows,
      userTurns: ['plataforma tesoura para 30 dias, preço estimado'],
    })).toHaveLength(1);
    expect(matchCapturedEstimates({
      rows,
      userTurns: ['plataforma tesoura por 3 dias, preço estimado'],
    })).toHaveLength(0);
    expect(formatCapturedEstimateBlock(rows)).not.toMatch(/16\.320/);
  });

  it('does not retrieve an estimate without type and period', () => {
    expect(shouldRetrieveCapturedEstimate(['me passa o valor da tesoura'])).toBe(false);
    expect(shouldRetrieveCapturedEstimate(['tesoura em Contagem por 3 dias, preço estimado'])).toBe(true);
  });
});
