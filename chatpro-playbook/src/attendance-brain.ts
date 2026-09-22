import {
  HARD_RULE_DISTANT_REGION,
  HARD_RULE_MISSING_DATA,
  HARD_RULE_NEVER_AVAILABILITY,
  HARD_RULE_NEVER_CLOSE,
  HARD_RULE_NEVER_FREIGHT,
  HARD_RULE_NEVER_PRICE,
} from './schema.js';
import {
  classifyMentionedStart,
  formatAttendanceDeskClock,
  formatAttendanceGreeting,
  formatConfirmedStart,
  previousAttendanceLabel,
  sameSaoPauloDay,
} from './attendance-clock.js';
import { estimateFamily, mentionsRentalStart, parseRentalDayCounts, replyAsksRentalStart } from './captured-estimates.js';
import {
  ATTENDANCE_BOT_NAME,
  ensureAttendanceIdentity,
  isAttendanceIdentityAsk,
} from './attendance-identity.js';
import { formatFleetRecommendation, loadFleetCatalog, recommendFleetEquipment } from './fleet-catalog.js';

export const HOURS_CLOSE =
  'O comercial retorna no horário útil, segunda a sexta, 7h30–17h15.';

export const SANDBOX_SAFE_FALLBACK =
  `Recebemos. Fora do expediente não passo valor nem frete.\n\n${HOURS_CLOSE}`;

export const OFF_HOURS_WAIT =
  `Sua mensagem já chegou. Fora desse horário o telefone não é atendido.\n\n${HOURS_CLOSE}`;

export const DISTANT_REGION_WAIT =
  'A locação padrão é Belo Horizonte e a região metropolitana. Fora da RMBH (São Paulo ou qualquer lugar mais distante) não confirmo que dá para locar: depende do equipamento e de um período longo, em geral só plataforma ou guindaste tipo Franna, e só em contrato maior. Vou passar os dados ao comercial para ver a viabilidade. Qual equipamento, por quantos dias e para quando?';

export const PRICE_LIKE =
  /r\$\s*\d|\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\s*reais\b|\b\d{1,3}\.\d{3}\b|\bdi[áa]ria\b.{0,24}\d/iu;
const FREIGHT_LIKE =
  /frete.{0,40}(?:r\$|\d[\d.]{2,}\s*reais)|entrega.{0,30}r\$|mobiliza.{0,24}(?:r\$|\d[\d.]{2,}\s*reais)/iu;
export const AVAILABILITY_LIKE =
  /\b(est[áa] dispon[ií]vel|temos dispon|temos disponibilidade|h[aá] disponibilidade|em estoque|\bestoque\b|unidades? livres?|sa(?:i|em) hoje|pronto para retirar|temos plataformas?|temos tesouras?)\b/iu;
const IMPLICIT_STOCK =
  /\btemos\s+(?:a|o|as|os|um|uma)\s+(?:gs|sj|hb|pep|plataforma|tesoura|betoneira|andaime|manipulador|manitou|mxt|franna)|\btemos\s+(?:plataformas?|tesouras?|manipulador|manitou|mxt|franna|gerador|paleteira|martelete|compactador|compressor)|\btemos de \d/iu;
const CALL_NOW_LIKE =
  /agilizar|agora mesmo|ligar agora|chamar agora|pode ligar(?! no horário)|liga pra|cham(?:e|a) (?:no )?whats/iu;
const EMOJI_LIKE = /\p{Extended_Pictographic}/gu;
const DESK_ALWAYS_OPEN =
  /é só chamar|\bfico aqui\b|\bfico no aguardo\b|\bqualquer d[uú]vida\b|\bacelera(?:r)?\b|\bpode deixar os dados\b/iu;
const VALUES_PROMISE =
  /proposta com valores|proposta com frete|proposta (?:é|ser[aá]) montada|enviar? a proposta|valores de loca[cç][aã]o|cronograma de entrega|detalhar a proposta|monta(?:r)? a proposta/iu;
const URGENT_PROMISE =
  /resolv(?:er|a).{0,30}agora|vai priorizar|ser[aá] priorizad|atendimento priorit[aá]rio|prioridade imediata|retorna (?:hoje|amanh[aã]|segunda)/iu;
const FAKE_CLOSE =
  /\btemos solu[cç][aã]o\b|\boutras? solu[cç][oõ]es?(?: nossa)?\b|alternativa para (?:a|o)\b|\btemos diferentes tipos\b|confirmar.{0,60}(?:algo|equipamento|modelo) compat[ií]vel|ver(?:ificar)? se conseguimos.{0,40}(?:alternativa|algo)|\bandaimes tubulares\b|alum[ií]nio|tubular|fachadeiro/iu;
const MODEL_PITCH =
  /\b(?:gs[\s-]?\d{3,}|mxt\s*\d{2,}|sj\s*iii|hb[\s-]?\d{3,}|pep[\s-]?\d+)/iu;

const AGENT_SIGNATURE_LINE =
  /^[ \t]*\*[ \t]*\p{Lu}[\p{L}'.-]*(?:[ \t]+\p{Lu}[\p{L}'.-]*){0,2}[ \t]*\*[ \t]*$/gmu;
const AGENT_SIGNATURE_STAMP =
  /\*[ \t]*\p{Lu}[\p{L}'.-]*(?:[ \t]+\p{Lu}[\p{L}'.-]*){0,2}[ \t]+\*/gu;

/**
 * Removes the `*Nome *` attendant stamp ChatPro adds on API sends, including copies inside the text.
 */
export function stripAgentSignatures(text: string) {
  return text
    .replaceAll(AGENT_SIGNATURE_LINE, '')
    .replaceAll(AGENT_SIGNATURE_STAMP, ' ')
    .replace(/[ \t]{2,}/gu, ' ')
    .replace(/[ \t]+$/gmu, '')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

const URA_MENU_OPTION = /^[ \t]*\*?[ \t]*([1-9])[ \t]*\*?[ \t]*[-.)\]][ \t]*(.+)$/u;

function uraMenuOptions(text: string) {
  const options = new Map<string, string>();
  for (const line of text.split(/\r?\n/u)) {
    const match = URA_MENU_OPTION.exec(line);
    const label = match?.[2]?.replaceAll('*', '').trim();
    if (match?.[1] && label && label.length >= 4) {
      options.set(match[1], label);
    }
  }
  return options;
}

/**
 * Expands a bare URA digit reply into the menu label so the catalog type is not lost.
 */
export function expandUraMenuUserLine(userText: string, previousAssistant?: string | null) {
  const digit = userText.trim().replace(/[.)\s]+$/u, '');
  if (!/^[1-6]$/u.test(digit) || !previousAssistant?.trim()) {
    return userText;
  }
  const options = uraMenuOptions(previousAssistant);
  const label = options.get(digit);
  return options.size >= 2 && label ? `${digit}. ${label}` : userText;
}

/** Who produced a thread turn. Only `bot` and `customer` count as state this bot collected. */
export type AttendanceTurnOrigin = 'bot' | 'human' | 'ura' | 'customer';

export type AttendanceTurn = {
  role: 'user' | 'assistant';
  text: string;
  origin?: AttendanceTurnOrigin;
  at?: Date;
};

type AttendanceIntent = 'commercial' | 'general' | 'logistics' | 'mechanical';

const MECHANICAL_INTENT =
  /\b(mec[aâ]nic|manuten[cç][aã]o|defeito|falha|c[oó]digo de erro|erro\s*\d|parou|n[aã]o liga|n[aã]o movimenta|travou|vazamento|fuma[cç]a|sensor|jumper|pe[cç]a|tens[aã]o|operador.{0,30}(?:cesta|preso)|máquina parada|maquina parada)\b/iu;
const LOGISTICS_INTENT =
  /\b(log[ií]stic|retirada|devolu[cç][aã]o|devolv\p{L}*|coleta|recolher|agendar.{0,30}(?:retirada|coleta)|fim da loca[cç][aã]o|equipamento errado|troca imediata|programa[cç][aã]o de entrega|caminh[aã]o.{0,40}(?:chega|retira|coleta)|chega.{0,40}caminh[aã]o|v[eê]m buscar|buscar o equipamento)\b/iu;
const GENERAL_INTENT =
  /\b(cau[cç][aã]o|multa|franquia|seguro|cnpj|pessoa f[ií]sica|filiais?|quantas m[aá]quinas|anos? (?:de mercado|no setor)|fundad[ao]|endere[cç]o da sede|telefone|whats(?:app)?|e-?mail|site|carteirinha)\b|treinament|\bpemt\b/iu;

function attendanceIntent(text: string): AttendanceIntent {
  if (MECHANICAL_INTENT.test(text)) {
    return 'mechanical';
  }
  if (LOGISTICS_INTENT.test(text)) {
    return 'logistics';
  }
  if (GENERAL_INTENT.test(text)) {
    return 'general';
  }
  return 'commercial';
}

/**
 * True when a draft would confirm price, freight, stock or invite a call that nobody will answer.
 */
export function attendanceReplyLooksUnsafe(
  text: string,
  _options?: { retrievedKnowledge?: string | null },
) {
  const normalized = text.toLowerCase();
  if (FREIGHT_LIKE.test(normalized) || AVAILABILITY_LIKE.test(normalized) || IMPLICIT_STOCK.test(normalized)) {
    return true;
  }
  return PRICE_LIKE.test(normalized);
}

function looksLikeCallNowInvite(text: string) {
  return CALL_NOW_LIKE.test(text);
}

function dropPushyUnits(text: string) {
  const paragraphs = text.split(/\n{2,}/u);
  const keptParagraphs = paragraphs.flatMap((paragraph) => {
    const cleaned = paragraph.replaceAll(EMOJI_LIKE, '').replace(/[ \t]{2,}/gu, ' ').trim();
    if (!cleaned) {
      return [];
    }
    if (looksLikeCallNowInvite(cleaned)) {
      return [];
    }
    const sentences = cleaned.split(/(?<=[.!?])\s+|\n+/u);
    const kept = sentences.filter((sentence) => {
      const unit = sentence.trim();
      if (!unit) {
        return false;
      }
      return !looksLikeCallNowInvite(unit)
        && !DESK_ALWAYS_OPEN.test(unit)
        && !VALUES_PROMISE.test(unit)
        && !URGENT_PROMISE.test(unit)
        && !FAKE_CLOSE.test(unit)
        && !AVAILABILITY_LIKE.test(unit)
        && !IMPLICIT_STOCK.test(unit)
        && !MODEL_PITCH.test(unit);
    });
    const next = kept.join(' ').trim();
    return next ? [next] : [];
  });
  return keptParagraphs.join('\n\n').trim();
}

/**
 * Drops after-hours “liga agora” blocks. Phone is not answered off duty.
 */
export function stripOffHoursCallNow(text: string) {
  const next = dropPushyUnits(text);
  if (!next) {
    return OFF_HOURS_WAIT;
  }
  return next;
}

function askedEquipmentFamily(userText: string, userTurns: string[] = []) {
  return estimateFamily(userText)
    ?? (isAttendanceGreeting(userText) ? undefined : estimateFamily([...userTurns, userText].join('\n')));
}

function stripWrongFamilyPrefix(text: string, userText: string) {
  const family = estimateFamily(userText);
  if (!family) {
    return text;
  }
  return text
    .replace(/trabalhamos com [^.!?\n]+[.!?]?/giu, (unit) => (
      estimateFamily(unit) === family ? unit : ''
    ))
    .replace(/[ \t]{2,}/gu, ' ')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

const FAMILY_LABEL: Record<string, string> = {
  tesoura: 'plataforma tesoura',
  andaime: 'andaime',
  articulada: 'plataforma articulada',
  paleteira: 'paleteira',
  gerador: 'gerador',
  martelete: 'martelete',
  compactador: 'compactador',
  compressor: 'compressor',
  manitou: 'manipulador telescópico',
  guindaste: 'guindaste tipo Franna',
  guincho: 'guincho',
  esmerilhadeira: 'esmerilhadeira',
  betoneira: 'betoneira',
  lanca: 'plataforma telescópica',
  mastro: 'plataforma mastro',
  plataforma: 'plataforma elevatória',
};

function familySpokenName(family: string, retrieved: string, userBlob = '') {
  if (family === 'andaime' && /tubo e bra/iu.test(retrieved) && userSpecifiedAndaimeType(userBlob)) {
    return 'andaime tipo tubo e braçadeira';
  }
  return FAMILY_LABEL[family] ?? family;
}

function familyAlreadyNamed(text: string, family: string) {
  if (family === 'guindaste') {
    return /franna|guindaste/iu.test(text);
  }
  if (family === 'manitou') {
    return /manitou|manipulador/iu.test(text);
  }
  if (family === 'guincho') {
    return /guincho|grua/iu.test(text);
  }
  return new RegExp(family, 'iu').test(text);
}

function userSpecifiedAndaimeType(text: string) {
  return /tubo e bra|que tipo de andaime|quais tipos? de andaime|andaime (?:fachadeiro|multidirecional|painel)/iu
    .test(text);
}

function stripUnrequestedAndaimeType(text: string, userText: string, userTurns: string[]) {
  const blob = coverageQuestionBlob(userText, userTurns);
  if (!userText.trim() || userSpecifiedAndaimeType(blob)) {
    return text;
  }
  return text
    .replace(/\s*(?:tipo\s+)?tubo e bra[cç]adeira/giu, '')
    .replace(/[ \t]{2,}/gu, ' ')
    .trim();
}
function nameAskedFamily(
  text: string,
  retrieved: string | null | undefined,
  userText: string,
  userTurns: string[],
) {
  if (/Nenhum tipo com esse nome/iu.test(retrieved ?? '') || /não locamos/iu.test(text)) {
    return text;
  }
  if (userAsksDistantCoverage(coverageQuestionBlob(userText, userTurns))) {
    return text;
  }
  const family = askedEquipmentFamily(userText, userTurns);
  if (!family || family === 'plataforma' || familyAlreadyNamed(text, family)) {
    return text;
  }
  const blob = coverageQuestionBlob(userText, userTurns);
  return `Trabalhamos com ${familySpokenName(family, retrieved ?? '', blob)}. ${text}`.trim();
}

function repairCatalogDenial(
  text: string,
  retrieved: string | null | undefined,
  userText = '',
  userTurns: string[] = [],
) {
  if (!retrieved || /Nenhum tipo com esse nome/iu.test(retrieved)) {
    return text;
  }
  if (userAsksDistantCoverage(coverageQuestionBlob(userText, userTurns))) {
    return text;
  }
  let next = text;
  const family = askedEquipmentFamily(userText, userTurns);
  const thread = [...userTurns, userText].join('\n');
  const canNameTesoura = /plataforma tesoura/iu.test(retrieved)
    && (family === 'tesoura'
      || /tesoura|\bgs[\s-]?\d|\bsj\s*iii/iu.test(thread)
      || (!family && !thread.trim()));
  if (canNameTesoura) {
    next = next.replace(
      /[^.!?\n]*não (?:temos|locamos|trabalhamos com)[^.!?\n]{0,80}tesoura[^.!?\n]*[.!?]?/giu,
      '',
    );
    if (!/tesoura/iu.test(next)) {
      next = `Trabalhamos com plataforma tesoura. ${next}`.trim();
    }
  }
  const canNameAndaime = /andaime/iu.test(retrieved)
    && /tubo e bra/iu.test(retrieved)
    && userSpecifiedAndaimeType(thread)
    && (family === 'andaime' || /andaime/iu.test(thread));
  if (canNameAndaime) {
    next = next.replace(
      /[^.!?\n]*não (?:temos|locamos|trabalhamos com)[^.!?\n]{0,80}andaime[^.!?\n]*[.!?]?/giu,
      '',
    );
    if (!/andaime|tubo e bra/iu.test(next)) {
      next = `Trabalhamos com andaime tipo tubo e braçadeira. ${next}`.trim();
    }
  }
  const canNameArticulada = /plataforma articulada/iu.test(retrieved)
    && (family === 'articulada' || /articulada/iu.test(thread));
  if (canNameArticulada && !/articulada/iu.test(next)) {
    next = `Trabalhamos com plataforma articulada. ${next}`.trim();
  }
  const canNameBetoneira = /betoneira/iu.test(retrieved) && /betoneira/iu.test(thread);
  if (canNameBetoneira) {
    next = next.replace(
      /[^.!?\n]*não (?:temos|locamos|trabalhamos com)[^.!?\n]{0,80}(?:betoneira|esse equipamento)[^.!?\n]*[.!?]?/giu,
      '',
    );
    if (!/betoneira/iu.test(next)) {
      next = `Trabalhamos com betoneira. ${next}`.trim();
    }
  }
  const supportedOtherFamilies = [
    ['gerador', /gerador/iu],
    ['martelete', /martelete/iu],
    ['paleteira', /paleteira/iu],
    ['compactador', /compactador/iu],
    ['compressor', /compressor/iu],
    ['esmerilhadeira', /esmerilhadeira/iu],
    ['manipulador telescópico', /manitou|manipulador/iu],
    ['guindaste tipo Franna', /franna|guindaste/iu],
  ] as const;
  for (const [spokenName, matcher] of supportedOtherFamilies) {
    if (!matcher.test(retrieved) || !matcher.test(thread)) {
      continue;
    }
    next = next
      .replace(new RegExp(`não locamos\\s+(?:o |a )?(?:${matcher.source})\\s+nem\\s+`, 'giu'), 'Não locamos ')
      .replace(new RegExp(`\\s+nem\\s+(?:o |a )?(?:${matcher.source})`, 'giu'), '')
      .replace(new RegExp(`[^.!?\\n]*não (?:temos|locamos|trabalhamos com)[^.!?\\n]{0,60}(?:${matcher.source})[^.!?\\n]*[.!?]?`, 'giu'), '');
    if (!matcher.test(next)) {
      next = `Trabalhamos com ${spokenName}. ${next}`.trim();
    }
  }
  return next.replace(/\s{2,}/gu, ' ').replace(/\n{3,}/gu, '\n\n').trim() || text;
}

function stripCnpjAsk(text: string) {
  return text.split(/\n{2,}/u).flatMap((paragraph) => {
    const kept = paragraph.split(/(?<=[.!?])\s+/u).flatMap((sentence) => {
      if (!/\bcnpj\b/iu.test(sentence)) {
        return [sentence];
      }
      const cleaned = sentence
        .replace(/\s*\d+\.\s*Qual é seu CNPJ[^?]{0,120}\??/giu, '')
        .replace(/[,;]?\s*(?:o |seu |do )?cnpj da empresa(?: \([^)]*\))?/giu, '')
        .replace(/[,;]?\s*(?:o |seu |do )?cnpj\b[^,?.!]*/giu, '')
        .replace(/\s*ou (?:se é |você é )?pessoa f[ií]sica[^,?.!]*/giu, '')
        .replace(/\bpreciso d[oaes]*\s*[.,]?\s*/giu, '')
        .replace(/\bpreciso e do\b/giu, 'preciso do')
        .replace(/\bqual é\??\s*/giu, '')
        .replace(/\s{2,}/gu, ' ')
        .replace(/^[.,;\s]+|[.,;\s]+$/gu, '')
        .trim();
      return cleaned.length >= 12 ? [cleaned] : [];
    });
    const next = kept.join(' ').replace(/\s{2,}/gu, ' ').trim();
    return next ? [next] : [];
  }).join('\n\n');
}

function stripPfPjAsk(text: string) {
  return text.split(/\n{2,}/u).flatMap((paragraph) => {
    const kept = paragraph.split(/(?<=[.!?])\s+/u).filter((sentence) => {
      const unit = sentence.trim();
      if (!unit) {
        return false;
      }
      return !/pessoa f[ií]sica ou empresa|empresa ou pessoa f[ií]sica|\bpf ou pj\b|é (pessoa f[ií]sica|empresa)\??/iu.test(unit);
    });
    const next = kept.join(' ').replace(/\s{2,}/gu, ' ').trim();
    return next ? [next] : [];
  }).join('\n\n');
}

function stripPixKeyTalk(text: string) {
  return text.split(/\n{2,}/u).flatMap((paragraph) => {
    const kept = paragraph.split(/(?<=[.!?])\s+/u).filter((sentence) => {
      const unit = sentence.trim();
      if (!unit) {
        return false;
      }
      return !/chave\s*pix|pix:\s*\S+@[^\s]+/iu.test(unit);
    });
    const next = kept.join(' ').replace(/\s{2,}/gu, ' ').trim();
    return next ? [next] : [];
  }).join('\n\n');
}

function looksLikeEquipmentAsk(userText: string) {
  return /(caminh|tesoura|articulada|andaime|plataforma|betoneira|guindaste|franna|gerador|martelete|\bmartelo\b|manitou|compressor|empilhadeira|retroescavadeira|trator|escavadeira|munck|furadeira|paleteira|compactador|esmerilh|guincho|grua)/iu.test(userText);
}

function looksLikeCoverageQuestion(userText: string) {
  if (userAsksDistantCoverage(userText)) {
    return true;
  }
  if (!/(alug|loca|atend|trabalh).{0,80}(para|em)\b/iu.test(userText)) {
    return false;
  }
  return (RMBH_PLACE.test(userText) || DISTANT_PLACE.test(userText)) && !looksLikeEquipmentAsk(userText);
}

function isCollectionVehicleAsk(text: string) {
  return /devolv|coleta|retirada|buscar|v[eê]m buscar|chega.{0,40}caminh|caminh[aã]o.{0,40}(?:chega|busca|retira|coleta)/iu
    .test(text);
}

function isCatalogSpecAsk(text: string) {
  if (/\b(alug|loca[cç]|or[cç]amento|por \d+\s*dias|preciso de|quero alugar)\b/iu.test(text)) {
    return false;
  }
  return /\b(sobe quantos|quantos metros|qual a altura|altura (?:de trabalho|m[aá]xima)|carga da cesta|capacidade de carga|pode andar com a cesta|deslocar com a cesta|anda com a cesta)\b/iu
    .test(text);
}

function repairOffCatalog(text: string, options?: {
  retrievedKnowledge?: string | null;
  userText?: string;
}) {
  const retrieved = options?.retrievedKnowledge ?? '';
  const userText = options?.userText ?? '';
  if (text === DISTANT_REGION_WAIT || /Fora da RMBH/u.test(text)) {
    return text;
  }
  if (mentionsOperatorTraining(userText)) {
    return text;
  }
  if (!/Nenhum tipo com esse nome/iu.test(retrieved)) {
    return text;
  }
  if (!looksLikeEquipmentAsk(userText)) {
    return text.replace(/(?:^|\s)[^.!?\n]*n[aã]o locamos esse equipamento[^.!?\n]*[.!?]?/giu, ' ').trim();
  }
  if (/não locamos/iu.test(text)) {
    return text;
  }
  if (looksLikeCoverageQuestion(userText) || isCollectionVehicleAsk(userText)) {
    return text;
  }
  if (/caminh/iu.test(userText) || /caminh/iu.test(text)) {
    return `Não locamos caminhão. ${text}`.trim();
  }
  if (/como funciona|quanto (custa|fica|é o frete|tempo)|preço estimado/iu.test(userText)) {
    return text;
  }
  return `Não locamos esse equipamento. ${text}`.trim();
}

const OFF_CATALOG_LABEL: Record<string, string> = {
  caminhao: 'caminhão',
  empilhadeira: 'empilhadeira',
  escavadeira: 'escavadeira',
  munck: 'caminhão Munck',
  retroescavadeira: 'retroescavadeira',
  trator: 'trator',
};

function enforceExplicitCatalogMisses(
  text: string,
  retrieved: string | null | undefined,
  userText = '',
) {
  const match = retrieved?.match(/Tipos pedidos fora do cat[aá]logo:\s*([^.]*)\./iu);
  const misses = match?.[1]?.split(',').map((item) => item.trim()).filter(Boolean) ?? [];
  let next = text;
  for (const miss of misses) {
    if (/caminh/iu.test(miss) && isCollectionVehicleAsk(userText)) {
      continue;
    }
    const matcher = new RegExp(miss, 'iu');
    const paragraphs = next.split(/\n{2,}/u).flatMap((paragraph) => {
      const kept = paragraph.split(/(?<=[.!?])\s+|\n+/u).filter((sentence) =>
        !matcher.test(sentence)
        || !/(confirm|verific|consult|alternativa|compat[ií]vel|conseguimos|vou ver)/iu.test(sentence));
      const keptParagraph = kept.join(' ').trim();
      return keptParagraph ? [keptParagraph] : [];
    });
    next = paragraphs.join('\n\n');
    const denied = new RegExp(
      `n[aã]o (?:locamos|alugamos|trabalhamos com)[^.!?]{0,50}${miss}|${miss}[^.!?]{0,50}n[aã]o (?:locamos|alugamos|trabalhamos com)`,
      'iu',
    );
    if (!denied.test(next)) {
      next = `Não locamos ${OFF_CATALOG_LABEL[miss] ?? miss}. ${next}`.trim();
    }
  }
  return next;
}

const OFF_CATALOG_SUBSTITUTE =
  /talvez uma plataforma|movimenta[cç][aã]o vertical|algum desses|outras op[cç][oõ]es|tem interesse em algum|posso ajudar com (?:algum desses|outro)|nossa frota [eé] focada|nosso cat[aá]logo trabalha|cat[aá]logo trabalha com plataformas/iu;

function stripOffCatalogSubstitutes(text: string, userText: string) {
  if (!/n[aã]o (?:locamos|alugamos|trabalhamos com)/iu.test(text)) {
    return text;
  }
  if (!/empilhadeira|caminh|retroescavadeira|trator|escavadeira/iu.test(userText)) {
    return text;
  }
  return text.split(/\n{2,}/u).flatMap((paragraph) => {
    const kept = paragraph.split(/(?<=[.!?])\s+|\n+/u).filter((sentence) => {
      if (OFF_CATALOG_SUBSTITUTE.test(sentence)) {
        return false;
      }
      const offersUnaskedLine = /trabalhamos com/iu.test(sentence)
        && /plataforma|andaime|ferramenta/iu.test(sentence)
        && !/plataforma|andaime|tesoura|articulada|ferramenta/iu.test(userText);
      return !offersUnaskedLine;
    });
    const next = kept.join(' ').trim();
    return next ? [next] : [];
  }).join('\n\n');
}

function stripMisreadCollectionTruck(text: string, userText: string) {
  if (!isCollectionVehicleAsk(userText)) {
    return text;
  }
  if (/\balug|\blocam|\bpipa\b|\bmunck\b/iu.test(userText) && !/devolv|buscar|coleta|retirada/iu.test(userText)) {
    return text;
  }
  return text.replace(/(?:^|\n)Não locamos caminhão\.\s*/giu, '').trim();
}

function stripInventedPemtGloss(text: string) {
  return text.replace(/\bPEMT\s*\([^)]{0,80}\)/giu, 'PEMT');
}

function isHeightSpecAsk(text: string) {
  return /\b(sobe quantos|quantos metros|qual a altura|altura (?:de trabalho|m[aá]xima))\b/iu.test(text);
}

function catalogHeightFromRetrieved(retrieved: string, userText: string) {
  const model = userText.match(/\b(gs[\s-]?\d{3,4}[a-z]?|sj[\s-]*(?:iii\s*)?\d{3,4}|hb[\s-]*p?\d+|pep[\s-]?\d+)/iu);
  if (!model?.[0]) {
    return null;
  }
  const compact = (value: string) => value.toLowerCase().replace(/[\s-]+/gu, '');
  const needle = compact(model[0]);
  const fromRetrieved = retrieved.split('\n').find((item) => compact(item).includes(needle));
  const retrievedHeight = fromRetrieved?.match(/~\s*(\d+(?:[.,]\d+)?)\s*m/iu);
  if (retrievedHeight?.[1]) {
    return `${retrievedHeight[1].replace('.', ',')} m`;
  }
  const matches = loadFleetCatalog().filter((item) => (
    compact(item.name).includes(needle)
    || item.models.some((value) => compact(value).includes(needle))
  ));
  const hit = matches.find((item) => item.heightM !== undefined) ?? matches[0];
  if (!hit?.heightM) {
    return null;
  }
  return `${String(hit.heightM).replace('.', ',')} m`;
}

function ensureFreightProcessOnDeliveryAsk(text: string, userText: string) {
  if (!/entregam|entregar|fazem entrega|levam (?:o )?equipamento/iu.test(userText)) {
    return text;
  }
  if (userAsksDistantCoverage(userText) || /frete|mobiliza|or[cç]a.{0,40}endere[cç]o/iu.test(text)) {
    return text;
  }
  return `${text}\n\nO frete é orçado conforme o endereço da obra.`.trim();
}

function ensureCatalogHeightAnswer(
  text: string,
  userText: string,
  retrieved: string | null | undefined,
) {
  if (!isCatalogSpecAsk(userText) || !isHeightSpecAsk(userText)) {
    return text;
  }
  const height = catalogHeightFromRetrieved(retrieved ?? '', userText);
  if (!height) {
    return text;
  }
  const heightRe = new RegExp(height.replace(',', '[,.]').replace(' m', '\\s*m'), 'iu');
  if (heightRe.test(text)) {
    return text;
  }
  return `${text}\n\nNa ficha, cerca de ${height} de trabalho.`.trim();
}

function stripRentalTriageOnSpecAsk(text: string, userText: string) {
  if (!isCatalogSpecAsk(userText)) {
    return text;
  }
  const askedTesoura = /tesoura/iu.test(userText) && !/articulada/iu.test(userText);
  return text.split(/\n{2,}/u).flatMap((paragraph) => {
    const kept = paragraph.split(/(?<=[.!?])\s+|\n+/u).filter((sentence) => {
      if (/para quando|cidade da obra|por quantos dias|voc[eê] est[aá] or[cç]ando|para uma loca[cç]/iu.test(sentence)) {
        return false;
      }
      return !askedTesoura || !/articulada/iu.test(sentence);
    });
    const next = kept.join(' ').trim();
    return next ? [next] : [];
  }).join('\n\n');
}

function stripInventedMechanicalAdvice(text: string, intent: AttendanceIntent) {
  if (intent !== 'mechanical') {
    return text;
  }
  const next = text.split(/\n{2,}/u).flatMap((paragraph) => {
    const kept = paragraph.split(/(?<=[.!?])\s+|\n+/u).filter((sentence) => (
      !/jumper|bypass|ligar (?:os )?fios|pode ser sensor|hidr[aá]ulica ou outra|n[aã]o resolve e at[eé] piora/iu.test(sentence)
    ));
    const keptText = kept.join(' ').trim();
    return keptText ? [keptText] : [];
  }).join('\n\n');
  if (/parar|interromper|dist[aâ]ncia|n[aã]o improvise|respons[aá]vel de seguran/iu.test(next)) {
    return next;
  }
  const safety = 'Não improvise no sistema. Interrompa o uso, mantenha distância e acione o responsável de segurança da obra.';
  return next ? `${next}\n\n${safety}`.trim() : safety;
}

function dropBrokenAsks(text: string) {
  return text.split(/\n{2,}/u).flatMap((paragraph) => {
    const kept = paragraph.split(/(?<=[.!?])\s+/u).filter((sentence) => {
      const unit = sentence.trim();
      if (!unit) {
        return false;
      }
      if (/preciso de:\s*\d+\.?\s*$/iu.test(unit)) {
        return false;
      }
      if (/^(também )?preciso\s*$/iu.test(unit)) {
        return false;
      }
      if (/para estruturar.{0,80}preciso de:\s*\d+/iu.test(unit)) {
        return false;
      }
      return true;
    });
    const next = kept.join(' ').trim();
    return next ? [next] : [];
  }).join('\n\n')
    .replace(/:\s*1\.\s+/gu, ': ')
    .replace(/\?\s+\d+\.\s+/gu, '? ')
    .trim();
}

function stripUnrequestedContact(text: string, userText: string) {
  if (/telefone|whats(?:app)?|e-?mail|contato/iu.test(userText)) {
    return text;
  }
  return text.split(/\n{2,}/u).flatMap((paragraph) => {
    const kept = paragraph.split(/(?<=[.!?])\s+|\n+/u).filter((sentence) =>
      !/(?:\(?\d{2}\)?\s*)?\d{4,5}[-\s]?\d{4}|\bwhats(?:app)?\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu.test(sentence));
    const next = kept.join(' ').trim();
    return next ? [next] : [];
  }).join('\n\n');
}

function routeDepartmentText(text: string, intent: AttendanceIntent) {
  if (intent === 'commercial' || intent === 'general') {
    return text;
  }
  const team = intent === 'mechanical' ? 'equipe de mecânica' : 'equipe de logística';
  const capitalizedTeam = `${team[0]?.toUpperCase() ?? ''}${team.slice(1)}`;
  return text
    .replace(/\bequipe de manuten[cç][aã]o\b/giu, 'equipe de mecânica')
    .replace(/\b(?:ao|pro) comercial\b/giu, `à ${team}`)
    .replace(/\bo comercial retorna\b/giu, `${capitalizedTeam} retorna`)
    .replace(/\bpelo comercial\b/giu, `pela ${team}`)
    .replace(/\bcomercial\/mec[aâ]nica\b/giu, 'mecânica');
}

function stripWrongDepartmentQuestions(text: string, intent: AttendanceIntent, threadText = '') {
  if (intent === 'commercial') {
    return text;
  }
  const trainingThread = mentionsOperatorTraining(threadText);
  return text.split(/\n{2,}/u).flatMap((paragraph) => {
    const kept = paragraph.split(/(?<=[.!?])\s+|\n+/u).filter((sentence) => {
      if (/por quantos dias|dura[cç][aã]o da loca[cç][aã]o/iu.test(sentence)) {
        return false;
      }
      if (intent === 'general' && sentence.includes('?')
        && /equipamento|m[aá]quina|para quando|cidade da obra|loca[cç][aã]o/iu.test(sentence)
        && !trainingThread) {
        return false;
      }
      if (
        (intent === 'mechanical' || intent === 'logistics')
        && /para quando (?:voc[eê] )?precisa|data de in[ií]cio|quando come[cç]a a loca[cç][aã]o/iu.test(sentence)
      ) {
        return false;
      }
      return true;
    });
    const next = kept.join(' ').trim();
    return next ? [next] : [];
  }).join('\n\n');
}

function ensureDepartmentTriage(text: string, intent: AttendanceIntent, userText: string, userTurns: string[]) {
  if (intent !== 'mechanical' && intent !== 'logistics') {
    return text;
  }
  const blob = coverageQuestionBlob(userText, userTurns);
  const questions: string[] = [];
  const currentQuestionCount = text.match(/\?/gu)?.length ?? 0;
  if (intent === 'logistics') {
    if (/equipamento errado|troca/iu.test(blob)
      && !estimateFamily(blob)
      && !/qual equipamento.{0,50}(?:entregue|correto|pedido)/iu.test(text)) {
      questions.push('Qual equipamento foi entregue e qual deveria ser o correto?');
    }
    if (!/\b(rua|avenida|av\.|endere[cç]o|cep|n[uú]mero)\b/iu.test(blob)
      && !/endere[cç]o|cep|local exato/iu.test(text)) {
      questions.push('Qual é o endereço da obra?');
    }
  } else {
    if (!/(operador|pessoa|algu[eé]m|ningu[eé]m|cesta (?:vazia|ocupada)|sem pessoas?)/iu.test(blob)
      && !/algu[eé]m.{0,30}(?:cesta|risco)|pessoa.{0,20}risco/iu.test(text)) {
      questions.push('Há alguém na cesta ou em risco?');
    }
    if (!RMBH_PLACE.test(blob) && !DISTANT_PLACE.test(blob)
      && !/\b(rua|avenida|av\.|endere[cç]o|cep)\b/iu.test(blob)
      && !/localiza[cç][aã]o|em qual cidade|onde est[aá]/iu.test(text)) {
      questions.push('Em qual cidade e local está o equipamento?');
    }
  }
  const available = Math.max(0, 2 - currentQuestionCount);
  const missing = questions.slice(0, available);
  return missing.length > 0 ? `${text}\n\n${missing.join(' ')}`.trim() : text;
}

function hasUsableStart(text: string, now: Date) {
  const when = classifyMentionedStart(text, now);
  if (when === 'past') {
    return false;
  }
  if (when === 'today' || when === 'future') {
    return true;
  }
  return mentionsRentalStart(text);
}

function stripRepeatedCommercialQuestions(text: string, userText: string, userTurns: string[], now: Date) {
  const blob = coverageQuestionBlob(userText, userTurns);
  const hasEquipment = Boolean(estimateFamily(blob));
  const hasDays = parseRentalDayCounts(blob).length > 0;
  const hasStart = hasUsableStart(blob, now);
  const hasCity = RMBH_PLACE.test(blob) || DISTANT_PLACE.test(blob);
  return text.split(/\n{2,}/u).flatMap((paragraph) => {
    const kept = paragraph.split(/(?<=[.!?])\s+|\n+/u).filter((sentence) => {
      if (!sentence.includes('?')) {
        return true;
      }
      if (hasEquipment && /qual (?:é |seria )?(?:o )?(?:equipamento|máquina)|que equipamento/iu.test(sentence)) {
        return false;
      }
      if (hasDays && /por quantos dias|loca[cç][aã]o (?:é|seria) por|prazo da loca[cç][aã]o/iu.test(sentence)) {
        return false;
      }
      if (hasStart && /para quando|data de in[ií]cio|quando come[cç]|a partir de|precisa mesmo/iu.test(sentence)) {
        return false;
      }
      if (hasEquipment && hasDays && hasStart && hasCity && /endere[cç]o.{0,30}obra/iu.test(sentence)) {
        return false;
      }
      return !hasCity || !/qual (?:é )?a cidade|em qual cidade|cidade da obra/iu.test(sentence);
    });
    const next = kept.join(' ').trim();
    return next ? [next] : [];
  }).join('\n\n');
}

function mentionsOperatorTraining(text: string) {
  const t = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  return /treinament/u.test(t)
    || /carteirinha de operador/u.test(t)
    || /certificado de operador/u.test(t);
}

function ensureClockGreeting(text: string, now: Date) {
  const greeting = formatAttendanceGreeting(now).replace(/!$/u, '');
  return text.replace(/^(bom dia|boa tarde|boa noite)\b/iu, greeting);
}

function hoursCloser(intent: AttendanceIntent = 'commercial') {
  if (intent === 'mechanical') {
    return 'A equipe de mecânica retorna no horário comercial, de segunda a sexta, 7h30–17h15.';
  }
  if (intent === 'logistics') {
    return 'A equipe de logística retorna no horário comercial, de segunda a sexta, 7h30–17h15.';
  }
  return HOURS_CLOSE;
}

const TEAM_RETURN =
  /(?:o comercial|a equipe de (?:mec[aâ]nica|log[ií]stica)) retorna/iu;

function ensureHoursClose(text: string, intent: AttendanceIntent = 'commercial') {
  const closer = hoursCloser(intent);
  const units = replyUnits(text)
    .filter((unit) => !/or[cç]ar com frete|confirmar endere[cç]o/iu.test(unit));
  const handoffs = units.filter((unit) => HOURS_UNIT.test(unit) || TEAM_RETURN.test(unit));
  const body = units
    .filter((unit) => !HOURS_UNIT.test(unit) && !TEAM_RETURN.test(unit))
    .join(' ')
    .replace(/\s{2,}/gu, ' ')
    .trim();
  const ending = handoffs.join(' ').trim();
  const hasHours = /7h30[–-]17h15/iu.test(ending);
  if (body && ending && hasHours) {
    return `${body}\n\n${ending}`;
  }
  if (body && ending) {
    return `${body}\n\n${ending}\n\n${closer}`;
  }
  if (!body && ending && hasHours) {
    return ending;
  }
  if (!body && ending) {
    return `${ending}\n\n${closer}`;
  }
  return body ? `${body}\n\n${closer}` : closer;
}

/** ASCII `\b` misses Portuguese words that end in á/é/ã (Ibirité, Sabará, amanhã). */
function letterBounded(inner: string) {
  return new RegExp(`(?<!\\p{L})(?:${inner})(?!\\p{L})`, 'iu');
}

const RMBH_PLACE = letterBounded(
  'belo horizonte|bh|contagem|betim|nova lima|ribeir[aã]o das neves|santa luzia|vespasiano|sabar[aá]|ibirité|ibirite|lagoa santa|sarzedo|brumadinho|rmbh|regi[aã]o metropolitana|grande bh',
);
const DISTANT_PLACE = letterBounded(
  's[aã]o paulo|sp|rio de janeiro|rj|curitiba|bras[ií]lia|salvador|recife|fortaleza|manaus|porto alegre|goi[aâ]nia|florian[oó]polis|campinas|santos|guarulhos|uberl[aâ]ndia|uberaba|juiz de fora|vit[oó]ria|sete lagoas|divin[oó]polis|itabira|ouro preto|montes claros|governador valadares|ipatinga|outro estado|outra cidade|fora da (regi[aã]o|rmbh)|interior de (mg|minas|s[aã]o paulo)|interior do estado',
);
const AFFIRMS_DISTANT_COVERAGE =
  /\bsim\b.{0,120}(trabalh|locam|atend|alug)|trabalhamos (com loca[cç]|para).{0,80}tamb[eé]m|atendemos.{0,40}tamb[eé]m|locamos para .{0,40}tamb[eé]m|(trabalhamos|locamos|atendemos) (com loca[cç]|para|em) .{0,40}(s[aã]o paulo|rio de janeiro|outro estado)/iu;

/**
 * True when the customer asked about renting outside the Belo Horizonte metro area.
 */
export function userAsksDistantCoverage(userText: string) {
  const trimmed = userText.trim();
  if (!trimmed) {
    return false;
  }
  if (RMBH_PLACE.test(trimmed) && !DISTANT_PLACE.test(trimmed)) {
    return false;
  }
  return DISTANT_PLACE.test(trimmed);
}

function replyConfirmsDistantCoverage(text: string) {
  return AFFIRMS_DISTANT_COVERAGE.test(text);
}

function replyHasDistantHandoff(text: string) {
  return /passar (os|estes) dados|sob consulta|comercial (avalia|verifica)|n[aã]o confirmo/iu.test(text);
}

function coverageQuestionBlob(userText: string, userTurns: string[] = []) {
  return [...userTurns, userText].filter(Boolean).join('\n');
}

function distantWaitCopy(userText: string, userTurns: string[] = []) {
  const blob = coverageQuestionBlob(userText, userTurns);
  const hasType = Boolean(estimateFamily(blob));
  const hasDays = parseRentalDayCounts(blob).length > 0;
  const hasStart = mentionsRentalStart(blob);
  if (hasType && hasDays && hasStart) {
    return 'A locação padrão é Belo Horizonte e a região metropolitana. Fora da RMBH não confirmo que dá para locar: depende do equipamento e de um período longo, em geral só plataforma ou guindaste tipo Franna, e só em contrato maior. Vou passar estes dados ao comercial para ver a viabilidade.';
  }
  if (hasType && hasDays) {
    return 'A locação padrão é Belo Horizonte e a região metropolitana. Fora da RMBH não confirmo que dá para locar: depende do equipamento e de um período longo, em geral só plataforma ou guindaste tipo Franna, e só em contrato maior. Vou passar os dados ao comercial para ver a viabilidade. Para quando você precisa?';
  }
  if (hasType) {
    return 'A locação padrão é Belo Horizonte e a região metropolitana. Fora da RMBH não confirmo que dá para locar: depende do equipamento e de um período longo, em geral só plataforma ou guindaste tipo Franna, e só em contrato maior. Vou passar os dados ao comercial para ver a viabilidade. Por quantos dias e para quando você precisa?';
  }
  return DISTANT_REGION_WAIT;
}

function ensureRentalStartAsk(text: string, userText: string, userTurns: string[] = [], now: Date = new Date()) {
  const blob = coverageQuestionBlob(userText, userTurns);
  if (attendanceIntent(blob) !== 'commercial' || isCatalogSpecAsk(blob)) {
    return text;
  }
  if (hasUsableStart(blob, now) || replyAsksRentalStart(text) || /já passou|digitação ou confusão/iu.test(text)) {
    return text;
  }
  if (!estimateFamily(blob) && !userAsksDistantCoverage(blob)) {
    return text;
  }
  if (/não locamos/iu.test(text) && !estimateFamily(blob)) {
    return text;
  }
  return `${text}\n\nPara quando você precisa?`.trim();
}

function ensureRentalCityAsk(text: string, userText: string, userTurns: string[] = []) {
  const blob = coverageQuestionBlob(userText, userTurns);
  if (attendanceIntent(blob) !== 'commercial' || isCatalogSpecAsk(blob)) {
    return text;
  }
  if (RMBH_PLACE.test(blob) || DISTANT_PLACE.test(blob) || !estimateFamily(blob)) {
    return text;
  }
  if (/não locamos/iu.test(text) || /cidade|endere[cç]o.{0,30}obra/iu.test(text)) {
    return text;
  }
  if ((text.match(/\?/gu)?.length ?? 0) >= 2) {
    return text;
  }
  return `${text}\n\nEm qual cidade é a obra?`.trim();
}

function repairDistantCoverage(text: string, userText: string, userTurns: string[] = []) {
  if (!userAsksDistantCoverage(coverageQuestionBlob(userText, userTurns))) {
    return text;
  }
  if (replyConfirmsDistantCoverage(text) || !replyHasDistantHandoff(text)) {
    return distantWaitCopy(userText, userTurns);
  }
  return text;
}

export type CapturedTriage = {
  userTexts: string[];
  equipment: string[];
  city: string | null;
  start: string | null;
  days: number[];
  notes: string[];
};

export type AttendanceTriageContext = {
  captured: CapturedTriage | null;
  priorCapture: CapturedTriage | null;
  newQuote: boolean;
  closed: boolean;
  userTurns: string[];
  now: Date;
  deskClock: string;
  previousAttendance: string | null;
  startWhen: ReturnType<typeof classifyMentionedStart>;
  introduce: boolean;
};

const CITY_VALUE = new RegExp(`${RMBH_PLACE.source}|${DISTANT_PLACE.source}`, 'iu');
const START_VALUE = new RegExp(
  `${letterBounded(
    'hoje|amanh[aã]|depois de amanh[aã]|esta semana|pr[oó]xima semana|fim de semana|(?:segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)(?:-feira)?',
  ).source}|\\b\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?\\b|\\bdia\\s+\\d{1,2}\\b`,
  'iu',
);
const DETAIL_VALUE = /\b\d+(?:[.,]\d+)?\s*(?:m|metros?|kg|toneladas?)\b/giu;
const CONTINUATION_HINT =
  /\b(tamb[eé]m|junto|al[eé]m d(?:isso|esse|essa)|mais um|mais uma|e mais|mesma obra|no mesmo|desse mesmo)\b/iu;
const NEW_QUOTE_HINT =
  /\b(gostaria de|queria|quero|preciso|vou precisar|fazer (?:uma|outra) loca[cç][aã]o|outro or[cç]amento|novo or[cç]amento|outra obra|outro servi[cç]o)\b/iu;
const RESUME_PRIOR_HINT =
  /\b(aquele|mesmo) (pedido|or[cç]amento|atendimento)|ainda (vale|est[aá]|quero|preciso)|sobre (?:o |a )?(?:de ontem|de anteontem|do outro dia|pedido anterior)|continuar (?:o |a )?(?:pedido|or[cç]amento)|retomar\b/iu;
const ATTENDANCE_SEALED =
  /sua mensagem está registrada|já está registrad|já está anotado|pedido já está|precisa de mais alguma coisa|está com a gente:/iu;

function turnOrigin(turn: AttendanceTurn): AttendanceTurnOrigin {
  return turn.origin ?? (turn.role === 'assistant' ? 'bot' : 'customer');
}

function isBotTurn(turn: AttendanceTurn) {
  return turnOrigin(turn) === 'bot';
}

function botSpokeToday(history: AttendanceTurn[], now: Date) {
  return history.some((turn) => isBotTurn(turn) && turn.at instanceof Date && sameSaoPauloDay(turn.at, now));
}

function shouldIntroduceAttendanceBot(history: AttendanceTurn[], now: Date) {
  return !history.some((turn) => {
    if (!isBotTurn(turn)) {
      return false;
    }
    if (!(turn.at instanceof Date) || Number.isNaN(turn.at.getTime())) {
      return true;
    }
    return sameSaoPauloDay(turn.at, now);
  });
}

/** Turns this bot wrote plus the customer answers that followed. URA and consultants stay out. */
function botTriageTurns(history: AttendanceTurn[]) {
  const firstBot = history.findIndex((turn) => isBotTurn(turn));
  if (firstBot < 0) {
    return [];
  }
  const start = includeLeadingCustomerTurns(history, firstBot);
  return history.slice(start).filter((turn) => {
    const origin = turnOrigin(turn);
    return origin === 'bot' || origin === 'customer';
  });
}

function botTriageTurnsToday(history: AttendanceTurn[], now: Date) {
  const todayStart = history.findIndex((turn) => (
    isBotTurn(turn) && turn.at instanceof Date && sameSaoPauloDay(turn.at, now)
  ));
  if (todayStart < 0) {
    return [];
  }
  const start = includeLeadingCustomerTurns(history, todayStart, now);
  return history.slice(start).filter((turn) => {
    const origin = turnOrigin(turn);
    return origin === 'bot' || origin === 'customer';
  });
}

function includeLeadingCustomerTurns(history: AttendanceTurn[], fromIndex: number, now?: Date) {
  let index = fromIndex;
  while (index > 0) {
    const previous = history[index - 1];
    if (!previous || previous.role !== 'user' || turnOrigin(previous) !== 'customer') {
      break;
    }
    if (now && previous.at instanceof Date && !sameSaoPauloDay(previous.at, now)) {
      break;
    }
    index -= 1;
  }
  return index;
}

function triageFromUserTexts(userTexts: string[]): CapturedTriage | null {
  const texts = userTexts.map((text) => text.trim()).filter(Boolean);
  if (texts.length === 0) {
    return null;
  }
  const blob = texts.join('\n');
  const equipment = [...new Set(texts.flatMap((text) => {
    const family = estimateFamily(text);
    return family ? [FAMILY_LABEL[family] ?? family] : [];
  }))];
  return {
    userTexts: texts,
    equipment,
    city: CITY_VALUE.exec(blob)?.[0] ?? null,
    start: START_VALUE.exec(blob)?.[0] ?? null,
    days: parseRentalDayCounts(blob),
    notes: [...new Set([...blob.matchAll(DETAIL_VALUE)].map((match) => match[0].trim()))],
  };
}

/** Commercial slots this bot itself collected in the live thread. */
export function capturedTriageFromHistory(history: AttendanceTurn[], now?: Date) {
  const turns = now ? botTriageTurnsToday(history, now) : botTriageTurns(history);
  return triageFromUserTexts(turns
    .filter((turn) => turn.role === 'user')
    .map((turn) => turn.text));
}

function lastSealedBotIndex(history: AttendanceTurn[], now?: Date) {
  const start = now
    ? history.findIndex((turn) => isBotTurn(turn) && turn.at instanceof Date && sameSaoPauloDay(turn.at, now))
    : history.findIndex((turn) => isBotTurn(turn));
  if (start < 0) {
    return -1;
  }
  let sealed = -1;
  for (let index = start; index < history.length; index += 1) {
    const turn = history[index];
    if (turn && isBotTurn(turn) && ATTENDANCE_SEALED.test(turn.text)) {
      sealed = index;
    }
  }
  return sealed;
}

function botSealedAttendance(history: AttendanceTurn[], now?: Date) {
  return lastSealedBotIndex(history, now) >= 0;
}

function sameCapturedFamily(captured: CapturedTriage, userText: string) {
  const family = estimateFamily(userText);
  if (!family) {
    return false;
  }
  const label = FAMILY_LABEL[family] ?? family;
  return captured.equipment.includes(label);
}

/** True when the customer opens another rental instead of completing the captured one. */
export function startsNewQuote(options: {
  captured: CapturedTriage | null;
  userText: string;
  closed?: boolean;
}) {
  const captured = options.captured;
  if (!captured) {
    return true;
  }
  if (CONTINUATION_HINT.test(options.userText) || RESUME_PRIOR_HINT.test(options.userText)) {
    return false;
  }
  if (isAttendanceGreeting(options.userText)) {
    return true;
  }
  if (options.closed) {
    return !sameCapturedFamily(captured, options.userText);
  }
  const family = estimateFamily(options.userText);
  if (!family) {
    return false;
  }
  const label = FAMILY_LABEL[family] ?? family;
  return !captured.equipment.includes(label) && NEW_QUOTE_HINT.test(options.userText);
}

/**
 * Splits the thread into what this bot captured and what belongs to a new quote, so a
 * consultant greeting or a URA menu is never read back as a request the bot already took.
 */
export function attendanceTriageContext(options: {
  history: AttendanceTurn[];
  userText: string;
  now?: Date;
}): AttendanceTriageContext {
  const now = options.now ?? new Date();
  const previousAttendance = previousAttendanceLabel(options.history, now);
  const spokeToday = botSpokeToday(options.history, now);
  const introduce = shouldIntroduceAttendanceBot(options.history, now);
  const staleDay = Boolean(previousAttendance) && !spokeToday;
  const resumePrior = RESUME_PRIOR_HINT.test(options.userText);
  const priorCapture = capturedTriageFromHistory(options.history);
  const closedToday = botSealedAttendance(options.history, now);
  if (staleDay && !resumePrior) {
    return {
      captured: null,
      priorCapture,
      newQuote: true,
      closed: true,
      userTurns: [options.userText],
      now,
      deskClock: formatAttendanceDeskClock(now),
      previousAttendance,
      startWhen: classifyMentionedStart(options.userText, now),
      introduce,
    };
  }
  const captured = spokeToday
    ? capturedTriageFromHistory(options.history, now)
    : priorCapture;
  const closed = closedToday || staleDay;
  const newQuote = startsNewQuote({ captured, userText: options.userText, closed });
  const active = newQuote ? null : captured;
  return {
    captured: active,
    priorCapture: newQuote ? captured : null,
    newQuote,
    closed,
    userTurns: [...(active?.userTexts ?? []), options.userText],
    now,
    deskClock: formatAttendanceDeskClock(now),
    previousAttendance,
    startWhen: classifyMentionedStart(options.userText, now),
    introduce,
  };
}

/**
 * Thread the model is allowed to see. A sealed attendance stays out unless the
 * customer clearly continues that same subject.
 */
export function historyForAttendanceModel(options: {
  history: AttendanceTurn[];
  context: AttendanceTriageContext;
}) {
  const history = options.history;
  const now = options.context.now;
  if (!options.context.newQuote) {
    return botSpokeToday(history, now)
      ? botTriageTurnsToday(history, now)
      : botTriageTurns(history);
  }
  const sealedAt = lastSealedBotIndex(history, now);
  if (sealedAt < 0) {
    return [];
  }
  return history.slice(sealedAt + 1).filter((turn) => {
    const origin = turnOrigin(turn);
    return origin === 'bot' || origin === 'customer';
  });
}

/** Prompt block that tells the model which facts are its own triage. */
export function formatCapturedTriageBlock(context: AttendanceTriageContext) {
  const header = 'Triagem que VOCÊ mesmo anotou nesta conversa. Cumprimento de atendente humano, menu automático e conversa antiga de consultor não contam como sua anotação.';
  const returning = context.previousAttendance
    ? [
      `Houve conversa com este número em ${context.previousAttendance}. Isso é só contexto.`,
      'NÃO assuma que aquele pedido ainda vale: o cliente pode já ter locado, desistido ou mudado. Comece um atendimento novo.',
      'Só retome o pedido anterior se o cliente pedir explicitamente (mesmo orçamento, ainda vale, aquele de ontem).',
    ].join(' ')
    : null;
  const pastStart = context.startWhen === 'past'
    ? 'A data de início que o cliente citou já passou. Não registre. Peça hoje, amanhã ou outro dia futuro — pode ser erro, digitação ou confusão.'
    : null;
  const intro = context.introduce
    ? `Esta é a sua primeira mensagem neste atendimento. Apresente-se como ${ATTENDANCE_BOT_NAME}, a IA da Acesso que faz o atendimento fora do horário comercial. Nas próximas mensagens, não se apresente de novo.`
    : isAttendanceIdentityAsk(context.userTurns.at(-1) ?? '')
      ? `O cliente perguntou quem você é. Diga que é a ${ATTENDANCE_BOT_NAME}, a IA da Acesso Equipamentos, e faz o atendimento fora do horário comercial. Depois continue o atendimento.`
      : `Você já se apresentou neste atendimento. Não se apresente de novo.`;
  const captured = context.captured;
  if (!captured) {
    return [
      header,
      intro,
      '- Nada anotado por você ainda neste atendimento de hoje.',
      ...(context.priorCapture || context.closed
        ? [
          'Houve um atendimento anterior nesta conversa que já foi encerrado. Não cite equipamento, cidade, prazo nem recape aquele pedido. Só retome se o cliente deixar claro que é o mesmo assunto (mesmo equipamento, aquele orçamento, ainda vale).',
        ]
        : []),
      ...(returning ? [returning] : []),
      ...(pastStart ? [pastStart] : []),
      'Se a mensagem atual for só cumprimento (oi, bom dia, boa tarde, boa noite), cumprimente e pergunte como pode ajudar. Pode ser locação, devolução, troca, mecânica, financeiro ou outra dúvida — não assuma equipamento.',
      'Se o cliente já pediu um serviço, trate como atendimento novo: peça só o que faltar (tipo, cidade, início, dias). Não recapte o pedido antigo como se ainda estivesse aberto.',
    ].join('\n');
  }
  return [
    header,
    intro,
    `- Equipamento: ${captured.equipment.join(', ') || 'ainda não informado'}`,
    `- Cidade: ${captured.city ?? 'ainda não informada'}`,
    `- Início: ${captured.start ?? 'ainda não informado'}`,
    `- Duração: ${captured.days.length > 0 ? `${Math.max(...captured.days)} dias` : 'ainda não informada'}`,
    ...(captured.notes.length > 0 ? [`- Detalhes: ${captured.notes.join(', ')}`] : []),
    ...(pastStart ? [pastStart] : []),
    'Este atendimento de hoje continua: junte o que o cliente acabou de dizer, pergunte só o que falta e, se já tiver tipo, cidade, início e duração, diga que está registrado e que o comercial retorna.',
  ].join('\n');
}

const HOURS_UNIT =
  /(?:o comercial|a equipe de (?:mec[aâ]nica|log[ií]stica)) retorna.{0,120}(?:7h30|hor[áa]rio)|7h30[–-]17h15/iu;
const EMPTY_HELP_OFFER =
  /^(?:e\s+)?(?:como|em que|no que|o que mais)\s+(?:eu\s+)?(?:posso|podemos)\s+(?:te |lhe |o |a )?ajud/iu;
const OPENING_ASK = 'Como posso ajudar?';
const GREETING_WORDS = new Set([
  'ola', 'oi', 'bom', 'dia', 'boa', 'tarde', 'noite', 'tudo', 'bem', 'certo',
  'opa', 'e', 'ai', 'beleza', 'eai',
]);

function isAttendanceGreeting(text: string) {
  const t = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[!,.?…]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!t) {
    return false;
  }
  return t.split(' ').every((token) => GREETING_WORDS.has(token) || /^oi+$/u.test(token));
}
const RENTAL_ASK = /\b(?:alug\p{L}*|loca[cç]\p{L}*|or[cç]amento)/iu;

function replyUnits(text: string) {
  return text
    .split(/\n+|(?<=[.!?])\s+/u)
    .map((unit) => unit.trim())
    .filter(Boolean);
}

function stripEmptyHelpOffer(text: string, captured: CapturedTriage | null, userText = '') {
  if (!captured || isAttendanceGreeting(userText)) {
    return text;
  }
  const next = text.split(/\n{2,}/u).flatMap((paragraph) => {
    const kept = replyUnits(paragraph).filter((unit) => !EMPTY_HELP_OFFER.test(unit));
    const joined = kept.join(' ').trim();
    return joined ? [joined] : [];
  }).join('\n\n').trim();
  return next || text;
}

const STALE_ORDER_CLAIM =
  /já está registrad|já está anotado|pedido já está|sua mensagem está registrada|seu pedido já|pedido está com a gente|está com a gente:/iu;

function stripStaleOrderRecap(text: string, options: {
  captured: CapturedTriage | null;
  userText: string;
  now: Date;
}) {
  if (isAttendanceGreeting(options.userText)) {
    return `${formatAttendanceGreeting(options.now)}\n\n${OPENING_ASK}`;
  }
  if (options.captured) {
    return text;
  }
  if (!STALE_ORDER_CLAIM.test(text) && !/começando .{0,60} em /iu.test(text)) {
    return text;
  }
  const kept = text.split(/\n{2,}/u).flatMap((paragraph) => {
    const next = replyUnits(paragraph).filter((unit) => !STALE_ORDER_CLAIM.test(unit)).join(' ').trim();
    return next ? [next] : [];
  }).join('\n\n').trim();
  return kept || text;
}

function ensureRegisteredClose(text: string, options: {
  captured: CapturedTriage | null;
  userText: string;
  intent: AttendanceIntent;
  now: Date;
}) {
  if (!options.captured || options.intent !== 'commercial' || isAttendanceGreeting(options.userText)) {
    return text;
  }
  const merged = triageFromUserTexts([...options.captured.userTexts, options.userText]);
  if (!merged || merged.equipment.length === 0 || !merged.city || !merged.start || merged.days.length === 0) {
    return text;
  }
  const mergedTexts = [...options.captured.userTexts, options.userText].join('\n');
  if (classifyMentionedStart(options.userText, options.now) === 'past'
    || classifyMentionedStart(mergedTexts, options.now) === 'past') {
    return text;
  }
  if (/está registrad|sua mensagem está/iu.test(text)) {
    return text;
  }
  const detail = merged.notes.length > 0 ? ` (${merged.notes.join(', ')})` : '';
  const startLabel = formatConfirmedStart(mergedTexts, options.now) ?? merged.start;
  const register = `Sua mensagem está registrada: ${merged.equipment.join(' e ')}${detail}, ${Math.max(...merged.days)} dias, a partir de ${startLabel}, em ${merged.city}.`;
  return `${text}\n\n${register}`.trim();
}

const ANYTHING_ELSE_ASK =
  /precisa de mais alguma coisa|mais alguma coisa\?|algo mais\?/iu;

function triageIsComplete(userText: string, userTurns: string[], captured: CapturedTriage | null) {
  const texts = [...(captured?.userTexts ?? userTurns), userText];
  const merged = triageFromUserTexts(texts);
  return Boolean(merged
    && merged.equipment.length > 0
    && merged.city
    && merged.start
    && merged.days.length > 0);
}

const CALENDAR_MONTHS =
  'janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro';

function calendarDatePattern(flags: string) {
  return new RegExp(
    `\\b\\d{1,2}\\s+de (?:${CALENDAR_MONTHS})(?:\\s+de\\s+\\d{4})?\\b`,
    flags,
  );
}

function replaceWrongCalendarDates(text: string, datePart: string) {
  const expected = datePart.toLowerCase();
  return text.replace(calendarDatePattern('giu'), (written) => (
    expected.includes(written.toLowerCase()) ? written : datePart
  ));
}

function ensureConfirmedStartDate(text: string, userText: string, userTurns: string[], now: Date) {
  const blob = coverageQuestionBlob(userText, userTurns);
  const label = formatConfirmedStart(blob, now);
  if (!label) {
    return text;
  }
  const datePart = label.replace(/^[^,]+,\s*/u, '');
  if (calendarDatePattern('iu').test(text)) {
    return replaceWrongCalendarDates(text, datePart);
  }
  const weekday = label.split(',')[0]?.trim();
  if (!weekday) {
    return text;
  }
  const weekdayRe = new RegExp(`${weekday.replace(/-/gu, '[-]?')}(?: que vem)?`, 'iu');
  if (weekdayRe.test(text)) {
    return text.replace(weekdayRe, label);
  }
  return text;
}

function ensureAnythingElseAsk(text: string, options: {
  userText: string;
  userTurns: string[];
  captured: CapturedTriage | null;
  intent: AttendanceIntent;
}) {
  if (options.intent !== 'commercial' || isAttendanceGreeting(options.userText)) {
    return text;
  }
  if (!triageIsComplete(options.userText, options.userTurns, options.captured)) {
    return text;
  }
  if (ANYTHING_ELSE_ASK.test(text)) {
    return text;
  }
  return `${text}\n\nPrecisa de mais alguma coisa?`.trim();
}

const PAST_START_ASK =
  'Não dá para começar em uma data que já passou. Foi digitação ou confusão? Você precisa para hoje, amanhã ou outro dia?';

function ensureImpossibleStartAsk(text: string, options: {
  userText: string;
  userTurns: string[];
  now: Date;
  intent: AttendanceIntent;
}) {
  if (options.intent !== 'commercial') {
    return text;
  }
  const blob = coverageQuestionBlob(options.userText, options.userTurns);
  if (classifyMentionedStart(options.userText, options.now) !== 'past'
    && classifyMentionedStart(blob, options.now) !== 'past') {
    return text;
  }
  if (/já passou|digitação ou confusão|não dá para começar/iu.test(text)) {
    return text;
  }
  return `${text}\n\n${PAST_START_ASK}`.trim();
}

function ensureEquipmentAsk(text: string, options: {
  captured: CapturedTriage | null;
  userText: string;
  userTurns: string[];
  intent: AttendanceIntent;
}) {
  if (options.captured || options.intent !== 'commercial') {
    return text;
  }
  const userText = options.userText.trim();
  if (!userText || isAttendanceGreeting(userText) || !RENTAL_ASK.test(userText)) {
    return text;
  }
  if (estimateFamily(coverageQuestionBlob(userText, options.userTurns))) {
    return text;
  }
  if (/não locamos/iu.test(text) || /equipamento|m[aá]quina/iu.test(text)) {
    return text;
  }
  return `${text}\n\nQual equipamento você precisa?`.trim();
}

type SanitizeAttendanceOptions = {
  retrievedKnowledge?: string | null;
  userText?: string;
  userTurns?: string[];
  captured?: CapturedTriage | null;
  now?: Date;
  introduce?: boolean;
};

/**
 * Replaces an unsafe model draft with the commercial fallback.
 */
export function sanitizeAttendanceReply(
  text: string,
  options?: SanitizeAttendanceOptions,
) {
  const userText = options?.userText ?? '';
  const userTurns = options?.userTurns ?? [];
  const now = options?.now ?? new Date();
  const intent = attendanceIntent(coverageQuestionBlob(userText, userTurns));
  const trimmed = stripAgentSignatures(text);
  const cleaned = dropPushyUnits(trimmed);
  let base = cleaned;
  if (!trimmed) {
    base = SANDBOX_SAFE_FALLBACK;
  } else if (!cleaned) {
    base = attendanceReplyLooksUnsafe(trimmed, options) ? SANDBOX_SAFE_FALLBACK : OFF_HOURS_WAIT;
  } else if (attendanceReplyLooksUnsafe(cleaned, options)) {
    base = SANDBOX_SAFE_FALLBACK;
  }
  const repaired = stripInventedPemtGloss(stripMisreadCollectionTruck(stripOffCatalogSubstitutes(
    enforceExplicitCatalogMisses(repairOffCatalog(
      stripUnrequestedAndaimeType(
        stripWrongFamilyPrefix(
          nameAskedFamily(
            stripPixKeyTalk(stripPfPjAsk(stripCnpjAsk(repairCatalogDenial(base, options?.retrievedKnowledge, userText, userTurns)))),
            options?.retrievedKnowledge,
            userText,
            userTurns,
          ),
          userText,
        ),
        userText,
        userTurns,
      ),
      options,
    ), options?.retrievedKnowledge, userText),
    userText,
  ), userText));
  const withoutContact = stripUnrequestedContact(repaired, userText);
  const next = dropBrokenAsks(stripOffHoursCallNow(withoutContact)) || OFF_HOURS_WAIT;
  const scoped = repairDistantCoverage(next, userText, userTurns);
  const withoutRepeatedQuestions = intent === 'commercial'
    ? stripRepeatedCommercialQuestions(scoped, userText, userTurns, now)
    : scoped;
  const departmentScoped = stripWrongDepartmentQuestions(
    withoutRepeatedQuestions,
    intent,
    coverageQuestionBlob(userText, userTurns),
  );
  const withDepartmentTriage = ensureDepartmentTriage(departmentScoped, intent, userText, userTurns);
  const routed = stripInventedMechanicalAdvice(
    stripRentalTriageOnSpecAsk(routeDepartmentText(withDepartmentTriage, intent), userText),
    intent,
  );
  const captured = options?.captured ?? null;
  const registered = ensureRegisteredClose(
    stripEmptyHelpOffer(stripStaleOrderRecap(routed, { captured, userText, now }), captured, userText),
    { captured, userText, intent, now },
  );
  const withCityAsk = ensureRentalCityAsk(registered, userText, userTurns);
  const withStartAsk = ensureRentalStartAsk(withCityAsk, userText, userTurns, now);
  const withPastStartAsk = ensureImpossibleStartAsk(withStartAsk, {
    userText,
    userTurns,
    now,
    intent,
  });
  const withEquipmentAsk = ensureEquipmentAsk(withPastStartAsk, {
    captured,
    userText,
    userTurns,
    intent,
  });
  const withSpecFact = ensureFreightProcessOnDeliveryAsk(
    ensureCatalogHeightAnswer(
      withEquipmentAsk,
      userText,
      options?.retrievedKnowledge,
    ),
    userText,
  );
  const withDates = ensureConfirmedStartDate(withSpecFact, userText, userTurns, now);
  const withAnythingElse = ensureAnythingElseAsk(withDates, {
    userText,
    userTurns,
    captured,
    intent,
  });
  return ensureAttendanceIdentity(
    ensureHoursClose(ensureClockGreeting(withAnythingElse, now), intent),
    { introduce: options?.introduce ?? false, now, userText },
  );
}

type ClaudeResponse = {
  content?: Array<{ type: string; text?: string }>;
  error?: { message?: string };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
};

export type AttendanceSystemBlock = {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
};

const ATTENDANCE_ROLE_SANDBOX = [
  `Você é ${ATTENDANCE_BOT_NAME}, a IA da Acesso Equipamentos (locação, MG), em SANDBOX.`,
  'O usuário está testando você. Nenhum WhatsApp é enviado.',
  `Não escreva "${ATTENDANCE_BOT_NAME}:" no texto — o sistema prefixa cada mensagem.`,
];

const ATTENDANCE_ROLE_LIVE = [
  `Você é ${ATTENDANCE_BOT_NAME}, a IA da Acesso Equipamentos (locação, MG), no WhatsApp real, fora do expediente.`,
  'O cliente recebe esta mensagem. Não diga que está em teste, sandbox ou que o WhatsApp não é enviado.',
  `Você não é a Bianca, o Pedro nem a Renata. Nunca escreva assinatura de atendente como \`*Nome *\`. Não escreva "${ATTENDANCE_BOT_NAME}:" — o sistema prefixa.`,
];

const ATTENDANCE_STATIC_RULES = [
  'Horário: fora do expediente. Resposta curta (no máximo 4 frases e 2 perguntas), cordial, em português do Brasil.',
  'Leia a última mensagem no contexto da conversa e responda a ela. Não use um parágrafo pronto. Se já explicou algo, não copie a mesma resposta: avance ou anote o pedido.',
  'Toda resposta termina deixando claro que o comercial (ou a equipe responsável) retorna no horário útil, segunda a sexta, 7h30–17h15, para finalizar o atendimento — orçamento, agendamento, treinamento ou dúvida. Escreva essa conclusão com as suas palavras. Não confirme vaga, reserva nem proposta.',
  HARD_RULE_NEVER_PRICE,
  HARD_RULE_NEVER_FREIGHT,
  HARD_RULE_NEVER_AVAILABILITY,
  HARD_RULE_NEVER_CLOSE,
  HARD_RULE_MISSING_DATA,
  HARD_RULE_DISTANT_REGION,
  'Área padrão: Belo Horizonte e a RMBH. Fora da RMBH (São Paulo ou qualquer lugar mais distante) não diga que locamos lá nem que é viável. Em geral só contrato maior, período longo, plataforma ou guindaste tipo Franna — e só o comercial confirma a viabilidade. Diga que vai passar os dados ao comercial. Peça equipamento, quantos dias e para quando começa. Nunca confirme disponibilidade de frota.',
  'Se houver Notas humanas no playbook, elas vencem o restante das notas geradas.',
  'Se houver Aprendizado da triagem, siga “o que repetir” e não repita “o que não repetir” nem as falhas da sandbox. Isso não vence Notas humanas nem as regras de código.',
  'Sem emoji. Sem “é só chamar”, “fico aqui”, “qualquer dúvida”, “acelera”. Isso parece plantão 24h.',
  'Não invente CNPJ, Pix nem prazo de entrega da máquina. Nunca pergunte CNPJ nem se é PF ou PJ — o comercial pede documento. Não pergunte “é pessoa física ou empresa”.',
  'Se um módulo recuperado descrever como a equipe resolve esse caso, siga esse jeito (sem preço, sem estoque).',
  'Não invente diagnóstico, peça, código de falha nem procedimento de manual que não esteja nas notas recuperadas.',
  'Se o cliente só cumprimentou (oi, bom dia, boa tarde, boa noite), responda em 1–2 frases e pergunte como pode ajudar. Não assuma locação, equipamento, devolução, mecânica nem financeiro.',
  `Se perguntarem quem você é, diga que é a ${ATTENDANCE_BOT_NAME}, a IA da Acesso Equipamentos, e faz o atendimento fora do horário comercial. Depois continue o que faltava. Não responda só com a função sem se apresentar.`,
  'Só cite tipos que aparecem no catálogo recuperado. GS, SJ III, HB e PEP são plataforma tesoura. Sempre use a palavra tesoura — não responda só com o modelo. Não diga que não locamos tesoura se o bloco listar tesoura. Não troque tesoura por articulada. Não diga que o equipamento está disponível nem “temos a” um modelo específico.',
  'Não invente alumínio, tubular, fachadeiro ou “outras soluções”. Fora do catálogo, diga “não locamos” + o tipo pedido. Não ofereça tesoura, andaime nem outra linha no lugar.',
  'Pedido de preço/diária/desconto: nunca passe valor ou estimativa, mesmo que apareça em conversa antiga ou nota recuperada. O comercial confirma no horário útil.',
  'Frete: explique só o processo (orça conforme cidade, acesso e equipamento). Nunca cite valor, prazo de chegada nem “sai hoje”.',
  'Como funciona a locação: triagem (tipo, cidade, para quando começa e por quantos dias) e o comercial orça no horário. Não feche proposta.',
  'Se já tem tipo, cidade, para quando começa e período: anote, confirme a data do calendário, pergunte se precisa de mais alguma coisa e diga que o comercial retorna no horário útil para finalizar.',
  'Se faltar o início, pergunte “para quando você precisa?” (hoje, amanhã, esta semana, data). Se faltar duração, pergunte por quantos dias. Se faltar a cidade da obra, pergunte a cidade. No máximo 2 perguntas por turno.',
  'Só diga que está anotado quando já tiver tipo, cidade, início e duração. Se ainda faltar cidade ou início, não responda só “Perfeito!” com o horário do comercial: faça a pergunta que falta.',
  'Um pedido só está anotado se aparecer no bloco “Triagem que VOCÊ mesmo anotou”. Cumprimento de atendente humano, menu automático da ChatPro e conversa antiga de consultor não são sua anotação: nesse caso comece um orçamento novo pela mensagem atual.',
  'Reatendimento: só no mesmo dia, se o bloco da triagem tiver dados coletados hoje e o atendimento ainda não tiver sido encerrado. Junte o detalhe novo, pergunte só o que falta e, com tipo, cidade, início e duração, diga que está registrado e que o comercial retorna.',
  'Se o atendimento já foi encerrado (mensagem registrada ou “precisa de mais alguma coisa”), não reabra. Trate a mensagem atual como assunto novo. Só volte ao pedido anterior se o cliente citar o mesmo equipamento ou pedir para continuar aquele atendimento.',
  'Nunca responda só “Trabalhamos com plataformas.” com o horário. Isso não é resposta: ou pergunte o que falta, ou repita o resumo do pedido registrado hoje.',
  'Altura e metragem são detalhes opcionais: registre o que o cliente disser e não deduza modelo, tipo específico nem estoque a partir da altura.',
  'Se o cliente só cumprimentar, comece atendimento novo: cumprimente pelo relógio e pergunte como pode ajudar. Não pergunte o equipamento ainda. Não recapte pedido antigo, mesmo que a conversa de outro dia esteja no histórico.',
  'Use o relógio da mesa. “Hoje”, “amanhã”, “semana que vem” e “quarta-feira dessa semana” são relativos a essa data. Quando o cliente disser um dia relativo, confirme a data do calendário (ex.: terça-feira, 15 de setembro de 2026). Ninguém agenda locação para ontem nem para um dia que já passou: se disserem isso, é erro, digitação ou confusão — explique e peça uma data de hoje em diante.',
  'Se o cliente pediu só andaime, não escolha o tipo (tubo e braçadeira, painel, fachadeiro). Diga andaime. Só nomeie o tipo se o cliente pediu esse tipo ou perguntou quais tipos vocês têm.',
  'Pedido de outro dia é só contexto. O cliente pode já ter locado, desistido ou mudado. Não induza o atendimento com aquele histórico. Só retome se ele pedir explicitamente.',
  'Você não é a Bianca, o Pedro nem a Renata, e não assina a mensagem. Nunca escreva `*Nome *` nem copie assinatura de atendente do histórico.',
  'Não diga “temos solução” nem que a proposta virá com valores, frete ou cronograma.',
  'Nunca feche proposta, reserva ou contrato. Se ainda faltar só nome/endereço da obra (PF), pode pedir isso. Depois, só esperar o expediente.',
  'Pode informar site e endereço da sede. Telefone e WhatsApp só se pedirem, e sempre como contato do horário comercial — nunca “liga agora” nem “agilize”.',
  'Fora do expediente o telefone não é atendido. Peça para esperar o comercial.',
  'Follow-up curto só para o lead esperar o horário. Não reabra orçamento nem convide a mandar mais dúvida “a qualquer hora”.',
  'Separe a intenção antes de responder. Comercial coleta tipo, cidade, início e duração. Logística coleta equipamento, motivo de troca/devolução/retirada, endereço e data solicitada. Mecânica coleta linha/modelo, sintoma, localização e se há pessoa em risco.',
  'Dúvidas gerais sobre empresa, documentos, caução, multa ou seguro não iniciam triagem de locação. Responda apenas com o que estiver nas Notas humanas e, se faltar algo, diga que o comercial confirma no horário útil.',
  'Treinamento PEMT (fatos, não um texto para copiar): PEMT é plataforma elevatória móvel de trabalho. Não invente outra expansão da sigla. Oferecemos; com locação entra junto; só o curso o comercial confirma a disponibilidade no horário útil; certificado e carteirinha de operador. Sem preço e sem confirmar vaga. Responda à pergunta atual. Se o cliente já souber que oferecemos e quiser agendar, avance: anote o interesse e peça o que faltar (data, pessoas, locação junto ou só o curso). Quando os dados do curso estiverem completos, anote e deixe claro que o comercial retorna para finalizar o agendamento.',
  'As Notas humanas informam que pessoa física pode locar. Se perguntarem, pode dizer isso sem pedir CNPJ nem listar documentos; a política documental fica com o comercial.',
  'Nunca pergunte início ou duração da locação em logística ou mecânica. Encaminhe logística para a equipe de logística e defeito/máquina parada para a equipe de mecânica, sempre no horário comercial.',
  'Não prometa retorno, coleta, troca, visita ou entrega em minutos, horas ou quantidade de dias. Apenas diga que a equipe responsável retorna no horário comercial, segunda a sexta, 7h30–17h15.',
  'Em emergência mecânica, não forneça telefone sem o cliente pedir. Não ensine jumper, bypass, ligação de fios ou diagnóstico. Oriente interromper o uso, manter distância e acionar o responsável de segurança da obra; a mecânica humana decide qualquer procedimento ou visita.',
  'Pergunta de ficha (altura, carga, andar com a cesta): responda só o que estiver nas notas recuperadas. Não abra triagem de locação. Caminhão de coleta ou devolução não é locação de caminhão.',
].join('\n');

/**
 * System blocks for the attendance bot. Cache breakpoint stays on rules + playbook.
 */
export function buildAttendanceSystemBlocks(options: {
  vaultKnowledge: string;
  retrievedKnowledge?: string | null;
  contactContext?: string | null;
  capturedTriage?: string | null;
  deskClock?: string | null;
  live?: boolean;
}): AttendanceSystemBlock[] {
  const playbook = options.vaultKnowledge.trim()
    ? `Playbook:\n${options.vaultKnowledge}`
    : 'Playbook ainda vazio.';
  const retrieved = options.retrievedKnowledge?.trim()
    ? `Notas recuperadas (catálogo por busca, mecânica/manuais). Cite só o que estiver aqui:\n${options.retrievedKnowledge}`
    : 'Sem nota recuperada desta pergunta.';
  const contact = options.contactContext?.trim()
    ? `Nota deste contato (só porque ele voltou ou está em follow-up). Não invente o que não estiver aqui:\n${options.contactContext.slice(0, 4000)}`
    : 'Sem nota deste contato nesta conversa.';
  const captured = options.capturedTriage?.trim()
    || 'Triagem que VOCÊ mesmo anotou nesta conversa: nada anotado por você ainda. Trate como orçamento novo a partir da mensagem atual.';
  const desk = options.deskClock?.trim() || formatAttendanceDeskClock(new Date());
  const role = (options.live ? ATTENDANCE_ROLE_LIVE : ATTENDANCE_ROLE_SANDBOX).join('\n');

  return [
    {
      type: 'text',
      text: `${role}\n${ATTENDANCE_STATIC_RULES}\n${playbook}`,
      cache_control: { type: 'ephemeral' },
    },
    { type: 'text', text: retrieved },
    { type: 'text', text: contact },
    { type: 'text', text: desk },
    { type: 'text', text: captured },
  ];
}

function logPromptCacheUsage(usage: ClaudeResponse['usage']) {
  const debug = process.env.PLAYBOOK_DEBUG?.trim().toLowerCase();
  if (debug !== 'true' && debug !== '1') {
    return;
  }
  const cacheWrite = usage?.cache_creation_input_tokens ?? 0;
  const cacheRead = usage?.cache_read_input_tokens ?? 0;
  console.log('[attendance] prompt-cache', {
    input: usage?.input_tokens ?? 0,
    cacheWrite,
    cacheRead,
    hit: cacheRead > 0,
  });
}

/**
 * Replies as the after-hours commercial bot. Never sends WhatsApp.
 */
export async function replyAsAttendanceBot(options: {
  apiKey: string;
  model: string;
  vaultKnowledge: string;
  retrievedKnowledge?: string | null;
  contactContext?: string | null;
  history: AttendanceTurn[];
  userText: string;
  offHours: boolean;
  live?: boolean;
  triageContext?: AttendanceTriageContext;
  now?: Date;
}) {
  if (!options.offHours) {
    return {
      text: 'No expediente o comercial atende. O bot de fora do horário ficaria mudo agora.',
      escalate: false,
    };
  }

  const triageContext = options.triageContext
    ?? attendanceTriageContext({
      history: options.history,
      userText: options.userText,
      now: options.now,
    });
  const userTurns = triageContext.userTurns;
  const now = triageContext.now;
  const recommendation = mentionsOperatorTraining(userTurns.join('\n'))
    ? null
    : recommendFleetEquipment({ query: userTurns.join('\n') });
  if (recommendation) {
    const triage: string[] = [];
    const blob = userTurns.join('\n');
    if (!RMBH_PLACE.test(blob) && !DISTANT_PLACE.test(blob)) {
      triage.push('cidade');
    }
    if (!hasUsableStart(blob, now)) {
      triage.push('para quando precisa');
    }
    if (parseRentalDayCounts(blob).length === 0) {
      triage.push('por quantos dias');
    }
    const triageText = triage.length > 0
      ? `Para registrar a triagem, informe ${triage.join(', ').replace(/, ([^,]*)$/u, ' e $1')}.`
      : '';
    return {
      text: sanitizeAttendanceReply(
        [formatFleetRecommendation(recommendation), triageText].filter(Boolean).join('\n\n'),
        {
          userText: options.userText,
          userTurns,
          now,
          introduce: triageContext.introduce,
        },
      ),
      escalate: true,
    };
  }

  const system = buildAttendanceSystemBlocks({
    vaultKnowledge: options.vaultKnowledge,
    retrievedKnowledge: options.retrievedKnowledge,
    contactContext: options.contactContext,
    capturedTriage: formatCapturedTriageBlock(triageContext),
    deskClock: triageContext.deskClock,
    live: options.live,
  });
  const messages = [
    ...historyForAttendanceModel({ history: options.history, context: triageContext }).map((turn) => ({
      role: turn.role,
      content: turn.text,
    })),
    { role: 'user' as const, content: options.userText },
  ];

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'x-api-key': options.apiKey,
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: 220,
      system,
      messages,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const payload = (await response.json()) as ClaudeResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message || 'anthropic_request_failed');
  }
  logPromptCacheUsage(payload.usage);
  const draft = payload.content?.find((block) => block.type === 'text')?.text ?? '';
  const text = sanitizeAttendanceReply(draft, {
    retrievedKnowledge: options.retrievedKnowledge,
    userText: options.userText,
    userTurns,
    captured: triageContext.captured,
    now,
    introduce: triageContext.introduce,
  });
  return {
    text,
    escalate: /comercial|próximo dia útil|pessoa/iu.test(text),
  };
}
