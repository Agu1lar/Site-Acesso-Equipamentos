import { describe, expect, it } from 'vitest';
import {
  DISTANT_REGION_WAIT,
  HOURS_CLOSE,
  sanitizeAttendanceReply,
} from '../../chatpro-playbook/src/attendance-brain';
import {
  ASKS_RENTAL_START,
  CONFIRMS_CALENDAR_START,
  CONFIRMS_TESOURA,
  EXPLAINS_PEMT,
  GREETING_OFFERS_HELP,
  HYGIENE_JUDGES,
  PASSES_DISTANT_TO_COMMERCIAL,
  STAYS_ON_LOGISTICS,
  WAIT_HOURS_JUDGE,
  failedJudges,
} from '../../chatpro-playbook/src/sandbox-judge';

describe('sandbox judges', () => {
  it('flags a triage that skips when the rental starts', () => {
    expect(ASKS_RENTAL_START.test('Trabalhamos com tesoura. Qual a cidade da obra?')).toBe(false);
    expect(ASKS_RENTAL_START.test('Trabalhamos com tesoura. Para quando você precisa?')).toBe(true);
    expect(ASKS_RENTAL_START.test('A articulada começaria quando?')).toBe(true);
    expect(ASKS_RENTAL_START.test('Qual é a data que você precisa começar a locação?')).toBe(true);
  });

  it('rejects a vague commercial-returns closer without hours', () => {
    expect(WAIT_HOURS_JUDGE.test('O comercial retorna assim que possível.')).toBe(false);
  });

  it('accepts the distant-region wait copy', () => {
    expect(PASSES_DISTANT_TO_COMMERCIAL.test(DISTANT_REGION_WAIT)).toBe(true);
    expect(WAIT_HOURS_JUDGE.test(`${DISTANT_REGION_WAIT}\n\n${HOURS_CLOSE}`)).toBe(true);
  });

  it('accepts a sanitized unsafe tesoura draft', () => {
    const text = sanitizeAttendanceReply('A diária é R$ 350', {
      retrievedKnowledge: '- plataforma tesoura: GS 1930',
      userText: 'quanto custa a diaria da plataforma tesoura?',
    });
    expect(failedJudges(text, [...HYGIENE_JUDGES, CONFIRMS_TESOURA, WAIT_HOURS_JUDGE])).toEqual([]);
  });

  it('treats a greeting as help, not a rental recap', () => {
    expect(GREETING_OFFERS_HELP.test('Bom dia!\n\nComo posso ajudar?')).toBe(true);
    expect(GREETING_OFFERS_HELP.test('Bom dia! Qual equipamento você precisa?')).toBe(false);
    expect(GREETING_OFFERS_HELP.test('Trabalhamos com andaime. Como posso ajudar?')).toBe(false);
  });

  it('explains PEMT without a catalog miss', () => {
    expect(EXPLAINS_PEMT.test(
      'Sim, oferecemos treinamento PEMT. Emitimos certificado e carteirinha de operador.',
    )).toBe(true);
    expect(EXPLAINS_PEMT.test('Não temos informação sobre treinamento em PEMT no nosso catálogo.')).toBe(false);
  });

  it('accepts next-week Tuesday as 15 September', () => {
    expect(CONFIRMS_CALENDAR_START.test('A partir de terça-feira, 15 de setembro de 2026.')).toBe(true);
    expect(CONFIRMS_CALENDAR_START.test('A partir de terça-feira, 16 de setembro de 2026.')).toBe(false);
  });

  it('rejects a rental start inside a return', () => {
    expect(STAYS_ON_LOGISTICS.test(
      'Vou encaminhar a devolução. A equipe de logística retorna no horário comercial, de segunda a sexta, 7h30–17h15.',
    )).toBe(true);
    expect(STAYS_ON_LOGISTICS.test('Vou anotar sua devolução. Para quando você precisa?')).toBe(false);
  });

  it('blocks a grounded estimate because the bot only triages', () => {
    const retrieved = [
      '## Estimativa não oficial',
      'Faixa captada em proposta equivalente: R$ 4.800',
    ].join('\n');
    const text = [
      'Trabalhamos com plataforma tesoura. Em um pedido parecido o comercial já orçou cerca de R$ 4.800.',
      'Isso não é uma tabela oficial.',
    ].join(' ');
    expect(sanitizeAttendanceReply(text, { retrievedKnowledge: retrieved })).not.toContain('4.800');
  });
});
