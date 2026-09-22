import { describe, expect, it } from 'vitest';
import {
  AFTER_HOURS_NOTICE_MARKER,
  decideAfterHoursNotice,
  isAttendanceTeamReply,
  isChatProTriageBotReply,
  type AfterHoursMessage,
  type AfterHoursSession,
} from '../../chatpro-playbook/src/after-hours-decide';
import {
  ATTENDANCE_BOT_NAME,
} from '../../chatpro-playbook/src/attendance-identity';
import {
  dateFromSaoPauloWallClock,
  isBusinessOpen,
  offHoursWindow,
  readSaoPauloClock,
  sandboxNightInstant,
} from '../../chatpro-playbook/src/duty-hours';
import {
  classifyMentionedStart,
  previousAttendanceLabel,
  resolveMentionedStartDate,
  saoPauloAt,
} from '../../chatpro-playbook/src/attendance-clock';
import {
  afterHoursMustDryRun,
  isAfterHoursPhoneAllowed,
  isAfterHoursSandbox,
  parseAfterHoursAllowedPhones,
  validateAfterHoursLiveConfig,
} from '../../chatpro-playbook/src/sandbox';
import {
  SANDBOX_SAFE_FALLBACK,
  OFF_HOURS_WAIT,
  DISTANT_REGION_WAIT,
  attendanceReplyLooksUnsafe,
  attendanceTriageContext,
  buildAttendanceSystemBlocks,
  expandUraMenuUserLine,
  formatCapturedTriageBlock,
  historyForAttendanceModel,
  replyAsAttendanceBot,
  sanitizeAttendanceReply,
  stripAgentSignatures,
  userAsksDistantCoverage,
  type AttendanceTurn,
} from '../../chatpro-playbook/src/attendance-brain';
import {
  extractPlaybookMedia,
  formatPlaybookMessageBody,
} from '../../chatpro-playbook/src/media';
import { playbookIsDue } from '../../chatpro-playbook/src/intercept';
import { pickAfterHoursSessionsToSync } from '../../chatpro-playbook/src/sync';
import { renderInboxSnapshot } from '../../chatpro-playbook/src/inbox-snapshot';

function signed(text: string) {
  return `${ATTENDANCE_BOT_NAME}: ${text}`;
}

const session: AfterHoursSession = {
  id: 'sess-1',
  isGroup: false,
  botActive: false,
  provider: 'cloud',
};

function msg(input: {
  id: string;
  fromMe: boolean;
  at: string;
  body?: string;
  type?: string;
}): AfterHoursMessage {
  return {
    id: input.id,
    fromMe: input.fromMe,
    body: input.body ?? (input.fromMe ? 'ok' : 'preciso de um orçamento'),
    mediaType: input.type ?? (input.fromMe ? 'send_message' : 'receveid_message'),
    sentAt: dateFromSaoPauloWallClock(input.at),
  };
}

describe('isBusinessOpen', () => {
  it('opens monday 7h30 and closes 17h15 sao paulo', () => {
    expect(isBusinessOpen(dateFromSaoPauloWallClock('2026-08-31T07:29:00'))).toBe(false);
    expect(isBusinessOpen(dateFromSaoPauloWallClock('2026-08-31T07:30:00'))).toBe(true);
    expect(isBusinessOpen(dateFromSaoPauloWallClock('2026-08-31T12:00:00'))).toBe(true);
    expect(isBusinessOpen(dateFromSaoPauloWallClock('2026-08-31T17:14:00'))).toBe(true);
    expect(isBusinessOpen(dateFromSaoPauloWallClock('2026-08-31T17:15:00'))).toBe(false);
  });

  it('stays closed on saturday and sunday', () => {
    expect(isBusinessOpen(dateFromSaoPauloWallClock('2026-08-29T10:00:00'))).toBe(false);
    expect(isBusinessOpen(dateFromSaoPauloWallClock('2026-08-30T10:00:00'))).toBe(false);
  });
});

describe('offHoursWindow', () => {
  it('returns null during expediente', () => {
    expect(offHoursWindow(dateFromSaoPauloWallClock('2026-08-31T10:00:00'))).toBeNull();
  });

  it('keeps friday night saturday sunday and monday dawn in one window', () => {
    const fridayNight = offHoursWindow(dateFromSaoPauloWallClock('2026-08-28T18:00:00'));
    const saturday = offHoursWindow(dateFromSaoPauloWallClock('2026-08-29T10:00:00'));
    const sunday = offHoursWindow(dateFromSaoPauloWallClock('2026-08-30T22:00:00'));
    const mondayDawn = offHoursWindow(dateFromSaoPauloWallClock('2026-08-31T07:00:00'));

    expect(fridayNight?.id).toBe('2026-08-28-after');
    expect(saturday?.id).toBe(fridayNight?.id);
    expect(sunday?.id).toBe(fridayNight?.id);
    expect(mondayDawn?.id).toBe(fridayNight?.id);
  });

  it('starts a new window after weekday close', () => {
    expect(offHoursWindow(dateFromSaoPauloWallClock('2026-08-31T20:00:00'))?.id).toBe(
      '2026-08-31-after',
    );
    expect(offHoursWindow(dateFromSaoPauloWallClock('2026-09-01T06:00:00'))?.id).toBe(
      '2026-08-31-after',
    );
  });
});

describe('pickAfterHoursSessionsToSync', () => {
  it('keeps known chats and only the last minutes of inbox', () => {
    const nowMs = Date.parse('2026-09-08T19:40:00.000Z');
    const ids = pickAfterHoursSessionsToSync({
      nowMs,
      recentMs: 120_000,
      limit: 3,
      sessions: [
        { id: 'known', lastUpdateMs: nowMs - 10 * 60_000, known: true },
        { id: 'fresh', lastUpdateMs: nowMs - 30_000, known: false },
        { id: 'old', lastUpdateMs: nowMs - 10 * 60_000, known: false },
        { id: 'fresh-2', lastUpdateMs: nowMs - 10_000, known: false },
      ],
    });
    expect(ids).toEqual(['known', 'fresh-2', 'fresh']);
  });

  it('keeps stale allowlist chats found by phone search', () => {
    const nowMs = Date.parse('2026-09-17T18:00:00.000Z');
    const ids = pickAfterHoursSessionsToSync({
      nowMs,
      recentMs: 120_000,
      limit: 4,
      sessions: [
        { id: 'allow-9655', lastUpdateMs: nowMs - 7 * 24 * 60_000, known: true },
        { id: 'allow-9005', lastUpdateMs: nowMs - 3 * 24 * 60_000, known: true },
        { id: 'unrelated-old', lastUpdateMs: nowMs - 10 * 60_000, known: false },
      ],
    });
    expect(ids).toEqual(['allow-9655', 'allow-9005']);
  });
});

describe('decideAfterHoursNotice', () => {
  it('skips while the commercial floor is open', () => {
    const decision = decideAfterHoursNotice({
      now: dateFromSaoPauloWallClock('2026-08-31T11:00:00'),
      session,
      alreadySent: false,
      messages: [msg({ id: 'c1', fromMe: false, at: '2026-08-31T10:50:00' })],
    });
    expect(decision).toMatchObject({ action: 'skip', reason: 'expediente-aberto' });
  });

  it('sends a daytime inbound when the pilot forces off hours', () => {
    const now = dateFromSaoPauloWallClock('2026-08-31T16:05:00');
    expect(offHoursWindow(now)).toBeNull();
    expect(offHoursWindow(now, { ignoreOpenFloor: true })?.id).toBe('2026-08-31-force');
    const decision = decideAfterHoursNotice({
      now,
      session,
      alreadySent: false,
      forceOffHours: true,
      messages: [msg({ id: 'c1', fromMe: false, at: '2026-08-31T16:04:00' })],
    });
    expect(decision).toMatchObject({
      action: 'send',
      windowId: '2026-08-31-force',
      inboundMessageId: 'c1',
    });
  });

  it('sends once when the client writes after close and nobody answered', () => {
    const decision = decideAfterHoursNotice({
      now: dateFromSaoPauloWallClock('2026-08-31T20:10:00'),
      session,
      alreadySent: false,
      messages: [msg({ id: 'c1', fromMe: false, at: '2026-08-31T20:05:00' })],
    });
    expect(decision).toMatchObject({
      action: 'send',
      windowId: '2026-08-31-after',
      inboundMessageId: 'c1',
      provider: 'cloud',
    });
  });

  it('skips when a consultant already answered at night', () => {
    const decision = decideAfterHoursNotice({
      now: dateFromSaoPauloWallClock('2026-08-31T21:00:00'),
      session,
      alreadySent: false,
      messages: [
        msg({ id: 'c1', fromMe: false, at: '2026-08-31T20:05:00' }),
        msg({ id: 'h1', fromMe: true, at: '2026-08-31T20:20:00', body: 'Pedro aqui, te retorno' }),
      ],
    });
    expect(decision).toMatchObject({ action: 'skip', reason: 'humano-ja-respondeu' });
  });

  it('ignores a queue transfer and greeting on an allowlisted pilot phone', () => {
    const messages = [
      msg({ id: 'c1', fromMe: false, at: '2026-08-31T20:05:00', body: '1' }),
      msg({
        id: 't1',
        fromMe: true,
        at: '2026-08-31T20:06:00',
        type: 'transfer_session',
        body: 'Sessão transferida para `attendant-id`',
      }),
      msg({
        id: 'h1',
        fromMe: true,
        at: '2026-08-31T20:07:00',
        body: '*Bianca *\nBoa tarde',
      }),
      msg({
        id: 'h2',
        fromMe: true,
        at: '2026-08-31T20:07:05',
        body: '*Bianca *\nComo posso te ajudar ?',
      }),
    ];
    expect(decideAfterHoursNotice({
      now: dateFromSaoPauloWallClock('2026-08-31T20:10:00'),
      session,
      alreadySent: false,
      messages,
    })).toMatchObject({ action: 'skip', reason: 'humano-ja-respondeu' });
    expect(decideAfterHoursNotice({
      now: dateFromSaoPauloWallClock('2026-08-31T20:10:00'),
      session,
      alreadySent: false,
      ignoreHumanReplies: true,
      messages,
    })).toMatchObject({
      action: 'send',
      inboundMessageId: 'c1',
    });
  });

  it('still sends when only a transfer happened after the inbound', () => {
    const decision = decideAfterHoursNotice({
      now: dateFromSaoPauloWallClock('2026-08-31T20:10:00'),
      session,
      alreadySent: false,
      messages: [
        msg({ id: 'c1', fromMe: false, at: '2026-08-31T20:05:00' }),
        msg({
          id: 't1',
          fromMe: true,
          at: '2026-08-31T20:06:00',
          type: 'transfer_session',
          body: 'Sessão transferida para `abc`',
        }),
      ],
    });
    expect(decision.action).toBe('send');
  });

  it('still sends after the ChatPro URA menu replies', () => {
    expect(isChatProTriageBotReply({
      id: 'u1',
      fromMe: true,
      body: '*1*. LOCAÇÃO DE PLATAFORMAS ELEVATÓRIAS\n*2*. LOCAÇÃO DE MÁQUINAS',
      mediaType: 'send_message',
      sentAt: dateFromSaoPauloWallClock('2026-08-31T20:06:00'),
    })).toBe(true);
    expect(isAttendanceTeamReply({
      id: 'h1',
      fromMe: true,
      body: '*Bianca *\nQual altura ?',
      mediaType: 'send_message',
      sentAt: dateFromSaoPauloWallClock('2026-08-31T20:06:00'),
    })).toBe(true);

    const decision = decideAfterHoursNotice({
      now: dateFromSaoPauloWallClock('2026-08-31T20:10:00'),
      session: { ...session, botActive: true },
      alreadySent: false,
      messages: [
        msg({ id: 'c1', fromMe: false, at: '2026-08-31T20:05:00' }),
        msg({
          id: 'u1',
          fromMe: true,
          at: '2026-08-31T20:06:00',
          body: '*1*. LOCAÇÃO DE PLATAFORMAS ELEVATÓRIAS\n*2*. LOCAÇÃO DE MÁQUINAS',
        }),
      ],
    });
    expect(decision).toMatchObject({
      action: 'send',
      inboundMessageId: 'c1',
    });
  });

  it('sends a later inbound on the pilot after the first notice', () => {
    const decision = decideAfterHoursNotice({
      now: dateFromSaoPauloWallClock('2026-08-31T20:12:00'),
      session,
      alreadySent: true,
      forceOffHours: true,
      ignoreHumanReplies: true,
      messages: [
        msg({ id: 'c1', fromMe: false, at: '2026-08-31T20:05:00' }),
        {
          ...msg({
            id: 'b1',
            fromMe: true,
            at: '2026-08-31T20:06:00',
            body: 'Recebemos. Qual cidade?',
          }),
          botOrigin: true,
        },
        msg({ id: 'c2', fromMe: false, at: '2026-08-31T20:11:00' }),
      ],
    });
    expect(decision).toMatchObject({
      action: 'send',
      inboundMessageId: 'c2',
    });
  });

  it('skips a daytime inbound even if the worker runs at night', () => {
    const decision = decideAfterHoursNotice({
      now: dateFromSaoPauloWallClock('2026-08-31T20:10:00'),
      session,
      alreadySent: false,
      messages: [msg({ id: 'c1', fromMe: false, at: '2026-08-31T11:00:00' })],
    });
    expect(decision).toMatchObject({ action: 'skip', reason: 'cliente-escreveu-no-expediente' });
  });

  it('skips groups and duplicate window sends', () => {
    expect(
      decideAfterHoursNotice({
        now: dateFromSaoPauloWallClock('2026-08-31T20:10:00'),
        session: { ...session, isGroup: true },
        alreadySent: false,
        messages: [msg({ id: 'c1', fromMe: false, at: '2026-08-31T20:05:00' })],
      }),
    ).toMatchObject({ action: 'skip', reason: 'group' });

    expect(
      decideAfterHoursNotice({
        now: dateFromSaoPauloWallClock('2026-08-31T20:10:00'),
        session,
        alreadySent: true,
        messages: [msg({ id: 'c1', fromMe: false, at: '2026-08-31T20:05:00' })],
      }),
    ).toMatchObject({ action: 'skip', reason: 'ja-avisado-nesta-janela' });
  });

  it('recognizes our notice already sitting in the thread', () => {
    const decision = decideAfterHoursNotice({
      now: dateFromSaoPauloWallClock('2026-08-31T20:10:00'),
      session,
      alreadySent: false,
      messages: [
        msg({ id: 'c1', fromMe: false, at: '2026-08-31T20:05:00' }),
        msg({
          id: 'n1',
          fromMe: true,
          at: '2026-08-31T20:06:00',
          body: `Aviso. ${AFTER_HOURS_NOTICE_MARKER}.`,
        }),
      ],
    });
    expect(decision).toMatchObject({ action: 'skip', reason: 'aviso-ja-esta-no-chat' });
  });

  it('does not treat a bot send as a human reply', () => {
    expect(isAttendanceTeamReply({
      id: 'b1',
      fromMe: true,
      body: 'Recebemos. O comercial retorna no horário.',
      mediaType: 'send_message',
      sentAt: dateFromSaoPauloWallClock('2026-08-31T20:06:00'),
      botOrigin: true,
    })).toBe(false);

    const decision = decideAfterHoursNotice({
      now: dateFromSaoPauloWallClock('2026-08-31T20:10:00'),
      session,
      alreadySent: false,
      messages: [
        msg({ id: 'c1', fromMe: false, at: '2026-08-31T20:05:00' }),
        {
          ...msg({
            id: 'b1',
            fromMe: true,
            at: '2026-08-31T20:06:00',
            body: 'Recebemos. O comercial retorna no horário.',
          }),
          botOrigin: true,
        },
      ],
    });
    expect(decision).toMatchObject({ action: 'skip', reason: 'bot-ja-respondeu' });
  });
});

describe('afterHours sandbox', () => {
  it('stays on unless AFTER_HOURS_SANDBOX is explicitly false', () => {
    expect(isAfterHoursSandbox({})).toBe(true);
    expect(isAfterHoursSandbox({ AFTER_HOURS_SANDBOX: 'true' })).toBe(true);
    expect(isAfterHoursSandbox({ AFTER_HOURS_SANDBOX: 'false' })).toBe(false);
  });

  it('ignores --live while sandbox is on', () => {
    expect(afterHoursMustDryRun({ sandbox: true, liveFlag: true })).toBe(true);
    expect(afterHoursMustDryRun({ sandbox: false, liveFlag: false })).toBe(true);
    expect(afterHoursMustDryRun({ sandbox: false, liveFlag: true })).toBe(false);
  });

  it('normalizes and enforces the pilot phone allowlist', () => {
    const allowedPhones = parseAfterHoursAllowedPhones('(31) 99999-1111, 5531999992222');
    expect(allowedPhones).toEqual(['31999991111', '5531999992222']);
    expect(isAfterHoursPhoneAllowed({
      phoneKey: '5531999992222', allowedPhones, allowAll: false,
    })).toBe(true);
    expect(isAfterHoursPhoneAllowed({
      phoneKey: '5531999991111', allowedPhones, allowAll: false,
    })).toBe(true);
    expect(isAfterHoursPhoneAllowed({
      phoneKey: '5531999993333', allowedPhones, allowAll: false,
    })).toBe(false);
    const chatProPilot = parseAfterHoursAllowedPhones('(31) 98873-1111');
    expect(chatProPilot).toEqual(['31988731111']);
    expect(isAfterHoursPhoneAllowed({
      phoneKey: '5531988731111', allowedPhones: ['5531988731111'], allowAll: false,
    })).toBe(true);
    expect(isAfterHoursPhoneAllowed({
      phoneKey: '5531988731111@s.whatsapp.net', allowedPhones: ['5531988731111'], allowAll: false,
    })).toBe(true);
    expect(isAfterHoursPhoneAllowed({
      phoneKey: '553188739655', allowedPhones: ['5531988739655'], allowAll: false,
    })).toBe(true);
  });

  it('fails closed until every live safeguard is armed', () => {
    expect(validateAfterHoursLiveConfig({
      liveEnabled: false,
      liveArmPresent: false,
      allowAll: false,
      allowedPhones: [],
      alertWebhookUrl: null,
      instanceId: '',
      instanceToken: '',
      anthropicApiKey: null,
    })).toHaveLength(7);
    expect(validateAfterHoursLiveConfig({
      liveEnabled: true,
      liveArmPresent: true,
      allowAll: false,
      allowedPhones: ['5531999992222'],
      alertWebhookUrl: 'https://alerts.example.test/chatpro',
      instanceId: 'instance',
      instanceToken: 'token',
      anthropicApiKey: 'key',
    })).toEqual([]);
  });
});

describe('extractPlaybookMedia', () => {
  it('classifies audio pdf and image from chatpro raw', () => {
    expect(extractPlaybookMedia({
      raw: { url: 'https://example.oraclecloud.com/a.ogg', file_type: 'audio/ogg' },
      mediaType: 'receveid_audio_message',
    }).kind).toBe('audio');
    expect(extractPlaybookMedia({
      raw: { url: 'https://example.oraclecloud.com/a.pdf', file_type: 'application/pdf' },
      mediaType: 'receveid_document_message',
    }).kind).toBe('pdf');
    expect(extractPlaybookMedia({
      raw: { url: 'https://example.oraclecloud.com/a.jpg', file_type: 'image/jpeg' },
      mediaType: 'receveid_image_message',
    }).kind).toBe('image');
  });
});

describe('formatPlaybookMessageBody', () => {
  it('prefers caption when the chat had no text', () => {
    expect(formatPlaybookMessageBody({
      body: null,
      mediaText: '[áudio] precisa de plataforma',
      mediaType: 'receveid_audio_message',
    })).toBe('[áudio] precisa de plataforma');
  });
});

describe('sanitizeAttendanceReply', () => {
  it('blocks a draft that quotes price', () => {
    expect(attendanceReplyLooksUnsafe('A diária é R$ 350')).toBe(true);
    expect(attendanceReplyLooksUnsafe('A tesoura está disponível para amanhã')).toBe(true);
    expect(attendanceReplyLooksUnsafe('O comercial confirma a disponibilidade do treinamento no horário útil.')).toBe(false);
    expect(sanitizeAttendanceReply('A diária é R$ 350')).toBe(signed(SANDBOX_SAFE_FALLBACK));
    expect(attendanceReplyLooksUnsafe('A diária sai por 60 reais')).toBe(true);
    expect(attendanceReplyLooksUnsafe('Temos plataformas tesoura nessa altura')).toBe(true);
    expect(attendanceReplyLooksUnsafe('Temos a GS-4655 para essa altura')).toBe(true);
    expect(sanitizeAttendanceReply('Recebemos, o comercial retorna amanhã.')).toMatch(/7h30/iu);
  });

  it('does not treat a numbered list after the word frete as a freight quote', () => {
    const draft = 'Locamos articulada para Nova Lima. Preciso: 1. data de início. 2. endereço da obra. O comercial retorna com diária e frete.';
    expect(attendanceReplyLooksUnsafe(draft)).toBe(false);
    expect(sanitizeAttendanceReply(draft)).toMatch(/articulada/iu);
  });

  it('blocks every price including a retrieved unofficial estimate', () => {
    const retrieved = [
      '## Estimativa não oficial',
      'Tipo: plataforma tesoura',
      'Período: 30 dias',
      'Faixa captada em proposta equivalente: R$ 4.800',
    ].join('\n');
    const grounded = [
      'Em um pedido parecido o comercial já orçou cerca de R$ 4.800 para 30 dias.',
      'Não é tabela oficial. O comercial confirma no horário útil.',
    ].join(' ');
    expect(attendanceReplyLooksUnsafe(grounded, { retrievedKnowledge: retrieved })).toBe(true);
    expect(sanitizeAttendanceReply(grounded, { retrievedKnowledge: retrieved })).not.toContain('4.800');
    const officialArticle = sanitizeAttendanceReply(
      'Em um pedido parecido o comercial já orçou cerca de R$ 4.800 para 30 dias. Isso não é uma tabela oficial.',
      { retrievedKnowledge: retrieved },
    );
    expect(officialArticle).not.toContain('4.800');
    const invented = sanitizeAttendanceReply(
      'A diária é R$ 60 e não é tabela. O comercial confirma.',
      { retrievedKnowledge: retrieved },
    );
    expect(invented).toMatch(/tesoura/iu);
    expect(invented).toMatch(/7h30/iu);
    expect(invented).not.toMatch(/R\$\s*60/i);
    const freight = sanitizeAttendanceReply(
      'O frete fica R$ 350. O comercial confirma.',
      { retrievedKnowledge: retrieved },
    );
    expect(freight).toMatch(/7h30/iu);
    expect(freight).not.toMatch(/R\$\s*350/i);
  });

  it('drops an off-hours call-now invite and keeps the triage', () => {
    const draft = [
      'Trabalhamos com plataforma tesoura. O comercial retorna no horário útil.',
      '',
      'Se preferir agilizar, pode ligar/chamar agora mesmo:',
      '📞 **(31) 3376-3377**',
      '💬 **(31) 99470-0201**',
    ].join('\n');
    const sanitized = sanitizeAttendanceReply(draft);
    expect(sanitized).toContain('plataforma tesoura');
    expect(sanitized).not.toMatch(/agora mesmo|3376-3377|agilizar/iu);
  });

  it('replaces a reply that is only a call-now invite', () => {
    expect(sanitizeAttendanceReply('Pode ligar agora mesmo: (31) 3376-3377')).toBe(signed(OFF_HOURS_WAIT));
  });

  it('strips emoji and always-on desk copy and keeps the triage', () => {
    const draft = [
      'Boa noite! 👋',
      '',
      'Sim, trabalhamos com andaime tipo tubo e braçadeira.',
      '',
      'Fico aqui pra esclarecer! Qualquer dúvida, é só chamar! 👍',
    ].join('\n');
    const sanitized = sanitizeAttendanceReply(draft);
    expect(sanitized).toMatch(/tubo e bra/iu);
    expect(sanitized).not.toMatch(/👋|👍|é só chamar|fico aqui|qualquer d[uú]vida/iu);
  });

  it('drops a values promise and a fake close', () => {
    const draft = [
      'Anotado, José. O comercial retorna no horário útil.',
      '',
      'Ótimo, temos solução para fachada em BH.',
      '',
      'A equipe monta a proposta com valores de locação, frete e cronograma de entrega.',
    ].join('\n');
    const sanitized = sanitizeAttendanceReply(draft);
    expect(sanitized).toContain('Anotado');
    expect(sanitized).not.toMatch(/temos solu|valores de loca|cronograma/iu);
  });

  it('repairs a tesoura denial when the catalog listed tesoura', () => {
    const retrieved = [
      'plataforma tesoura: PLATAFORMA AÉREA GS 1930',
    ].join('\n');
    const sanitized = sanitizeAttendanceReply(
      'Infelizmente, não temos plataforma tesoura em nosso catálogo.',
      { retrievedKnowledge: retrieved },
    );
    expect(sanitized).toMatch(/trabalhamos com plataforma tesoura/iu);
    expect(sanitized).not.toMatch(/não temos plataforma tesoura/iu);
  });

  it('names tesoura when a follow-up only cites a GS model', () => {
    const retrieved = [
      'Catálogo interno (patrimônio + site).',
      '- plataforma tesoura: PLATAFORMA AÉREA GS 4655 (~15,9 m de trabalho)',
    ].join('\n');
    const sanitized = sanitizeAttendanceReply(
      'Perfeito. Temos a Plataforma elevatória Genie GS-4655 E-Drive, que trabalha com aproximadamente 15,95 m de altura.',
      {
        retrievedKnowledge: retrieved,
        userText: 'de 13 metros de altura, locação por 3 dias',
        userTurns: ['gostaria de fazer a locação de uma plataforma tesoura para o municipio de contagem'],
      },
    );
    expect(sanitized).toMatch(/tesoura/iu);
    expect(sanitized).not.toMatch(/não (?:temos|locamos).{0,40}tesoura/iu);
  });

  it('strips a CNPJ ask and closes with commercial hours', () => {
    const sanitized = sanitizeAttendanceReply(
      'Trabalhamos com tesoura. Preciso do CNPJ da empresa e do endereço da obra.',
    );
    expect(sanitized).not.toMatch(/\bcnpj\b/iu);
    expect(sanitized).toMatch(/7h30/iu);
  });

  it('drops a leftover numbered ask after stripping CNPJ', () => {
    const sanitized = sanitizeAttendanceReply(
      'Trabalhamos com plataforma tesoura. Perfeito. Para estruturar seu orçamento, preciso de: 1.',
    );
    expect(sanitized).toMatch(/plataforma tesoura/iu);
    expect(sanitized).not.toMatch(/preciso de:\s*1/iu);
    expect(sanitized).toMatch(/7h30/iu);
  });

  it('states we do not rent a truck when the catalog missed', () => {
    const sanitized = sanitizeAttendanceReply(
      'Caminhão pipa não está na nossa frota.',
      {
        retrievedKnowledge: 'Nenhum tipo com esse nome no índice.',
        userText: 'voces alugam caminhao pipa?',
      },
    );
    expect(sanitized).toMatch(/não locamos caminhão/iu);
    expect(sanitized).toMatch(/7h30/iu);
  });

  it('does not treat a collection truck as a rental miss', () => {
    const sanitized = sanitizeAttendanceReply(
      'Não locamos caminhão. Qual equipamento você precisa devolver e qual é a cidade?',
      {
        retrievedKnowledge: [
          'Nenhum tipo com esse nome no índice.',
          'Tipos pedidos fora do catálogo: caminhao. Diga que não locamos.',
        ].join('\n'),
        userText: 'quando vocês vêm buscar o equipamento para devolver? chega hoje o caminhão?',
      },
    );
    expect(sanitized).not.toMatch(/não locamos caminhão/iu);
    expect(sanitized).toMatch(/log[ií]stica|devolu/iu);
    expect(sanitized).toMatch(/7h30/iu);
  });

  it('refuses an off-catalog type without offering another line', () => {
    const sanitized = sanitizeAttendanceReply(
      'Não locamos empilhadeira. Nossa frota é focada em plataformas elevatórias (tesoura, articulada). Há algo mais — talvez uma plataforma elevatória para movimentação vertical?',
      {
        retrievedKnowledge: 'Tipos pedidos fora do catálogo: empilhadeira. Diga que não locamos.',
        userText: 'vocês alugam empilhadeira elétrica 2 toneladas?',
      },
    );
    expect(sanitized).toMatch(/não locamos empilhadeira/iu);
    expect(sanitized).not.toMatch(/tesoura|articulada|talvez|movimenta[cç][aã]o vertical|plataformas elevat/iu);
  });

  it('replaces a draft that treats São Paulo as normal coverage', () => {
    expect(userAsksDistantCoverage('voces tambem alugar para são paulo?')).toBe(true);
    expect(userAsksDistantCoverage('voces alugam para betim?')).toBe(false);
    const sanitized = sanitizeAttendanceReply(
      'Sim, trabalhamos com locações para São Paulo também. Você tem interesse em outra plataforma lá, ou é só para confirmar disponibilidade de atendimento?',
      { userText: 'voces tambem alugar para são paulo?' },
    );
    expect(sanitized).toContain(DISTANT_REGION_WAIT);
    expect(sanitized).toMatch(/7h30/iu);
    expect(sanitized).not.toMatch(/sim.{0,40}trabalhamos.{0,40}s[aã]o paulo/iu);
  });

  it('keeps RMBH coverage and a distant reply that already waits for commercial', () => {
    const betim = sanitizeAttendanceReply(
      'Sim, trabalhamos com locações para Betim também. O comercial retorna no horário útil.',
      { userText: 'voces alugam para betim?' },
    );
    expect(betim).toMatch(/betim/iu);
    expect(betim).not.toContain(DISTANT_REGION_WAIT);

    const distant = sanitizeAttendanceReply(
      'A locação padrão é BH e a RMBH. Fora disso o comercial avalia a viabilidade. Qual equipamento e por quantos dias?',
      { userText: 'voces tambem alugar para são paulo?' },
    );
    expect(distant).toMatch(/comercial avalia/iu);
    expect(distant).not.toContain(DISTANT_REGION_WAIT);
  });

  it('does not treat a distant city question as a missing catalog item', () => {
    const sanitized = sanitizeAttendanceReply(
      'A locação padrão é BH e a RMBH. Fora disso o comercial avalia a viabilidade. Qual equipamento e por quantos dias?',
      {
        retrievedKnowledge: 'Nenhum tipo com esse nome no índice.',
        userText: 'voces tambem alugar para são paulo?',
      },
    );
    expect(sanitized).toMatch(/comercial avalia/iu);
    expect(sanitized).not.toMatch(/não locamos esse equipamento/iu);
  });

  it('replaces a distant reply that skips the commercial handoff', () => {
    const sanitized = sanitizeAttendanceReply(
      'A gente trabalha principalmente em Belo Horizonte e região metropolitana. Para São Paulo, em geral é viável em contrato maior.',
      { userText: 'voces tambem alugar para são paulo?' },
    );
    expect(sanitized).toContain(DISTANT_REGION_WAIT);
    expect(sanitized).not.toMatch(/é viável/iu);
  });

  it('keeps the distant-region rule on a follow-up turn', () => {
    const sanitized = sanitizeAttendanceReply(
      'Sim, trabalhamos com tesoura para 10 dias em São Paulo também.',
      {
        userText: 'plataforma tesoura por 10 dias',
        userTurns: ['voces tambem alugar para são paulo?'],
      },
    );
    expect(sanitized).toMatch(/passar (estes|os) dados|n[aã]o confirmo/iu);
    expect(sanitized).not.toMatch(/\bsim\b.{0,80}trabalh/iu);
    expect(sanitized).not.toMatch(/qual equipamento e por quantos dias/iu);
  });

  it('does not treat interior da obra as a distant city', () => {
    expect(userAsksDistantCoverage('preciso de andaime para o interior da obra')).toBe(false);
  });

  it('does not pick tubo e braçadeira when the customer only asked for andaime', () => {
    const reply = sanitizeAttendanceReply(
      'Bom dia! Trabalhamos com andaime tipo tubo e braçadeira. Para quando você precisa da locação e por quantos dias?',
      {
        retrievedKnowledge: '- andaime: Andaime tipo tubo e braçadeira',
        userText: 'Bom dia, gostaria de fazer locação de um andaime para uma obra em Ribeirão das Neves',
        userTurns: ['Bom dia, gostaria de fazer locação de um andaime para uma obra em Ribeirão das Neves'],
        now: saoPauloAt('2026-09-09T10:05:00'),
      },
    );
    expect(reply).toMatch(/andaime/iu);
    expect(reply).not.toMatch(/tubo e bra/iu);
  });

  it('confirms the calendar date and asks if anything else is needed', () => {
    const reply = sanitizeAttendanceReply(
      'Perfeito! Andaime em Ribeirão das Neves, começando terça-feira que vem, por 10 dias — está tudo registrado.',
      {
        userText: 'Preciso para semana que vem na terça feira por 10 dias',
        userTurns: [
          'Bom dia, gostaria de fazer locação de um andaime para uma obra em Ribeirão das Neves',
          'Preciso para semana que vem na terça feira por 10 dias',
        ],
        now: saoPauloAt('2026-09-09T10:37:00'),
      },
    );
    expect(reply).toContain('15 de setembro de 2026');
    expect(reply).toContain('Precisa de mais alguma coisa?');
    expect(reply).not.toMatch(/tubo e bra/iu);
  });

  it('overwrites a wrong calendar day with the confirmed start', () => {
    const reply = sanitizeAttendanceReply(
      'Ótimo, andaime em Ribeirão das Neves, terça-feira, 16 de setembro de 2026, por 10 dias.',
      {
        userText: 'terça que vem, uns 10 dias',
        userTurns: [
          'preciso de um andaime em Ribeirão das Neves',
          'terça que vem, uns 10 dias',
        ],
        captured: {
          userTexts: ['preciso de um andaime em Ribeirão das Neves'],
          equipment: ['andaime'],
          city: 'Ribeirão das Neves',
          start: null,
          days: [],
          notes: [],
        },
        now: saoPauloAt('2026-09-09T10:37:00'),
      },
    );
    expect(reply).toContain('15 de setembro de 2026');
    expect(reply).not.toContain('16 de setembro');
    expect(reply).toContain('está registrada');
    expect(reply).toContain('Precisa de mais alguma coisa?');
  });

  it('registers a complete triage even when the draft re-asks known slots', () => {
    const reply = sanitizeAttendanceReply(
      'Qual equipamento você precisa e qual a cidade da obra?',
      {
        userText: 'fica 10 dias na obra, começando terça da semana que vem',
        userTurns: [
          'quero um andaime em Ribeirão das Neves',
          'fica 10 dias na obra, começando terça da semana que vem',
        ],
        captured: {
          userTexts: ['quero um andaime em Ribeirão das Neves'],
          equipment: ['andaime'],
          city: 'Ribeirão das Neves',
          start: null,
          days: [],
          notes: [],
        },
        now: saoPauloAt('2026-09-09T10:37:00'),
      },
    );
    expect(reply).toMatch(/andaime/iu);
    expect(reply).toContain('Ribeirão das Neves');
    expect(reply).toContain('15 de setembro de 2026');
    expect(reply).toContain('está registrada');
    expect(reply).toContain('Precisa de mais alguma coisa?');
    expect(reply).not.toMatch(/qual equipamento|cidade da obra/iu);
  });

  it('closes a complete triage when the city and start end with an accent', () => {
    const now = saoPauloAt('2026-09-09T11:39:00');
    const history: AttendanceTurn[] = [
      { role: 'user', text: 'quero locar uma tesoura elétrica em Ibirité', origin: 'customer', at: now },
      { role: 'assistant', text: 'Para quando você precisa e por quantos dias?', origin: 'bot', at: now },
    ];
    const context = attendanceTriageContext({
      history,
      userText: 'amanhã, uns 5 dias',
      now,
    });
    expect(context.captured?.city).toMatch(/ibirité/iu);
    const reply = sanitizeAttendanceReply(
      'Perfeito! Tesoura em Ibirité, começando amanhã por 5 dias. Em qual cidade é a obra?',
      {
        userText: 'amanhã, uns 5 dias',
        userTurns: context.userTurns,
        captured: context.captured,
        now,
      },
    );
    expect(reply).toContain('está registrada');
    expect(reply).toContain('Precisa de mais alguma coisa?');
    expect(reply).toContain('10 de setembro');
    expect(reply).not.toMatch(/em qual cidade|cidade da obra/iu);
  });

  it('registers placa vibratória when the start is amanhã', () => {
    const now = saoPauloAt('2026-09-09T11:39:00');
    const history: AttendanceTurn[] = [
      { role: 'user', text: 'placa vibratória a gasolina em Sarzedo, 4 dias', origin: 'customer', at: now },
      { role: 'assistant', text: 'Para quando você precisa?', origin: 'bot', at: now },
    ];
    const context = attendanceTriageContext({
      history,
      userText: 'amanhã',
      now,
    });
    expect(context.captured?.equipment.join(' ')).toMatch(/compactador/iu);
    const reply = sanitizeAttendanceReply(
      'Certo, placa vibratória em Sarzedo por 4 dias a partir de amanhã.',
      {
        userText: 'amanhã',
        userTurns: context.userTurns,
        captured: context.captured,
        now,
      },
    );
    expect(reply).toContain('está registrada');
    expect(reply).toContain('Precisa de mais alguma coisa?');
    expect(reply).toContain('10 de setembro');
  });

  it('does not re-ask the city after Sabará is already in the thread', () => {
    const now = saoPauloAt('2026-09-09T11:39:00');
    const history: AttendanceTurn[] = [
      { role: 'user', text: 'martelete SDS max em Sabará por 2 dias', origin: 'customer', at: now },
      { role: 'assistant', text: 'Para quando você precisa?', origin: 'bot', at: now },
    ];
    const context = attendanceTriageContext({
      history,
      userText: 'sexta-feira',
      now,
    });
    expect(context.captured?.city).toMatch(/sabar/iu);
    const reply = sanitizeAttendanceReply(
      'Anotado: martelete em Sabará, a partir de sexta-feira, por 2 dias. Em qual cidade é a obra?',
      {
        userText: 'sexta-feira',
        userTurns: context.userTurns,
        captured: context.captured,
        now,
      },
    );
    expect(reply).toContain('está registrada');
    expect(reply).toContain('Precisa de mais alguma coisa?');
    expect(reply).not.toMatch(/em qual cidade|cidade da obra/iu);
  });

  it('names tubo e braçadeira on an andaime height follow-up', () => {
    const sanitized = sanitizeAttendanceReply(
      'Anotado: 8 metros, uma semana em BH. O comercial retorna no horário útil.',
      {
        retrievedKnowledge: '- andaime: Andaime tipo tubo e braçadeira',
        userText: 'são 8 metros, uma semana',
        userTurns: ['boa noite, voces trabalham com que tipo de andaimes?'],
      },
    );
    expect(sanitized).toMatch(/tubo e bra/iu);
  });

  it('says we do not rent a compressor when the catalog missed', () => {
    const sanitized = sanitizeAttendanceReply(
      'Vou ver o que a gente tem.',
      {
        retrievedKnowledge: 'Nenhum tipo com esse nome no índice.',
        userText: 'voces alugam compressor para obra?',
      },
    );
    expect(sanitized).toMatch(/não locamos/iu);
  });

  it('names tesoura and hours when an unsafe tesoura draft is replaced', () => {
    const sanitized = sanitizeAttendanceReply('A diária é R$ 350', {
      retrievedKnowledge: '- plataforma tesoura: GS 1930',
      userText: 'quanto custa a diaria da plataforma tesoura?',
    });
    expect(sanitized).toMatch(/tesoura/iu);
    expect(sanitized).toMatch(/7h30/iu);
    expect(sanitized).not.toMatch(/R\$\s*350/i);
  });

  it('drops an é só chamar closer', () => {
    const sanitized = sanitizeAttendanceReply(
      'Trabalhamos com tesoura. Precisando, é só chamar.',
    );
    expect(sanitized).toMatch(/tesoura/iu);
    expect(sanitized).not.toMatch(/é só chamar/iu);
  });

  it('does not prefix andaime onto a Franna ask', () => {
    const sanitized = sanitizeAttendanceReply(
      'Ótimo, vejo que você está procurando uma Franna para Contagem por 45 dias.',
      {
        retrievedKnowledge: [
          '- andaime: Andaime tipo tubo e braçadeira',
          '- plataforma tesoura: GS 1930',
        ].join('\n'),
        userText: 'voces locam guindaste franna em contagem por 45 dias?',
      },
    );
    expect(sanitized).toMatch(/franna/iu);
    expect(sanitized).not.toMatch(/tubo e bra/iu);
  });

  it('drops a PF or PJ ask', () => {
    const sanitized = sanitizeAttendanceReply(
      'Ótimo, martelete SDS Plus em Sabará por 3 dias. Só para confirmar: é pessoa física ou empresa? O comercial retorna no horário útil.',
    );
    expect(sanitized).toMatch(/martelete/iu);
    expect(sanitized).not.toMatch(/pessoa f[ií]sica ou empresa/iu);
  });

  it('does not re-ask equipment and days on a distant job that already named both', () => {
    const sanitized = sanitizeAttendanceReply(
      'Sim, locamos tesoura em Uberlândia também.',
      { userText: 'aluga plataforma tesoura em uberlandia por 20 dias?' },
    );
    expect(sanitized).toMatch(/passar (estes|os) dados/iu);
    expect(sanitized).toMatch(/para quando você precisa/iu);
    expect(sanitized).not.toMatch(/qual equipamento e por quantos dias/iu);
    expect(sanitized).not.toMatch(/por quantos dias/iu);
  });

  it('does not re-ask when a distant job already named type days and start', () => {
    const sanitized = sanitizeAttendanceReply(
      'Sim, locamos tesoura em Uberlândia também.',
      { userText: 'aluga plataforma tesoura em uberlandia por 20 dias a partir de amanhã' },
    );
    expect(sanitized).toMatch(/passar (estes|os) dados/iu);
    expect(sanitized).not.toMatch(/para quando/iu);
    expect(sanitized).not.toMatch(/por quantos dias/iu);
  });

  it('names paleteira when an unsafe draft is replaced', () => {
    const sanitized = sanitizeAttendanceReply('A diária é R$ 80', {
      retrievedKnowledge: '- other: CARRINHO HIDR. PALETEIRA CAP 2.200KG',
      userText: 'aluga paleteira hidraulica em contagem?',
    });
    expect(sanitized).toMatch(/paleteira/iu);
    expect(sanitized).toMatch(/7h30/iu);
    expect(sanitized).not.toMatch(/R\$\s*80/i);
  });

  it('strips a Manitou stock claim and still names the type', () => {
    const sanitized = sanitizeAttendanceReply(
      'Ótimo! Temos manipulador telescópico Manitou MXT 840 e outras soluções para sua obra. O comercial retorna no horário útil.',
      { userText: 'preciso de um manitou em nova lima, 15 dias, me passa valor e frete' },
    );
    expect(sanitized).toMatch(/manipulador|manitou/iu);
    expect(sanitized).not.toMatch(/\btemos\s+manipulador/iu);
    expect(sanitized).not.toMatch(/mxt 840|outras solu/iu);
  });

  it('appends commercial hours when the draft only says o comercial retorna', () => {
    const sanitized = sanitizeAttendanceReply(
      'Sua mensagem já chegou com a gente. O comercial retorna assim que possível. Qual equipamento e por quantos dias você precisa?',
      { userText: 'aceita pix? qual a chave?' },
    );
    expect(sanitized).toMatch(/7h30/iu);
    expect(sanitized).not.toMatch(/chave\s*pix/iu);
  });

  it('drops a Pix-key promise', () => {
    const sanitized = sanitizeAttendanceReply(
      'O comercial retorna no horário útil e confirma com você a chave Pix na hora de fechar.',
      { userText: 'aceita pix? qual a chave?' },
    );
    expect(sanitized).not.toMatch(/chave\s*pix/iu);
    expect(sanitized).toMatch(/7h30/iu);
  });

  it('drops a temos plataformas stock claim and still names tesoura', () => {
    const sanitized = sanitizeAttendanceReply(
      'Ótimo! Temos plataformas tesoura nessa altura. O comercial retorna no horário útil.',
      {
        retrievedKnowledge: '- plataforma tesoura: GS 4655',
        userText: 'tesoura 12m em brumadinho 20 dias, valor da locação e do frete',
      },
    );
    expect(sanitized).toMatch(/tesoura/iu);
    expect(sanitized).not.toMatch(/temos plataformas/iu);
    expect(sanitized).toMatch(/7h30|horário útil/iu);
  });

  it('drops a leftover numbered item in the middle of a sentence', () => {
    const sanitized = sanitizeAttendanceReply(
      'Trabalhamos com martelete SDS Plus em Sabará. Qual o endereço exato da obra? 2. Depois o comercial retorna no horário útil.',
    );
    expect(sanitized).toMatch(/martelete/iu);
    expect(sanitized).not.toMatch(/\b2\.\s/u);
  });

  it('repairs a false betoneira denial when tesoura and betoneira are both in catalog', () => {
    const sanitized = sanitizeAttendanceReply(
      'Trabalhamos com plataforma tesoura. Para a betoneira, não locamos esse equipamento. O comercial retorna no horário útil.',
      {
        retrievedKnowledge: '- plataforma tesoura: GS 1930\n- betoneira: BETONEIRA 400L',
        userText: 'preciso de tesoura e betoneira em betim por uma semana',
      },
    );
    expect(sanitized).toMatch(/betoneira/iu);
    expect(sanitized).not.toMatch(/não locamos esse equipamento/iu);
    expect(sanitized).toMatch(/para quando você precisa/iu);
  });

  it('appends the rental start ask when triage already has type and days', () => {
    const sanitized = sanitizeAttendanceReply(
      'Trabalhamos com plataforma tesoura em Contagem por 3 dias. O comercial retorna no horário útil.',
      { userText: 'plataforma tesoura em Contagem por 3 dias, me passa um preço estimado' },
    );
    expect(sanitized).toMatch(/para quando você precisa/iu);
    expect(sanitized).toMatch(/7h30|horário útil/iu);
  });

  it('routes a mechanical call without commercial rental questions or unsolicited contacts', () => {
    const sanitized = sanitizeAttendanceReply(
      'Ligue para (31) 3376-3377. Vou passar ao comercial. Para quando você precisa?',
      {
        userText: 'A plataforma travou no alto com operador na cesta. Posso fazer jumper no sensor?',
      },
    );
    expect(sanitized).toMatch(/equipe de mecânica/iu);
    expect(sanitized).not.toMatch(/3376-3377|para quando|\bo comercial\b/iu);
    expect(sanitized).toMatch(/7h30/iu);
  });

  it('renames maintenance team to mecânica on a breakdown', () => {
    const sanitized = sanitizeAttendanceReply(
      'A equipe de manutenção da Acesso retorna no horário comercial, segunda a sexta, 7h30–17h15, para avaliar o que aconteceu.',
      {
        userText: 'a articulada da obra parou de subir com gente na cesta',
      },
    );
    expect(sanitized).toMatch(/equipe de mecânica/iu);
    expect(sanitized).not.toMatch(/manuten[cç][aã]o/iu);
  });

  it('strips jumper talk and invented mechanical causes', () => {
    const sanitized = sanitizeAttendanceReply(
      'Não recomendo fazer jumper. Pode ser sensor, hidráulica ou outra falha que jumper não resolve. Interrompa o uso e acione o responsável de segurança da obra.',
      {
        userText: 'a plataforma tesoura travou no alto. posso fazer jumper no sensor de inclinação?',
      },
    );
    expect(sanitized).toMatch(/equipe de mecânica|improvise|respons[aá]vel de seguran/iu);
    expect(sanitized).not.toMatch(/jumper|bypass|hidr[aá]ulica ou outra/iu);
    expect(sanitized).not.toMatch(/para quando você precisa/iu);
  });

  it('answers a catalog height without opening a rental', () => {
    const sanitized = sanitizeAttendanceReply(
      'Trabalhamos com plataforma tesoura. Você está orçando uma locação? Qual é a cidade da obra e para quando você precisa?',
      {
        retrievedKnowledge: '- tesoura: PLATAFORMA AÉREA GS 1930 (~7,9 m de trabalho)',
        userText: 'a tesoura GS 1930 sobe quantos metros?',
      },
    );
    expect(sanitized).toMatch(/7[,.]9\s*m/iu);
    expect(sanitized).not.toMatch(/para quando|cidade da obra|para uma loca/iu);
  });

  it('fills GS 1930 height from the fleet catalog when retrieval omitted it', () => {
    const sanitized = sanitizeAttendanceReply('Trabalhamos com plataforma tesoura.', {
      userText: 'a tesoura GS 1930 sobe quantos metros?',
    });
    expect(sanitized).toMatch(/7[,.]9\s*m/iu);
    expect(sanitized).not.toMatch(/para quando você precisa/iu);
  });

  it('explains freight process for an RMBH delivery ask', () => {
    const sanitized = sanitizeAttendanceReply(
      'Trabalhamos com plataforma tesoura e Betim fica na região onde atendemos.',
      { userText: 'vocês entregam plataforma tesoura em Betim?' },
    );
    expect(sanitized).toMatch(/frete/iu);
    expect(sanitized).toMatch(/para quando você precisa/iu);
    expect(sanitized).toMatch(/tesoura/iu);
  });

  it('does not start a rental when asked if a tesoura drives elevated', () => {
    const sanitized = sanitizeAttendanceReply(
      'A tesoura não deve se deslocar com a cesta elevada. Se precisa andar em altura, podemos trabalhar com plataforma articulada. Em qual cidade é a obra? Para quando você precisa?',
      { userText: 'a tesoura pode andar com a cesta elevada?' },
    );
    expect(sanitized).toMatch(/cesta elevada/iu);
    expect(sanitized).not.toMatch(/para quando você precisa/iu);
    expect(sanitized).not.toMatch(/articulada/iu);
  });

  it('strips an invented PEMT expansion', () => {
    const sanitized = sanitizeAttendanceReply(
      'Oferecemos treinamento PEMT (Plataforma Elevatória Motorizada Tesoura). O curso inclui certificado e carteirinha.',
      { userText: 'como funciona o treinamento de plataforma de vocês?' },
    );
    expect(sanitized).toMatch(/\bPEMT\b/u);
    expect(sanitized).toContain('certificado');
    expect(sanitized).not.toMatch(/Motorizada Tesoura|Trabalho em Altura/iu);
  });

  it('routes a logistics request without asking the rental duration', () => {
    const sanitized = sanitizeAttendanceReply(
      'Vou passar seus dados ao comercial para resolver isso agora. A equipe vai priorizar. Por quantos dias você precisa da locação?',
      { userText: 'Entregaram o equipamento errado e preciso de troca imediata em Sabará.' },
    );
    expect(sanitized).toMatch(/equipe de logística/iu);
    expect(sanitized).not.toMatch(/\bo comercial\b|por quantos dias/iu);
    expect(sanitized).toMatch(/7h30/iu);
    expect(sanitized).toMatch(/qual equipamento foi entregue/iu);
    expect(sanitized).toMatch(/endere[cç]o da obra/iu);
    expect(sanitized).not.toMatch(/agora|priorizar/iu);
  });

  it('does not open a rental start when the customer wants to return equipment', () => {
    const sanitized = sanitizeAttendanceReply(
      'Vou anotar sua devolução. Para quando você precisa? Por quantos dias você precisa da tesoura?',
      { userText: 'preciso devolver a tesoura que tá na obra' },
    );
    expect(sanitized).toMatch(/log[ií]stica|devolu/iu);
    expect(sanitized).not.toMatch(/para quando (?:voc[eê] )?precisa|por quantos dias/iu);
    expect(sanitized).toMatch(/7h30/iu);
  });

  it('repairs a supported gerador denial in a mixed equipment request', () => {
    const sanitized = sanitizeAttendanceReply(
      'Não locamos gerador nem empilhadeira. Vou confirmar com o comercial se conseguimos algo compatível. Qual seria a alternativa para a empilhadeira ou você precisa de outra solução nossa? O comercial retorna no horário útil.',
      {
        retrievedKnowledge: [
          '- equipamento: GERADOR A GASOLINA 7000 110/220V',
          'Tipos pedidos fora do catálogo: empilhadeira. Diga que não locamos.',
        ].join('\n'),
        userText: 'Preciso de gerador 7 kVA e empilhadeira elétrica em Nova Lima.',
      },
    );
    expect(sanitized).toMatch(/trabalhamos com gerador/iu);
    expect(sanitized).toMatch(/não locamos empilhadeira/iu);
    expect(sanitized).not.toMatch(/não locamos gerador/iu);
    expect(sanitized).not.toMatch(/algo compatível|alternativa para|outra solução/iu);
  });

  it('forces a denial for an explicitly marked catalog miss', () => {
    const sanitized = sanitizeAttendanceReply(
      'Para a empilhadeira, vou confirmar com o comercial se locamos esse tipo.',
      {
        retrievedKnowledge: 'Tipos pedidos fora do catálogo: empilhadeira. Diga que não locamos.',
        userText: 'Preciso de empilhadeira elétrica.',
      },
    );
    expect(sanitized).toMatch(/não locamos empilhadeira/iu);
    expect(sanitized).not.toMatch(/vou confirmar/iu);
  });

  it('removes commercial questions whose answers are already in the lead message', () => {
    const sanitized = sanitizeAttendanceReply(
      'Você precisa mesmo a partir de segunda? E a locação é por 30 dias, certo? Qual é o endereço da obra? O comercial retorna no horário útil.',
      {
        userText: 'Gerador em Nova Lima por 30 dias a partir de segunda.',
      },
    );
    expect(sanitized).not.toMatch(/precisa mesmo|30 dias, certo|endereço da obra/iu);
    expect(sanitized).toContain('Precisa de mais alguma coisa?');
    expect(sanitized).toMatch(/comercial retorna/iu);
  });

  it('drops an unprompted catalog denial from a policy question', () => {
    const sanitized = sanitizeAttendanceReply(
      'Não locamos esse equipamento. Caução e seguro são tratados pelo comercial.',
      {
        retrievedKnowledge: 'Nenhum tipo com esse nome no índice.',
        userText: 'Qual é a caução, a multa por atraso e a franquia do seguro?',
      },
    );
    expect(sanitized).not.toMatch(/não locamos esse equipamento/iu);
    expect(sanitized).toMatch(/caução/iu);
    expect(sanitized).not.toContain('?');
  });

  it('drops stock and unit promises from the response', () => {
    const sanitized = sanitizeAttendanceReply(
      'O comercial vai validar estoque e confirmar se três unidades saem hoje. Sua mensagem foi recebida.',
      { userText: 'Confirma três unidades da tesoura para amanhã?' },
    );
    expect(sanitized).not.toMatch(/estoque|unidades|saem hoje/iu);
    expect(sanitized).toMatch(/7h30/iu);
  });

  it('asks period and start on a distant plataforma ask', () => {
    const sanitized = sanitizeAttendanceReply(
      'Sim, locamos plataforma em Curitiba também.',
      { userText: 'consigo locar plataforma em curitiba?' },
    );
    expect(sanitized).toMatch(/por quantos dias e para quando você precisa/iu);
    expect(sanitized).not.toMatch(/qual equipamento e por quantos dias/iu);
  });

  it('strips the attendant signature the model copied from the thread', () => {
    const sanitized = sanitizeAttendanceReply(
      '*Bianca * Anotado: plataforma para Contagem. *Bianca *',
      { userText: 'plataforma tesoura em contagem por 5 dias a partir de quarta' },
    );
    expect(sanitized).not.toMatch(/Bianca/u);
    expect(sanitized).toMatch(/Anotado/u);
  });

  it('keeps asking city and start after a duration-only reply', () => {
    const sanitized = sanitizeAttendanceReply('Perfeito!', {
      userText: '5 dias',
      userTurns: ['1. LOCAÇÃO PLATAFORMA ELEVATÓRIA AÉREA'],
    });
    expect(sanitized).toMatch(/em qual cidade/iu);
    expect(sanitized).toMatch(/para quando você precisa/iu);
    expect(sanitized).toMatch(/7h30/u);
  });
});

describe('stripAgentSignatures', () => {
  it('removes the signature prefix ChatPro stamps on a send', () => {
    expect(stripAgentSignatures('*Bianca *\nBoa tarde!')).toBe('Boa tarde!');
    expect(stripAgentSignatures('*Pedro *\n\nAnotado.')).toBe('Anotado.');
  });

  it('removes duplicated inline signatures', () => {
    expect(stripAgentSignatures('*Bianca * *Bianca * Anotado.')).toBe('Anotado.');
  });

  it('keeps bold catalog text that is not a signature', () => {
    expect(stripAgentSignatures('Trabalhamos com *plataforma tesoura*.'))
      .toBe('Trabalhamos com *plataforma tesoura*.');
  });
});

describe('expandUraMenuUserLine', () => {
  const menu = [
    'Escolha uma opção:',
    '1. LOCAÇÃO PLATAFORMA ELEVATÓRIA AÉREA',
    '2. LOCAÇÃO ANDAIME',
    '3. MECÂNICA',
  ].join('\n');

  it('expands a bare menu digit into the catalog type', () => {
    expect(expandUraMenuUserLine('1', menu)).toBe('1. LOCAÇÃO PLATAFORMA ELEVATÓRIA AÉREA');
    expect(expandUraMenuUserLine('2', menu)).toBe('2. LOCAÇÃO ANDAIME');
  });

  it('keeps the line when the previous turn is not a menu', () => {
    expect(expandUraMenuUserLine('1', 'Boa tarde! Tudo bem?')).toBe('1');
    expect(expandUraMenuUserLine('5 dias', menu)).toBe('5 dias');
    expect(expandUraMenuUserLine('1')).toBe('1');
  });
});

describe('buildAttendanceSystemBlocks', () => {
  it('caches rules and playbook and keeps retrieval off the breakpoint', () => {
    const blocks = buildAttendanceSystemBlocks({
      vaultKnowledge: 'Como atendemos: triagem e o comercial orça.',
      retrievedKnowledge: 'plataforma tesoura: GS 1930',
      contactContext: 'Cliente: manda o orçamento',
      capturedTriage: 'Triagem que VOCÊ mesmo anotou nesta conversa.\n- Cidade: Contagem',
    });

    expect(blocks).toHaveLength(5);
    expect(blocks[0]).toMatchObject({
      type: 'text',
      cache_control: { type: 'ephemeral' },
    });
    expect(blocks[0]?.text).toContain('Como atendemos: triagem e o comercial orça.');
    expect(blocks[0]?.text).toContain('Área padrão é BH e a RMBH');
    expect(blocks[0]?.text).not.toContain('GS 1930');
    expect(blocks[0]?.text).not.toContain('manda o orçamento');
    expect(blocks[1]?.cache_control).toBeUndefined();
    expect(blocks[1]?.text).toContain('GS 1930');
    expect(blocks[2]?.text).toContain('manda o orçamento');
    expect(blocks[3]?.text).toContain('Relógio da mesa');
    expect(blocks[4]?.text).toContain('Cidade: Contagem');
    expect(blocks[0]?.text).not.toContain('Cidade: Contagem');
    expect(blocks[0]?.text).toContain('em SANDBOX');
    expect(blocks[0]?.text).toContain(ATTENDANCE_BOT_NAME);
  });

  it('gives training facts to the model instead of a canned reply', () => {
    const blocks = buildAttendanceSystemBlocks({ vaultKnowledge: '' });
    expect(blocks[0]?.text).toMatch(/Treinamento PEMT/u);
    expect(blocks[0]?.text).toMatch(/não um texto para copiar/u);
    expect(blocks[0]?.text).toMatch(/carteirinha/iu);
    expect(blocks[0]?.text).toContain('Leia a última mensagem no contexto da conversa');
    expect(blocks[0]?.text).toContain('para finalizar o atendimento');
  });

  it('uses the live role when sending on WhatsApp', () => {
    const blocks = buildAttendanceSystemBlocks({
      vaultKnowledge: 'Como atendemos: triagem e o comercial orça.',
      live: true,
    });
    expect(blocks[0]?.text).toContain('WhatsApp real');
    expect(blocks[0]?.text).toContain('Nunca escreva assinatura de atendente');
    expect(blocks[0]?.text).not.toContain('em SANDBOX');
    expect(blocks[0]?.text).not.toContain('Nenhum WhatsApp é enviado');
  });
});

describe('attendanceTriageContext', () => {
  const botCaptured: AttendanceTurn[] = [
    { role: 'assistant', text: '1. LOCAÇÃO PLATAFORMA ELEVATÓRIA AÉREA', origin: 'ura' },
    { role: 'user', text: '1', origin: 'customer' },
    { role: 'assistant', text: 'Boa tarde! Como posso te ajudar?', origin: 'human' },
    { role: 'assistant', text: 'Por quantos dias você precisa da plataforma?', origin: 'bot' },
    { role: 'user', text: 'plataforma tesoura, 5 dias', origin: 'customer' },
    { role: 'assistant', text: 'Em qual cidade é a obra e para quando?', origin: 'bot' },
    { role: 'user', text: 'Contagem, começa quarta-feira', origin: 'customer' },
  ];

  it('keeps only the turns the bot itself collected', () => {
    const context = attendanceTriageContext({ history: botCaptured, userText: 'a plataforma é de 20 metros' });
    expect(context.newQuote).toBe(false);
    expect(context.captured?.equipment).toEqual(['plataforma tesoura']);
    expect(context.captured?.city).toBe('Contagem');
    expect(context.captured?.start).toBe('quarta-feira');
    expect(context.captured?.days).toEqual([5]);
    expect(context.userTurns).not.toContain('1');
  });

  it('treats a human-only thread as a new quote', () => {
    const context = attendanceTriageContext({
      history: [
        { role: 'assistant', text: '1. LOCAÇÃO PLATAFORMA ELEVATÓRIA AÉREA', origin: 'ura' },
        { role: 'user', text: '1', origin: 'customer' },
        { role: 'assistant', text: 'Boa tarde! Como posso te ajudar?', origin: 'human' },
      ],
      userText: 'quero alugar uma plataforma',
    });
    expect(context.newQuote).toBe(true);
    expect(context.captured).toBeNull();
    expect(context.priorCapture).toBeNull();
    expect(context.userTurns).toEqual(['quero alugar uma plataforma']);
  });

  it('opens a new quote when the customer asks for another equipment job', () => {
    const context = attendanceTriageContext({
      history: botCaptured,
      userText: 'gostaria de fazer uma locação de um gerador',
    });
    expect(context.newQuote).toBe(true);
    expect(context.captured).toBeNull();
    expect(context.priorCapture?.equipment).toEqual(['plataforma tesoura']);
    expect(context.userTurns).toEqual(['gostaria de fazer uma locação de um gerador']);
  });

  it('stays in the same triage when the customer adds an extra equipment', () => {
    const context = attendanceTriageContext({
      history: botCaptured,
      userText: 'preciso também de um martelete',
    });
    expect(context.newQuote).toBe(false);
    expect(context.captured?.equipment).toEqual(['plataforma tesoura']);
  });

  it('tells the model that a human thread is not its own triage', () => {
    const block = formatCapturedTriageBlock(attendanceTriageContext({
      history: [{ role: 'assistant', text: 'Boa tarde! Como posso te ajudar?', origin: 'human' }],
      userText: 'quero alugar uma plataforma',
    }));
    expect(block).toContain('Nada anotado por você ainda');
    expect(block).toContain('atendimento novo');
  });

  it('lists the captured slots for a continuation', () => {
    const block = formatCapturedTriageBlock(attendanceTriageContext({
      history: botCaptured,
      userText: 'a tesoura é de 8 metros',
    }));
    expect(block).toContain('Cidade: Contagem');
    expect(block).toContain('Duração: 5 dias');
    expect(block).toContain('Este atendimento de hoje continua');
  });

  it('starts a new attendance when the customer only greets', () => {
    const context = attendanceTriageContext({
      history: botCaptured,
      userText: 'Bom dia\nTudo bem ?',
    });
    expect(context.newQuote).toBe(true);
    expect(context.captured).toBeNull();
    expect(context.userTurns).toEqual(['Bom dia\nTudo bem ?']);
  });

  it('keeps the customer turn that came before the first bot reply', () => {
    const now = saoPauloAt('2026-09-09T11:39:00');
    const context = attendanceTriageContext({
      history: [
        {
          role: 'user',
          text: 'preciso de um andaime em Ribeirão das Neves',
          origin: 'customer',
          at: saoPauloAt('2026-09-09T10:05:00'),
        },
        {
          role: 'assistant',
          text: 'Para quando e por quantos dias?',
          origin: 'bot',
          at: saoPauloAt('2026-09-09T10:05:00'),
        },
      ],
      userText: 'terça que vem, uns 10 dias',
      now,
    });
    expect(context.newQuote).toBe(false);
    expect(context.captured?.equipment).toEqual(['andaime']);
    expect(context.captured?.city).toBe('Ribeirão das Neves');
    expect(context.userTurns[0]).toBe('preciso de um andaime em Ribeirão das Neves');
  });

  it('opens a new quote for a martelo after an andaime order', () => {
    const now = saoPauloAt('2026-09-09T11:39:00');
    const context = attendanceTriageContext({
      history: [
        { role: 'assistant', text: 'Para quando e por quantos dias?', origin: 'bot', at: saoPauloAt('2026-09-09T10:05:00') },
        { role: 'user', text: 'andaime em Ribeirão das Neves', origin: 'customer', at: saoPauloAt('2026-09-09T10:05:00') },
        { role: 'user', text: 'terça por 10 dias', origin: 'customer', at: saoPauloAt('2026-09-09T10:37:00') },
      ],
      userText: 'Quero alugar um martelo 10kg',
      now,
    });
    expect(context.newQuote).toBe(true);
    expect(context.captured).toBeNull();
    expect(context.userTurns).toEqual(['Quero alugar um martelo 10kg']);
  });

  it('drops a sealed attendance unless the customer names that same subject', () => {
    const now = saoPauloAt('2026-09-09T11:39:00');
    const sealed: AttendanceTurn[] = [
      {
        role: 'assistant',
        origin: 'bot',
        at: saoPauloAt('2026-09-09T10:05:00'),
        text: 'Para quando e por quantos dias?',
      },
      {
        role: 'user',
        origin: 'customer',
        at: saoPauloAt('2026-09-09T10:05:00'),
        text: 'andaime em Ribeirão das Neves',
      },
      {
        role: 'user',
        origin: 'customer',
        at: saoPauloAt('2026-09-09T10:37:00'),
        text: 'semana que vem na terça por 10 dias',
      },
      {
        role: 'assistant',
        origin: 'bot',
        at: saoPauloAt('2026-09-09T10:37:00'),
        text: 'Sua mensagem está registrada: andaime, 10 dias, a partir de terça-feira, 15 de setembro de 2026, em Ribeirão das Neves.\n\nPrecisa de mais alguma coisa?\n\nO comercial retorna no horário útil, segunda a sexta, 7h30–17h15.',
      },
    ];

    const greeting = attendanceTriageContext({
      history: sealed,
      userText: 'Bom dia\nTudo bem ?',
      now,
    });
    expect(greeting.newQuote).toBe(true);
    expect(greeting.closed).toBe(true);
    expect(greeting.captured).toBeNull();
    expect(greeting.userTurns).toEqual(['Bom dia\nTudo bem ?']);
    expect(historyForAttendanceModel({ history: sealed, context: greeting })).toEqual([]);
    const greetingBlock = formatCapturedTriageBlock(greeting);
    expect(greetingBlock).toContain('já foi encerrado');
    expect(greetingBlock).not.toMatch(/andaime|Ribeirão/iu);

    const nextAsk = attendanceTriageContext({
      history: sealed,
      userText: 'Quero alugar um martelo 10kg',
      now,
    });
    expect(nextAsk.newQuote).toBe(true);
    expect(nextAsk.captured).toBeNull();
    expect(historyForAttendanceModel({ history: sealed, context: nextAsk })).toEqual([]);
    expect(formatCapturedTriageBlock(nextAsk)).not.toMatch(/andaime|Ribeirão/iu);

    const resume = attendanceTriageContext({
      history: sealed,
      userText: 'ainda vale aquele orçamento',
      now,
    });
    expect(resume.newQuote).toBe(false);
    expect(resume.captured?.equipment).toEqual(['andaime']);
    expect(resume.captured?.city).toBe('Ribeirão das Neves');

    const sameSubject = attendanceTriageContext({
      history: sealed,
      userText: 'o andaime pode ser tipo painel?',
      now,
    });
    expect(sameSubject.newQuote).toBe(false);
    expect(sameSubject.captured?.equipment).toEqual(['andaime']);

    const resumeVaried = attendanceTriageContext({
      history: sealed,
      userText: 'aquele orçamento ainda vale?',
      now,
    });
    expect(resumeVaried.newQuote).toBe(false);
    expect(resumeVaried.captured?.equipment).toEqual(['andaime']);
    expect(resumeVaried.captured?.city).toBe('Ribeirão das Neves');
  });

  it('starts a new attendance when the previous bot capture is from another day', () => {
    const wednesday = saoPauloAt('2026-09-09T07:55:00');
    const context = attendanceTriageContext({
      history: [
        {
          role: 'assistant',
          text: 'Por quantos dias você precisa da plataforma?',
          origin: 'bot',
          at: saoPauloAt('2026-09-08T16:38:00'),
        },
        { role: 'user', text: 'plataforma tesoura, 5 dias', origin: 'customer', at: saoPauloAt('2026-09-08T16:39:00') },
        { role: 'user', text: 'Contagem, começa quarta-feira', origin: 'customer', at: saoPauloAt('2026-09-08T16:45:00') },
      ],
      userText: 'Boa tarde',
      now: wednesday,
    });
    expect(context.newQuote).toBe(true);
    expect(context.captured).toBeNull();
    expect(context.priorCapture?.city).toBe('Contagem');
    expect(context.previousAttendance).toContain('8 de setembro de 2026');
    const block = formatCapturedTriageBlock(context);
    expect(block).toContain('NÃO assuma que aquele pedido ainda vale');
    expect(block).toContain('atendimento novo');
    expect(block).not.toContain('Este atendimento de hoje continua');
  });

  it('resumes the prior capture only when the customer asks to continue it', () => {
    const wednesday = saoPauloAt('2026-09-09T07:55:00');
    const context = attendanceTriageContext({
      history: [
        {
          role: 'assistant',
          text: 'Por quantos dias você precisa da plataforma?',
          origin: 'bot',
          at: saoPauloAt('2026-09-08T16:38:00'),
        },
        { role: 'user', text: 'plataforma tesoura, 5 dias', origin: 'customer', at: saoPauloAt('2026-09-08T16:39:00') },
        { role: 'user', text: 'Contagem, começa quarta-feira', origin: 'customer', at: saoPauloAt('2026-09-08T16:45:00') },
      ],
      userText: 'ainda vale aquele orçamento de ontem',
      now: wednesday,
    });
    expect(context.newQuote).toBe(false);
    expect(context.captured?.city).toBe('Contagem');
  });
});

describe('classifyMentionedStart', () => {
  const wednesday = saoPauloAt('2026-09-09T07:44:00');

  it('treats ontem as a date that already passed', () => {
    expect(classifyMentionedStart('quero para ontem', wednesday)).toBe('past');
  });

  it('treats quarta-feira as today on a wednesday', () => {
    expect(classifyMentionedStart('na quarta-feira dessa semana', wednesday)).toBe('today');
  });

  it('treats monday as the next monday when today is wednesday', () => {
    expect(classifyMentionedStart('segunda-feira', wednesday)).toBe('future');
  });

  it('treats monday this week as already passed on a wednesday', () => {
    expect(classifyMentionedStart('segunda dessa semana', wednesday)).toBe('past');
  });

  it('keeps tomorrow in the future', () => {
    expect(classifyMentionedStart('amanhã', wednesday)).toBe('future');
  });

  it('resolves next-week Tuesday on a Wednesday to 15 September 2026', () => {
    const date = resolveMentionedStartDate('Preciso para semana que vem na terça feira por 10 dias', wednesday);
    expect(date?.toISOString().slice(0, 10)).toBe('2026-09-15');
  });
});

describe('previousAttendanceLabel', () => {
  it('returns null when the bot first spoke today', () => {
    const now = saoPauloAt('2026-09-09T08:00:00');
    expect(previousAttendanceLabel([
      { role: 'assistant', origin: 'bot', at: saoPauloAt('2026-09-09T07:50:00') },
    ], now)).toBeNull();
  });
});

describe('sanitizeAttendanceReply with captured triage', () => {
  const captured = {
    userTexts: ['plataforma tesoura, 5 dias', 'Contagem, começa quarta-feira'],
    equipment: ['plataforma tesoura'],
    city: 'Contagem',
    start: 'quarta-feira',
    days: [5],
    notes: [],
  };

  it('registers the update instead of a bare catalog line', () => {
    const reply = sanitizeAttendanceReply('Trabalhamos com plataformas.', {
      userText: 'a plataforma precisa ser de 20 metros',
      userTurns: [...captured.userTexts, 'a plataforma precisa ser de 20 metros'],
      captured,
    });
    expect(reply).toContain('está registrada');
    expect(reply).toContain('20 metros');
    expect(reply).toContain('Contagem');
    expect(reply).toContain('quarta-feira');
    expect(reply).toContain('7h30');
  });

  it('does not recap a captured request when the customer only greets', () => {
    const reply = sanitizeAttendanceReply('Boa tarde! Tudo bem? Como posso ajudá-lo? Seu pedido já está registrado: plataforma tesoura, 5 dias.', {
      userText: 'boa tarde',
      userTurns: [...captured.userTexts, 'boa tarde'],
      captured,
      now: saoPauloAt('2026-09-09T16:00:00'),
    });
    expect(reply).toContain('Boa tarde!');
    expect(reply).toContain('Como posso ajudar?');
    expect(reply).not.toMatch(/está registrad|plataforma tesoura|5 dias|equipamento/iu);
    expect(reply).toMatch(/\n\nO comercial retorna/u);
  });

  it('treats bom dia plus tudo bem as a greeting without the previous equipment', () => {
    const reply = sanitizeAttendanceReply('Trabalhamos com andaime. Bom dia! Tudo bem sim.', {
      userText: 'Bom dia\nTudo bem ?',
      userTurns: [
        'gostaria de fazer locação de um andaime para uma obra em Ribeirão das Neves',
        'Preciso para semana que vem na terça feira por 10 dias',
        'Bom dia\nTudo bem ?',
      ],
      captured: {
        userTexts: [
          'gostaria de fazer locação de um andaime para uma obra em Ribeirão das Neves',
          'Preciso para semana que vem na terça feira por 10 dias',
        ],
        equipment: ['andaime'],
        city: 'Ribeirão das Neves',
        start: 'terça',
        days: [10],
        notes: [],
      },
      now: saoPauloAt('2026-09-09T11:35:00'),
    });
    expect(reply).toContain('Bom dia!');
    expect(reply).toContain('Como posso ajudar?');
    expect(reply).not.toMatch(/andaime|registrad/iu);
  });

  it('does not keep andaime when the next ask is a martelo', () => {
    const reply = sanitizeAttendanceReply(
      'Trabalhamos com andaime. Trabalhamos com martelo demolidor 10 kg. Qual é a cidade da obra e para quando você precisa?',
      {
        userText: 'Quero alugar um martelo 10kg',
        userTurns: ['Quero alugar um martelo 10kg'],
        captured: null,
        now: saoPauloAt('2026-09-09T11:39:00'),
      },
    );
    expect(reply).toMatch(/martelo/iu);
    expect(reply).not.toMatch(/andaime/iu);
    expect(reply).toMatch(/cidade|para quando/iu);
  });

  it('starts triage after a human-only thread instead of claiming a note', () => {
    const reply = sanitizeAttendanceReply('Trabalhamos com plataformas.', {
      userText: 'quero alugar uma plataforma',
      userTurns: ['quero alugar uma plataforma'],
      captured: null,
    });
    expect(reply).toContain('Em qual cidade é a obra?');
    expect(reply).toContain('Para quando você precisa?');
    expect(reply).not.toMatch(/está registrada|já está anotado/iu);
  });

  it('asks the equipment when nothing was captured by the bot', () => {
    const reply = sanitizeAttendanceReply('Boa tarde!', {
      userText: 'boa tarde, gostaria de alugar',
      userTurns: ['boa tarde, gostaria de alugar'],
      captured: null,
    });
    expect(reply).toContain('Qual equipamento você precisa?');
    expect(reply).not.toMatch(/já está anotado|registrada/iu);
  });

  it('does not recap a previous-day order on a greeting', () => {
    const wednesday = saoPauloAt('2026-09-09T07:55:00');
    const reply = sanitizeAttendanceReply(
      'Boa tarde! Seu pedido já está registrado: plataforma elevatória de aproximadamente 20 metros, martelete, 5 dias, começando quarta-feira em Contagem.',
      {
        userText: 'Boa tarde',
        userTurns: ['Boa tarde'],
        captured: null,
        now: wednesday,
      },
    );
    expect(reply).toContain('Bom dia!');
    expect(reply).toContain('Como posso ajudar?');
    expect(reply).not.toMatch(/está registrad|20 metros|Contagem|equipamento/iu);
    expect(reply).toMatch(/\n\nO comercial retorna/u);
  });

  it('keeps the commercial hours on their own paragraph', () => {
    const reply = sanitizeAttendanceReply(
      'Trabalhamos com plataforma tesoura. O comercial retorna no horário útil, segunda a sexta, 7h30–17h15, para confirmar endereço e orçar com frete.',
      {
        userText: 'preciso de uma tesoura em Contagem por 5 dias a partir de amanhã',
        userTurns: ['preciso de uma tesoura em Contagem por 5 dias a partir de amanhã'],
      },
    );
    expect(reply).toMatch(/\n\nO comercial retorna no horário útil, segunda a sexta, 7h30–17h15\./u);
    expect(reply.indexOf('plataforma tesoura')).toBeLessThan(reply.indexOf('\n\nO comercial retorna'));
    expect(reply).not.toMatch(/tesoura\. O comercial retorna/u);
  });

  it('keeps the model training reply instead of a canned pitch', () => {
    const reply = sanitizeAttendanceReply(
      'Bom dia! Sim, damos treinamento em PEMT. Se a locação for conosco, o curso entra junto. Só o treinamento o comercial confirma a disponibilidade. Emitimos certificado e carteirinha.',
      {
        userText: 'Bom dia, quero saber se vocês fornecem serviço de treinamento em pemt',
        userTurns: ['Bom dia, quero saber se vocês fornecem serviço de treinamento em pemt'],
        now: saoPauloAt('2026-09-09T08:25:00'),
      },
    );
    expect(reply).toContain('Bom dia!');
    expect(reply).toContain('damos treinamento em PEMT');
    expect(reply).toContain('certificado');
    expect(reply).toContain('carteirinha');
    expect(reply).toContain('disponibilidade');
    expect(reply).not.toMatch(/não temos informação|não locamos/iu);
    expect(reply).toMatch(/\n\nO comercial retorna/u);
  });

  it('does not treat a training question as a catalog miss', () => {
    const reply = sanitizeAttendanceReply('Sim, oferecemos treinamento em plataforma. O comercial confirma o restante no horário.', {
      retrievedKnowledge: 'Nenhum tipo com esse nome no índice.',
      userText: 'voce tem treinamento em plataforma?',
      userTurns: ['voce tem treinamento em plataforma?'],
      now: saoPauloAt('2026-09-09T08:25:00'),
    });
    expect(reply).toContain('oferecemos treinamento');
    expect(reply).not.toMatch(/não locamos/iu);
  });

  it('keeps a follow-up about scheduling instead of repeating the training pitch', () => {
    const reply = sanitizeAttendanceReply(
      'Pode ser. Anoto o pedido de agendamento para o comercial, sem confirmar vaga. Qual data você prefere, quantas pessoas e é junto com locação ou só o curso?',
      {
        userText: 'Gostaria de agendar a data',
        userTurns: [
          'Bom dia, quero saber se vocês fornecem serviço de treinamento em pemt',
          'Gostaria de agendar a data',
        ],
        now: saoPauloAt('2026-09-09T08:34:00'),
      },
    );
    expect(reply).toContain('Qual data você prefere');
    expect(reply).toContain('quantas pessoas');
    expect(reply).toContain('só o curso');
    expect(reply).not.toMatch(/já está registrad/iu);
    expect(reply).not.toContain('damos treinamento em PEMT');
  });

  it('signs every reply with the after-hours AI name', () => {
    const reply = sanitizeAttendanceReply('Trabalhamos com plataforma tesoura em Contagem.', {
      userText: 'tesoura em Contagem por 5 dias a partir de amanhã',
      userTurns: ['tesoura em Contagem por 5 dias a partir de amanhã'],
    });
    expect(reply.startsWith(`${ATTENDANCE_BOT_NAME}: `)).toBe(true);
    expect(reply).toContain('plataforma tesoura');
  });

  it('introduces the after-hours AI on the first turn', () => {
    const reply = sanitizeAttendanceReply('Sim, oferecemos treinamento em PEMT.', {
      userText: 'Bom dia, quero saber se vocês fornecem serviço de treinamento em pemt',
      userTurns: ['Bom dia, quero saber se vocês fornecem serviço de treinamento em pemt'],
      now: saoPauloAt('2026-09-09T08:48:00'),
      introduce: true,
    });
    expect(reply.startsWith(`${ATTENDANCE_BOT_NAME}: `)).toBe(true);
    expect(reply).toContain(`Sou a ${ATTENDANCE_BOT_NAME}`);
    expect(reply).toContain('IA da Acesso Equipamentos');
    expect(reply).toContain('fora do horário comercial');
    expect(reply).toContain('oferecemos treinamento em PEMT');
  });

  it('does not repeat the intro after the bot already spoke', () => {
    const reply = sanitizeAttendanceReply(
      'Pode ser. Qual data você prefere e quantas pessoas vão participar?',
      {
        userText: 'Gostaria de agendar a data',
        userTurns: [
          'Bom dia, quero saber se vocês fornecem serviço de treinamento em pemt',
          'Gostaria de agendar a data',
        ],
        now: saoPauloAt('2026-09-09T08:48:00'),
        introduce: false,
      },
    );
    expect(reply.startsWith(`${ATTENDANCE_BOT_NAME}: `)).toBe(true);
    expect(reply).not.toContain(`Sou a ${ATTENDANCE_BOT_NAME}`);
  });

  it('identifies as the Acesso AI when the customer asks who she is', () => {
    const reply = sanitizeAttendanceReply(
      'Fora do expediente, faço a triagem inicial dos pedidos de locação. Você precisa de betoneira — qual a cidade e para quando começa?',
      {
        userText: 'Quem é você?',
        userTurns: ['preciso de uma betoneira', 'Quem é você?'],
        introduce: false,
        now: saoPauloAt('2026-09-09T17:10:00'),
      },
    );
    expect(reply.startsWith(`${ATTENDANCE_BOT_NAME}: `)).toBe(true);
    expect(reply).toContain(`Sou a ${ATTENDANCE_BOT_NAME}`);
    expect(reply).toContain('IA da Acesso Equipamentos');
    expect(reply).toMatch(/betoneira/iu);
  });

  it('keeps the model closer that says the commercial will finish the booking', () => {
    const reply = sanitizeAttendanceReply(
      'Anotado: treinamento PEMT só o curso, quinta-feira, 7 pessoas. O comercial retorna no horário útil, segunda a sexta, 7h30–17h15, para finalizar o agendamento.',
      {
        userText: 'Somente o curso',
        userTurns: [
          'treinamento em pemt',
          'Gostaria de agendar a data',
          'Na quinta feira, 7 pessoas',
          'Somente o curso',
        ],
        now: saoPauloAt('2026-09-09T08:49:00'),
      },
    );
    expect(reply).toContain('finalizar o agendamento');
    expect(reply).toContain('quinta-feira');
    expect(reply).toContain('7 pessoas');
    expect(reply).toMatch(/\n\nO comercial retorna no horário útil, segunda a sexta, 7h30–17h15, para finalizar o agendamento\./u);
  });

  it('does not register a start date that already passed', () => {
    const wednesday = saoPauloAt('2026-09-09T07:44:00');
    const reply = sanitizeAttendanceReply('Perfeito!', {
      userText: 'pode ser para ontem',
      userTurns: [...captured.userTexts, 'pode ser para ontem'],
      captured,
      now: wednesday,
    });
    expect(reply).toMatch(/já passou|digitação ou confusão/iu);
    expect(reply).not.toMatch(/está registrada/iu);
  });
});

describe('deterministic attendance recommendation', () => {
  it('does not call AI or recommend a platform for a two-ton pallet request', async () => {
    const reply = await replyAsAttendanceBot({
      apiKey: 'not-used-for-deterministic-answer',
      model: 'not-used',
      vaultKnowledge: '',
      history: [],
      userText: 'Preciso elevar pallets de 2 toneladas a 5 metros, qual equipamento recomenda?',
      offHours: true,
    });
    expect(reply.text).toContain('Não encontrei no catálogo um equipamento');
    expect(reply.text).not.toMatch(/mastro|tesoura|articulada/iu);
    expect(reply.text).toContain('sem promessa de disponibilidade');
    expect(reply.text).toContain('horário útil');
  });
});

describe('sandboxNightInstant', () => {
  it('shifts monday morning to 20h10 so the bot can be tested by day', () => {
    const night = sandboxNightInstant(dateFromSaoPauloWallClock('2026-08-31T11:00:00'));
    expect(isBusinessOpen(night)).toBe(false);
    expect(readSaoPauloClock(night).hour).toBe(20);
  });
});

describe('playbookIsDue', () => {
  it('rewrites as soon as the inbox fingerprint changes', () => {
    expect(playbookIsDue({
      lastRunAt: new Date(Date.now() - 1_000),
      refreshMs: 0,
      fingerprintChanged: true,
      forcePlaybook: false,
    })).toBe(true);
  });

  it('skips when the inbox did not change', () => {
    expect(playbookIsDue({
      lastRunAt: new Date(Date.now() - 1_000_000),
      refreshMs: 0,
      fingerprintChanged: false,
      forcePlaybook: false,
    })).toBe(false);
  });

  it('honors an optional cooldown when refreshMs is set', () => {
    expect(playbookIsDue({
      lastRunAt: new Date(Date.now() - 60_000),
      refreshMs: 900_000,
      fingerprintChanged: true,
      forcePlaybook: false,
    })).toBe(false);
  });
});

describe('renderInboxSnapshot', () => {
  it('writes redacted customer lines from chatpro threads', () => {
    const markdown = renderInboxSnapshot({
      now: new Date('2026-08-31T16:00:00.000Z'),
      messageCount: 2,
      threads: [{
        session: {
          id: 'sess-abc',
          phone_key: '5531999999999',
          contact_name: 'Obra Sul',
          is_open: true,
          opened_at: null,
          closed_at: null,
        },
        messages: [{
          id: 'm1',
          session_id: 'sess-abc',
          from_me: false,
          body: 'preciso de plataforma',
          media_type: 'receveid_message',
          sent_at: new Date('2026-08-31T16:00:00.000Z'),
        }],
      }],
    });
    expect(markdown).toContain('Inbox recente');
    expect(markdown).toContain('Cliente: preciso de plataforma');
    expect(markdown).not.toContain('5531999999999');
  });

  it('labels a bot send instead of the commercial team', () => {
    const markdown = renderInboxSnapshot({
      now: new Date('2026-08-31T20:10:00.000Z'),
      messageCount: 2,
      threads: [{
        session: {
          id: 'sess-abc',
          phone_key: '5531999999999',
          contact_name: 'Obra Sul',
          is_open: true,
          opened_at: null,
          closed_at: null,
        },
        messages: [{
          id: 'm2',
          session_id: 'sess-abc',
          from_me: true,
          body: 'Recebemos sua mensagem.',
          media_type: 'send_message',
          sent_at: new Date('2026-08-31T20:06:00.000Z'),
          bot_origin: true,
        }],
      }],
    });
    expect(markdown).toContain('Bot: Recebemos sua mensagem.');
    expect(markdown).not.toContain('Equipe: Recebemos sua mensagem.');
  });
});
