import {
  AVAILABILITY_LIKE,
  PRICE_LIKE,
} from './attendance-brain.js';
import { isGroundedUnofficialEstimate, moneyTokens } from './captured-estimates.js';

export type SandboxJudge = {
  name: string;
  test: (text: string) => boolean;
};

const EMOJI = /\p{Extended_Pictographic}/u;

/**
 * Shared after-hours hygiene: no emoji, invented price, CNPJ form, or 24h-desk copy.
 */
export const HYGIENE_JUDGES: SandboxJudge[] = [
  { name: 'sem emoji', test: (text) => !EMOJI.test(text) },
  { name: 'sem CNPJ', test: (text) => !/\bcnpj\b/iu.test(text) },
  { name: 'sem PF/PJ', test: (text) => !/pessoa f[ií]sica ou empresa|empresa ou pessoa f[ií]sica|\bpf ou pj\b/iu.test(text) },
  { name: 'sem preço', test: (text) => !PRICE_LIKE.test(text) },
  { name: 'sem ligar agora', test: (text) => !/ligar agora|agora mesmo|agilizar|é só chamar|fico aqui/iu.test(text) },
  { name: 'sem alumínio/tubular', test: (text) => !/alum[ií]nio|andaimes tubulares|fachadeiro/iu.test(text) },
  { name: 'sem disponibilidade', test: (text) => !AVAILABILITY_LIKE.test(text) },
  {
    name: 'sem número de frete',
    test: (text) => !/frete.{0,40}(?:r\$|\d[\d.]{2,}\s*reais)|entrega.{0,30}r\$|mobiliza.{0,24}(?:r\$|\d[\d.]{2,}\s*reais)/iu.test(text),
  },
  {
    name: 'sem prazo de entrega cravado',
    test: (text) => !/\b(sai hoje|chega (hoje|amanh[aã])|entrega em \d|leva em \d+\s*(hora|dia)|pronto em \d+\s*hora)/iu.test(text),
  },
];

export const HYGIENE_ALLOW_ESTIMATE: SandboxJudge[] = HYGIENE_JUDGES.filter(
  (judge) => judge.name !== 'sem preço',
);

export const WAIT_HOURS_JUDGE: SandboxJudge = {
  name: 'espera o comercial',
  test: (text) => /7h30|horário (útil|comercial)|próximo dia útil/iu.test(text),
};

export const PASSES_DISTANT_TO_COMMERCIAL: SandboxJudge = {
  name: 'fora da RMBH só comercial',
  test: (text) =>
    /passar (os|estes) dados|sob consulta|comercial (avalia|verifica)|n[aã]o confirmo/iu.test(text)
    && !/\bsim\b.{0,80}(trabalh|locam|atend)/iu.test(text)
    && !/trabalhamos com loca[cç].{0,40}s[aã]o paulo tamb|atendemos s[aã]o paulo tamb/iu.test(text),
};

export const EXPLAINS_FREIGHT_PROCESS: SandboxJudge = {
  name: 'explica o processo do frete',
  test: (text) => /frete|entrega|mobiliza|transporte/iu.test(text)
    && /comercial|or[cç]a|endere[cç]o|cidade|obra/iu.test(text)
    && !/r\$\s*\d/iu.test(text),
};

export const EXPLAINS_RENTAL_PROCESS: SandboxJudge = {
  name: 'explica a locação',
  test: (text) => /loca|or[cç]a|comercial/iu.test(text)
    && /cidade|per[ií]odo|prazo|equipamento|tipo|para quando/iu.test(text),
};

export const ASKS_RENTAL_START: SandboxJudge = {
  name: 'pede para quando começa',
  test: (text) => /para quando|data de in[ií]cio|quando (?:você |voce )?precisa|quando (?:seria|come[cç]a)|come[cç]ar(?:ia)? quando|come[cç]a quando|data.{0,48}precisa come[cç]ar|in[ií]cio da loca/iu.test(text),
};

export const ASKS_EQUIPMENT: SandboxJudge = {
  name: 'pede o equipamento',
  test: (text) => /equipamento|o que (?:você |voce )?precisa|qual (?:a )?(?:m[aá]quina|equipamento)/iu.test(text),
};

export const GREETING_OFFERS_HELP: SandboxJudge = {
  name: 'cumprimento pede como ajudar',
  test: (text) =>
    /como posso ajudar/iu.test(text)
    && !/qual equipamento|qual (?:a )?m[aá]quina|andaime|tesoura|martelo|martelete/iu.test(text),
};

export const NO_UNREQUESTED_ANDAIME_TYPE: SandboxJudge = {
  name: 'não escolhe tipo de andaime sozinho',
  test: (text) => !/tubo e bra|multidirecional|andaime (?:fachadeiro|painel)/iu.test(text),
};

export const CONFIRMS_CALENDAR_START: SandboxJudge = {
  name: 'confirma a data do calendário',
  test: (text) => /15 de setembro/iu.test(text),
};

export const ASKS_ANYTHING_ELSE: SandboxJudge = {
  name: 'pergunta se precisa de mais alguma coisa',
  test: (text) => /precisa de mais alguma coisa|mais alguma coisa\?/iu.test(text),
};

export const CONFIRMS_REGISTERED: SandboxJudge = {
  name: 'diz que está registrado',
  test: (text) => /está registrad|está anotad|sua mensagem está/iu.test(text),
};

export const EXPLAINS_PEMT: SandboxJudge = {
  name: 'explica treinamento PEMT',
  test: (text) =>
    /treinament|pemt/iu.test(text)
    && /certificado|carteirinha/iu.test(text)
    && !/não temos informação|não locamos/iu.test(text),
};

export const STAYS_ON_LOGISTICS: SandboxJudge = {
  name: 'não abre locação em devolução',
  test: (text) =>
    /log[ií]stica|devolu|devolv/iu.test(text)
    && !/por quantos dias|para quando (?:voc[eê] )?precisa|data de in[ií]cio/iu.test(text),
};

/** True when none of the words appear in the reply. */
export function omitsWords(words: string[]): SandboxJudge {
  return {
    name: `não cita ${words.join('/')}`,
    test: (text) => words.every((word) => !new RegExp(word, 'iu').test(text)),
  };
}

export const DOES_NOT_REASK_START: SandboxJudge = {
  name: 'não repregunta início já dito',
  test: (text) => !/para quando você precisa/iu.test(text),
};

/**
 * Allows an unofficial faixa only when it matches the retrieved amount and still waits for commercial.
 */
export function groundedEstimateJudge(allowedAmount: string): SandboxJudge {
  return {
    name: 'estimativa fundamentada ou espera o comercial',
    test: (text) => {
      const quoted = moneyTokens(text);
      if (quoted.length === 0) {
        return /comercial/iu.test(text);
      }
      return isGroundedUnofficialEstimate(text, [
        '## Estimativa não oficial',
        `Faixa captada em proposta equivalente: ${allowedAmount}`,
      ].join('\n'));
    },
  };
}

export const CONFIRMS_TESOURA: SandboxJudge = {
  name: 'confirma tesoura',
  test: (text) => /tesoura/iu.test(text) && !/não (?:temos|locamos|trabalhamos com).{0,80}tesoura/iu.test(text),
};

export const NO_ARTICULADA_SWAP: SandboxJudge = {
  name: 'não troca por articulada',
  test: (text) => !/articulada.{0,80}(no lugar|em vez|poderia funcionar|similar)|não temos plataforma tesoura/iu.test(text),
};

export const CONFIRMS_ANDAIME_TUBO: SandboxJudge = {
  name: 'confirma tubo e braçadeira',
  test: (text) => /tubo e bra/iu.test(text),
};

export const REFUSES_TRUCK: SandboxJudge = {
  name: 'recusa caminhão',
  test: (text) => /não locamos|não trabalhamos com caminh/iu.test(text),
};

export const NO_UNASKED_PHONE: SandboxJudge = {
  name: 'não solta telefone sem pedido',
  test: (text) => !/3376|99470|\(\s*31\s*\)/u.test(text),
};

export const NO_INVENTED_SEDE: SandboxJudge = {
  name: 'não inventa rua da sede',
  test: (text) => {
    if (!/\b(rua|avenida|pra[cç]a|av\.|alameda|travessa)\b/iu.test(text)) {
      return true;
    }
    return /chu[ií]|jo[aã]o pinheiro/iu.test(text);
  },
};

export const NO_TRAINING_SLOT_OR_PRICE: SandboxJudge = {
  name: 'não crava preço nem vaga de treinamento',
  test: (text) =>
    !/r\$|\d+\s*horas?\b.{0,28}(?:curso|aula|treinamento)|turma (?:j[aá] )?(?:confirmada|fechada)|vaga garantida|inscri[cç][aã]o confirmada/iu.test(text),
};

export const NO_TECH_PROCEDURE: SandboxJudge = {
  name: 'não ensina jumper nem bypass',
  test: (text) => !/jumper|bypass|ligar (?:os )?fios|soltar o sensor|desconecte|pode continuar operando/iu.test(text),
};

export const NO_PERMITS_ELEVATED_DRIVE: SandboxJudge = {
  name: 'não libera andar com cesta elevada',
  test: (text) =>
    !/pode (?:andar|deslocar|trafegar).{0,48}cesta elevada|andar com a cesta (?:no alto|elevada).{0,24}(?:liber|permit|normal)/iu.test(text),
};

export const NO_DELIVERY_TODAY: SandboxJudge = {
  name: 'não promete entrega hoje',
  test: (text) => !/\b(sai hoje|chega hoje|entrega hoje|leva hoje|entrega amanh[aã]|s[áa]bado (?:a gente )?entrega)\b/iu.test(text),
};

/**
 * True when the reply refuses that type instead of offering a substitute.
 */
export function refusesFamily(word: string): SandboxJudge {
  const named = new RegExp(word, 'iu');
  const refused = new RegExp(`não (?:locamos|trabalhamos com|alugamos|temos).{0,80}(?:${word})`, 'iu');
  return {
    name: `recusa ${word}`,
    test: (text) => named.test(text) && refused.test(text),
  };
}

/**
 * True when the reply names the family and does not deny it.
 */
export function confirmsFamily(word: string): SandboxJudge {
  const named = new RegExp(word, 'iu');
  const denied = new RegExp(`não (?:temos|locamos|trabalhamos com).{0,80}(?:${word})`, 'iu');
  return {
    name: `confirma ${word}`,
    test: (text) => named.test(text) && !denied.test(text),
  };
}

export const STAYS_IN_RMBH: SandboxJudge = {
  name: 'não trata RMBH como fora de área',
  test: (text) => !/fora da rmbh|não confirmo que dá para locar/iu.test(text),
};

/**
 * Returns the names of judges that failed.
 */
export function failedJudges(text: string, judges: SandboxJudge[]) {
  return judges.filter((judge) => !judge.test(text)).map((judge) => judge.name);
}
