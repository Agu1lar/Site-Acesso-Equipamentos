import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  executeAttendanceAgentTool,
  runAttendanceAgent,
  validateAttendanceDecision,
  type AttendanceEvidence,
} from '../../chatpro-playbook/src/attendance-agent';
import { mergeAttendanceAgentState } from '../../chatpro-playbook/src/attendance-state';
import {
  attendanceReplyLooksUnsafe,
  replyAsAttendanceBot,
} from '../../chatpro-playbook/src/attendance-brain';

function evidence(): AttendanceEvidence {
  return {
    catalogIds: new Set<string>(),
    knowledgeIds: new Set<string>(),
    resolvedDates: new Set<string>(),
  };
}

function decision(overrides: Record<string, unknown> = {}) {
  const facts = {
    equipment: null,
    application: null,
    heightM: null,
    capacityKg: null,
    volumeL: null,
    city: null,
    startDate: null,
    durationDays: null,
    symptom: null,
    location: null,
    peopleAtRisk: null,
    trainingPeople: null,
    notes: [],
    ...(typeof overrides.facts === 'object' && overrides.facts ? overrides.facts : {}),
  };
  return {
    intent: 'company_question',
    reply: 'A equipe comercial continuará seu atendimento no horário comercial, de segunda a sexta, 7h30–17h15.',
    questions: [],
    resetState: false,
    missingInformation: [],
    claims: [],
    recommendation: null,
    handoff: {
      required: true,
      department: 'general',
      reason: 'Confirmação humana necessária',
      queueAction: 'keep_waiting',
    },
    confidence: 0.8,
    complexity: 'routine',
    ...overrides,
    facts,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Attendance agent', () => {
  it('rejects claims whose source was not consulted', () => {
    const result = validateAttendanceDecision(decision({
      claims: [{
        text: 'A empresa oferece treinamento.',
        category: 'company',
        sourceType: 'knowledge',
        sourceId: 'knowledge:treinamento',
      }],
    }), evidence());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('Nenhuma nota interna foi encontrada');
    }
  });

  it('treats an implicit equipment-availability promise as unsafe', () => {
    expect(attendanceReplyLooksUnsafe(
      'Conseguir equipamento em Nova Lima por 12 dias não é problema.',
    )).toBe(true);
    expect(attendanceReplyLooksUnsafe(
      'O comercial vai montar uma proposta com valores e frete.',
    )).toBe(true);
  });

  it('repairs a missing question while core commercial triage is incomplete', () => {
    const result = validateAttendanceDecision(decision({
      intent: 'commercial',
      facts: {
        equipment: 'plataforma tesoura',
        city: 'Contagem',
        durationDays: 3,
      },
      missingInformation: ['data de início'],
      questions: [],
      handoff: {
        required: true,
        department: 'commercial',
        reason: 'Orçamento humano necessário',
        queueAction: 'keep_waiting',
      },
    }), evidence());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decision.questions).toEqual(['Para quando você precisa começar?']);
    }
  });

  it('confirms registration when all core commercial facts are complete', () => {
    const turnEvidence = evidence();
    turnEvidence.resolvedDates.add('2026-09-25');
    const result = validateAttendanceDecision(decision({
      intent: 'commercial',
      reply: 'Gerador em Nova Lima, começando em 25 de setembro, por 7 dias.',
      facts: {
        equipment: 'gerador',
        city: 'Nova Lima',
        startDate: '2026-09-25',
        durationDays: 7,
      },
      handoff: {
        required: true,
        department: 'commercial',
        reason: 'Orçamento humano necessário',
        queueAction: 'keep_waiting',
      },
    }), turnEvidence);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decision.reply).toContain('Sua solicitação está registrada.');
      expect(result.decision.questions).toEqual(['Precisa de mais alguma coisa?']);
    }
  });

  it('rejects a completed-registration claim while commercial triage is incomplete', () => {
    const result = validateAttendanceDecision(decision({
      intent: 'commercial',
      reply: 'Trabalhamos com martelo demolidor. Sua solicitação já está anotada.',
      facts: { equipment: 'martelo demolidor 10 kg', capacityKg: 10 },
      questions: ['Qual é a cidade?', 'Para quando você precisa?'],
      handoff: {
        required: true,
        department: 'commercial',
        reason: 'Orçamento humano necessário',
        queueAction: 'keep_waiting',
      },
    }), evidence(), {}, {
      currentUserText: 'Quero alugar um martelo 10kg.',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('triagem comercial ainda está incompleta');
    }
  });

  it('rejects rental-triage questions for a training-only request', () => {
    const result = validateAttendanceDecision(decision({
      intent: 'commercial',
      reply: 'Oferecemos treinamento PEMT.',
      questions: ['Qual equipamento você precisa?', 'Em qual cidade será o uso?'],
      facts: { application: 'treinamento PEMT' },
      handoff: {
        required: true,
        department: 'commercial',
        reason: 'Agendamento humano necessário',
        queueAction: 'keep_waiting',
      },
    }), evidence(), {}, {
      currentUserText: 'Vocês oferecem curso de PEMT?',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('perguntou apenas sobre treinamento');
    }
  });

  it('does not store PEMT as rented equipment for a training-only request', () => {
    const result = validateAttendanceDecision(decision({
      intent: 'company_question',
      reply: 'Oferecemos treinamento PEMT com certificado e carteirinha.',
      questions: ['Quantas pessoas precisam do treinamento?', 'Para qual data?'],
      facts: { equipment: 'PEMT', application: 'treinamento' },
      handoff: {
        required: true,
        department: 'commercial',
        reason: 'Agendamento humano necessário',
        queueAction: 'keep_waiting',
      },
    }), evidence(), {}, {
      currentUserText: 'Vocês fornecem treinamento em PEMT?',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('não um equipamento solicitado');
    }
  });

  it('does not accept state reset for an isolated greeting', () => {
    const result = validateAttendanceDecision(decision({
      intent: 'greeting',
      resetState: true,
      reply: 'Bom dia! Como posso ajudar?',
    }), evidence(), { equipment: 'andaime', city: 'Ribeirão das Neves' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('não pode apagar a triagem');
    }
  });

  it('does not recap persisted triage facts in an isolated greeting', () => {
    const result = validateAttendanceDecision(decision({
      intent: 'greeting',
      reply: 'Oi! Tudo bem.',
      questions: ['Como posso ajudar?'],
      facts: { equipment: 'andaime', city: 'Ribeirão das Neves' },
    }), evidence(), { equipment: 'andaime', city: 'Ribeirão das Neves' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('não repita nem recoloque fatos');
    }
  });

  it('keeps an isolated greeting open instead of assuming a rental', () => {
    const result = validateAttendanceDecision(decision({
      intent: 'greeting',
      reply: 'Olá! Sou a IA Eva.',
      questions: ['Qual equipamento você precisa?'],
    }), evidence());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('não presuma locação');
    }
  });

  it('repairs an isolated greeting that omitted the open question', () => {
    const result = validateAttendanceDecision(decision({
      intent: 'greeting',
      reply: 'Oi!',
      questions: [],
    }), evidence());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decision.questions).toEqual(['Como posso ajudar?']);
    }
  });

  it('requires a brief closing when the customer says they need nothing else', () => {
    const wrong = validateAttendanceDecision(decision({
      intent: 'commercial',
      reply: 'Seu pedido de andaime está registrado.',
      facts: { equipment: 'andaime' },
      questions: ['Precisa de mais alguma coisa?'],
    }), evidence(), { equipment: 'andaime' }, {
      currentUserText: 'Não precisa de mais nada',
    });
    const correct = validateAttendanceDecision(decision({
      intent: 'closing',
      reply: 'Certo, agradeço o contato.',
      questions: [],
    }), evidence(), { equipment: 'andaime' }, {
      currentUserText: 'Não precisa de mais nada',
    });

    expect(wrong.ok).toBe(false);
    expect(correct.ok).toBe(true);
  });

  it('requires an explicit reset for a different equipment after a greeting', () => {
    const result = validateAttendanceDecision(decision({
      intent: 'commercial',
      facts: { equipment: 'martelo demolidor', city: 'Contagem' },
      questions: ['Para quando você precisa?', 'Por quantos dias?'],
    }), evidence(), { equipment: 'andaime', city: 'Ribeirão das Neves' }, {
      previousIntent: 'greeting',
      currentUserText: 'Pode ser um martelo demolidor',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('equipamento diferente inicia assunto novo');
    }
  });

  it('requires the calendar tool whenever the customer gives a relative date', () => {
    const result = validateAttendanceDecision(decision({
      intent: 'commercial',
      facts: {
        equipment: 'andaime',
        city: 'Ribeirão das Neves',
        durationDays: 10,
      },
      questions: ['Qual é o endereço da obra?'],
    }), evidence(), {}, {
      currentUserText: 'Começa terça da semana que vem, por 10 dias',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('Use resolve_date_expression');
    }
  });

  it('rejects commercial dates carried into a mechanical decision', () => {
    const result = validateAttendanceDecision(decision({
      intent: 'mechanical',
      resetState: true,
      facts: {
        equipment: 'gerador',
        symptom: 'não liga',
        startDate: '2026-09-25',
        durationDays: 7,
      },
      handoff: {
        required: true,
        department: 'mechanical',
        reason: 'Falha mecânica requer atendimento humano',
        queueAction: 'keep_waiting',
      },
    }), evidence(), {
      equipment: 'plataforma tesoura',
      city: 'Nova Lima',
      startDate: '2026-09-25',
      durationDays: 7,
    }, {
      currentUserText: 'Agora é outro assunto: o gerador não liga.',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('exclusivos da triagem comercial');
    }
  });

  it('defaults omitted optional collections and resets a cross-department workflow', () => {
    const raw = decision({
      intent: 'mechanical',
      resetState: false,
      facts: { equipment: 'plataforma articulada', city: 'Nova Lima', symptom: 'não sobe' },
      handoff: {
        required: true,
        department: 'mechanical',
        reason: 'Falha mecânica requer atendimento humano',
        queueAction: 'keep_waiting',
      },
    }) as Record<string, unknown>;
    delete raw.missingInformation;
    delete raw.claims;
    delete raw.recommendation;

    const result = validateAttendanceDecision(raw, evidence(), {
      equipment: 'gerador',
      city: 'Nova Lima',
      startDate: '2026-09-25',
      durationDays: 7,
    }, {
      previousIntent: 'commercial',
      currentUserText: 'A articulada parou de subir.',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.decision.resetState).toBe(true);
      expect(result.decision.facts.city).toBeNull();
      expect(result.decision.missingInformation).toEqual([]);
      expect(result.decision.claims).toEqual([]);
      expect(result.decision.recommendation).toBeNull();
    }
  });

  it('rejects an ungrounded emergency procedure saved in mechanical notes', () => {
    const result = validateAttendanceDecision(decision({
      intent: 'mechanical',
      facts: {
        equipment: 'plataforma articulada',
        symptom: 'não sobe',
        notes: ['Potencial necessidade de descer pela válvula de emergência'],
      },
      handoff: {
        required: true,
        department: 'mechanical',
        reason: 'Falha mecânica requer atendimento humano',
        queueAction: 'keep_waiting',
      },
    }), evidence(), {}, {
      currentUserText: 'A articulada parou de subir com gente na cesta.',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('procedimento técnico');
    }
  });

  it('acknowledges a catalog family named in the current commercial request', () => {
    const turnEvidence = evidence();
    turnEvidence.catalogIds.add('catalog-family:tesoura');
    const result = validateAttendanceDecision(decision({
      intent: 'commercial',
      reply: 'O valor é confirmado pelo comercial no horário útil.',
      questions: ['Em qual cidade será o uso?', 'Para quando você precisa começar?'],
      facts: { equipment: 'plataforma tesoura' },
      claims: [],
      handoff: {
        required: true,
        department: 'commercial',
        reason: 'Orçamento humano necessário',
        queueAction: 'keep_waiting',
      },
    }), turnEvidence, {}, { currentUserText: 'Qual o valor da plataforma tesoura?' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('reconheça essa família');
    }
  });

  it('does not infer a person at risk from an elevated-platform question', () => {
    const result = validateAttendanceDecision(decision({
      intent: 'mechanical',
      reply: 'A equipe de mecânica avaliará com segurança.',
      facts: { equipment: 'plataforma tesoura', peopleAtRisk: true },
      handoff: {
        required: true,
        department: 'mechanical',
        reason: 'Avaliação técnica humana necessária',
        queueAction: 'keep_waiting',
      },
    }), evidence(), {}, {
      currentUserText: 'A tesoura pode andar com a cesta elevada?',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('peopleAtRisk');
    }
  });

  it('keeps liters out of the kilogram capacity field', () => {
    const result = validateAttendanceDecision(decision({
      intent: 'commercial',
      reply: 'Trabalhamos com betoneira.',
      questions: ['Em qual cidade será o uso?', 'Para quando você precisa começar?'],
      facts: { equipment: 'betoneira 300 litros', capacityKg: 300 },
    }), evidence(), {}, { currentUserText: 'Preciso de betoneira de 300 litros' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('Use volumeL');
    }
  });

  it('rejects literal unicode escapes in customer-facing text', () => {
    const result = validateAttendanceDecision(decision({
      reply: 'Locamos martelo para demoli\\u00e7\\u00e3o.',
    }), evidence());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toContain('escapes Unicode literais');
    }
  });

  it('returns catalog evidence without stock or price fields', async () => {
    const turnEvidence = evidence();
    const result = await executeAttendanceAgentTool({
      name: 'search_catalog',
      input: { query: 'plataforma tesoura para 10 metros' },
      evidence: turnEvidence,
    });

    expect(result).toMatchObject({ availability: 'unknown' });
    expect(JSON.stringify(result)).not.toMatch(/price|quantity|stock/iu);
    expect(turnEvidence.catalogIds.size).toBeGreaterThan(0);
  });

  it('runs a knowledge tool before accepting the final decision', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({
        stop_reason: 'tool_use',
        content: [{
          type: 'tool_use',
          id: 'tool-1',
          name: 'search_company_knowledge',
          input: { query: 'horário comercial' },
        }],
      }, { status: 200 }))
      .mockResolvedValueOnce(Response.json({
        stop_reason: 'tool_use',
        content: [{
          type: 'tool_use',
          id: 'tool-2',
          name: 'submit_attendance_decision',
          input: decision({
            claims: [{
              text: 'O horário comercial é de segunda a sexta, 7h30–17h15.',
              category: 'company',
              sourceType: 'knowledge',
              sourceId: 'knowledge:horario',
            }],
          }),
        }],
      }, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runAttendanceAgent({
      apiKey: 'test-key',
      model: 'test-model',
      system: [],
      messages: [{ role: 'user', content: 'Qual é o horário?' }],
      searchKnowledge: () => [{
        id: 'knowledge:horario',
        title: 'Horário',
        excerpt: 'Atendimento de segunda a sexta, 7h30–17h15.',
      }],
    });

    expect(result.decision?.handoff.queueAction).toBe('keep_waiting');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondRequest = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(secondRequest.messages.at(-1).content[0]).toMatchObject({
      type: 'tool_result',
      tool_use_id: 'tool-1',
    });
  });

  it('preserves prior facts until the model starts a new subject', () => {
    const first = mergeAttendanceAgentState({
      decision: decision({
        intent: 'commercial',
        facts: { equipment: 'tesoura', city: 'Contagem' },
      }),
      inboundMessageId: 'message-1',
      now: new Date('2026-09-22T20:00:00Z'),
    });
    const continued = mergeAttendanceAgentState({
      previous: first,
      decision: decision({
        intent: 'commercial',
        facts: { durationDays: 3 },
      }),
      inboundMessageId: 'message-2',
      now: new Date('2026-09-22T20:01:00Z'),
    });
    const reset = mergeAttendanceAgentState({
      previous: continued,
      decision: decision({
        intent: 'mechanical',
        resetState: true,
        facts: { symptom: 'não liga' },
      }),
      inboundMessageId: 'message-3',
      now: new Date('2026-09-22T20:02:00Z'),
    });

    expect(continued.facts).toEqual({
      equipment: 'tesoura',
      city: 'Contagem',
      durationDays: 3,
    });
    expect(reset.facts).toEqual({ symptom: 'não liga' });
    expect(reset.turnCount).toBe(3);
  });

  it('routes a complex decision to the configured strong model', async () => {
    const responseFor = (id: string, input: Record<string, unknown>) => Response.json({
      stop_reason: 'tool_use',
      content: [{
        type: 'tool_use',
        id,
        name: 'submit_attendance_decision',
        input,
      }],
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(responseFor('fast-decision', decision({
        confidence: 0.7,
        complexity: 'complex',
      })))
      .mockResolvedValueOnce(responseFor('strong-decision', decision({
        reply: 'Analisei o caso com mais cuidado. A equipe responsável continuará no horário comercial, de segunda a sexta, 7h30–17h15.',
        confidence: 0.95,
        complexity: 'routine',
      })));
    vi.stubGlobal('fetch', fetchMock);

    const reply = await replyAsAttendanceBot({
      apiKey: 'test-key',
      model: 'fast-model',
      strongModel: 'strong-model',
      vaultKnowledge: '',
      history: [],
      userText: 'Tenho duas máquinas com sintomas diferentes e preciso entender o encaminhamento.',
      offHours: true,
    });

    expect(reply.agentRun.escalatedModel).toBe('strong-model');
    expect(reply.text).toContain('Analisei o caso com mais cuidado');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).model).toBe('fast-model');
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)).model).toBe('strong-model');
  });

  it('removes emergency-control questions from the mechanical safety fallback', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({
      stop_reason: 'tool_use',
      content: [{
        type: 'tool_use',
        id: 'mechanical-decision',
        name: 'submit_attendance_decision',
        input: decision({
          intent: 'mechanical',
          reply: 'Desça pela válvula de emergência e vou ajudar com a máquina parada.',
          questions: [
            'Consegue descer pela alavanca de emergência?',
            'Em qual obra o equipamento está?',
          ],
          facts: { equipment: 'plataforma tesoura', symptom: 'não desce' },
          handoff: {
            required: true,
            department: 'mechanical',
            reason: 'Falha mecânica requer atendimento humano',
            queueAction: 'keep_waiting',
          },
        }),
      }],
    }, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const reply = await replyAsAttendanceBot({
      apiKey: 'test-key',
      model: 'fast-model',
      vaultKnowledge: '',
      history: [],
      userText: 'A plataforma tesoura não desce e está parada na obra.',
      offHours: true,
    });

    expect(reply.agentRun.outcome).toBe('safety_fallback');
    expect(reply.text).not.toMatch(/alavanca|comando de emergência|descida de emergência|válvula de emergência/iu);
    expect(reply.text).toContain('Em qual obra o equipamento está?');
    expect(reply.text).toContain('Interrompa o uso, mantenha distância');
    expect(reply.text).toContain('A equipe de mecânica retorna no horário comercial');
  });

  it('does not let the strong model downgrade a specific mechanical decision to unknown', async () => {
    const responseFor = (id: string, input: Record<string, unknown>) => Response.json({
      stop_reason: 'tool_use',
      content: [{
        type: 'tool_use',
        id,
        name: 'submit_attendance_decision',
        input,
      }],
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(responseFor('fast-mechanical', decision({
        intent: 'mechanical',
        reply: 'Use a descida de emergência.',
        facts: { equipment: 'plataforma articulada', symptom: 'não sobe' },
        handoff: {
          required: true,
          department: 'mechanical',
          reason: 'Falha mecânica requer atendimento humano',
          queueAction: 'keep_waiting',
        },
      })))
      .mockResolvedValueOnce(responseFor('strong-unknown', decision({
        intent: 'unknown',
        reply: 'Vou registrar para a equipe responsável.',
      })));
    vi.stubGlobal('fetch', fetchMock);

    const reply = await replyAsAttendanceBot({
      apiKey: 'test-key',
      model: 'fast-model',
      strongModel: 'strong-model',
      vaultKnowledge: '',
      history: [],
      userText: 'A plataforma articulada parou de subir.',
      offHours: true,
    });

    expect(reply.decision?.intent).toBe('mechanical');
    expect(reply.decision?.handoff.department).toBe('mechanical');
    expect(reply.agentRun.outcome).toBe('safety_fallback');
    expect(reply.text).not.toContain('descida de emergência');
  });

  it('grounds relative dates in the original customer text', async () => {
    const turnEvidence = evidence();
    const rejected = await executeAttendanceAgentTool({
      name: 'resolve_date_expression',
      input: { expression: 'hoje' },
      evidence: turnEvidence,
      dateSourceText: 'preciso de uma tesoura por três dias',
      now: new Date('2026-09-09T14:00:00Z'),
    });
    const accepted = await executeAttendanceAgentTool({
      name: 'resolve_date_expression',
      input: { expression: 'terça da semana que vem' },
      evidence: turnEvidence,
      dateSourceText: 'preciso para terça da semana que vem',
      now: new Date('2026-09-09T14:00:00Z'),
    });

    expect(rejected).toMatchObject({ confirmedDate: null });
    expect(accepted).toMatchObject({ confirmedDate: 'terça-feira, 15 de setembro de 2026' });
    expect(turnEvidence.resolvedDates).toContain('2026-09-15');
  });
});
