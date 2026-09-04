import { phoneMatchKey } from './lead-contact';
import type { ChatProRoiEvaluation } from '../validations/chatpro-roi';

type RoiHandoffMessage = {
  fromMe: boolean;
  messageText: string | null;
};

const HANDOFF_INTENT =
  /\b(?:desvi(?:ei|ou|ar|ado)?|encaminh(?:ei|ou|ar|ado)|transfere[ri]?|chama(?:r)?\s+(?:no|nesse|neste)|me\s+chama|fala(?:r)?\s+(?:comigo|com o|no)|wa\.me|outro\s+(?:whats|zap|numero|telefone)|numero\s+(?:do\s+)?(?:comercial|whats|zap|vendedor)|continua(?:r)?\s+(?:no|nesse|neste)|passa(?:r)?\s+(?:pro|para o|no)\s+comercial)\b/u;

const CUSTOMER_STAYED_ON_CHAT =
  /\b(?:orcamento|proposta|diaria|plataforma|tesoura|andaime|quantos dias|cidade|obra|frete|contrato)\b/u;

const CUSTOMER_ACK =
  /^(?:ok|ola|oi|obrigad\w*|beleza|vou chamar|ja vou|certo|combinado|perfeito|show|valeu|ja chamo)[\s!.]*$/u;

function normalizeCommercialText(value: string) {
  return value
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replaceAll(/\s+/gu, ' ')
    .trim();
}

/**
 * Formats a Brazilian mobile/landline for ROI labels.
 */
export function formatDivertedPhoneDisplay(phone: string | null | undefined) {
  const key = phoneMatchKey(phone);
  if (!key) {
    return null;
  }
  if (key.length === 11) {
    return `(${key.slice(0, 2)}) ${key.slice(2, 7)}-${key.slice(7)}`;
  }
  if (key.length === 10) {
    return `(${key.slice(0, 2)}) ${key.slice(2, 6)}-${key.slice(6)}`;
  }
  return null;
}

function phonesInText(text: string) {
  const found = new Set<string>();
  for (const match of text.matchAll(/(?:https?:\/\/)?wa\.me\/(\d{10,15})|\+?\d[\d\s().-]{9,18}\d/giu)) {
    const raw = match[1] ?? match[0];
    const formatted = formatDivertedPhoneDisplay(raw);
    if (formatted) {
      found.add(formatted);
    }
  }
  return [...found];
}

/**
 * Picks the commercial handoff number in a seller message, if the text is a divert.
 */
export function extractCommercialHandoffPhone(text: string) {
  const normalized = normalizeCommercialText(text);
  const phones = phonesInText(text);
  if (phones.length === 0) {
    return null;
  }
  if (!HANDOFF_INTENT.test(normalized) && !/wa\.me/i.test(text)) {
    return null;
  }
  return phones[0] ?? null;
}

function latestSellerHandoff(messages: RoiHandoffMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message?.fromMe || !message.messageText?.trim()) {
      continue;
    }
    const phone = extractCommercialHandoffPhone(message.messageText);
    if (phone) {
      return { index, phone };
    }
  }
  return null;
}

function customerStayedOnThisChat(messages: RoiHandoffMessage[], afterIndex: number) {
  return messages.slice(afterIndex + 1).some((message) => {
    if (message.fromMe || !message.messageText?.trim()) {
      return false;
    }
    const customerText = normalizeCommercialText(message.messageText);
    if (!customerText || CUSTOMER_ACK.test(customerText)) {
      return false;
    }
    return CUSTOMER_STAYED_ON_CHAT.test(customerText) || customerText.length > 40;
  });
}

/**
 * Stage label for the ROI table: "Desviado" or "Desviado (31 99470-0201)".
 */
export function formatRoiStageLabel(options: {
  stage: ChatProRoiEvaluation['stage'];
  divertedToPhone?: string | null;
  stageLabels: Record<ChatProRoiEvaluation['stage'], string>;
  divertedWithPhone: (phone: string) => string;
}) {
  if (options.stage === 'diverted' && options.divertedToPhone?.trim()) {
    return options.divertedWithPhone(options.divertedToPhone.trim());
  }
  return options.stageLabels[options.stage];
}

/**
 * Marks the journey as handed off to another commercial WhatsApp/phone.
 * Does not override ganho or perdido.
 */
export function applyCommercialHandoffGuardrail(
  evaluation: ChatProRoiEvaluation,
  messages: RoiHandoffMessage[],
): ChatProRoiEvaluation {
  const formattedFromModel = formatDivertedPhoneDisplay(evaluation.divertedToPhone);
  const handoff = latestSellerHandoff(messages);

  if (evaluation.stage === 'closed_won' || evaluation.stage === 'closed_lost') {
    return {
      ...evaluation,
      divertedToPhone: formattedFromModel ?? evaluation.divertedToPhone,
    };
  }

  if (handoff && customerStayedOnThisChat(messages, handoff.index)) {
    return {
      ...evaluation,
      divertedToPhone: formattedFromModel ?? evaluation.divertedToPhone,
    };
  }

  const phone = formattedFromModel ?? handoff?.phone ?? null;
  const shouldMark = evaluation.stage === 'diverted' || Boolean(handoff);
  if (!shouldMark) {
    return {
      ...evaluation,
      divertedToPhone: phone,
    };
  }

  const suggestedStatus: ChatProRoiEvaluation['suggestedStatus'] =
    evaluation.suggestedStatus === 'won' || evaluation.suggestedStatus === 'lost'
      ? evaluation.suggestedStatus
      : 'contacted';

  return {
    ...evaluation,
    stage: 'diverted',
    divertedToPhone: phone,
    suggestedStatus,
    followUpPriority: evaluation.followUpPriority === 'high' ? 'medium' : evaluation.followUpPriority,
    summary: /desvi|encaminh|outro (whats|zap|n[uú]mero)/iu.test(evaluation.summary)
      ? evaluation.summary
      : phone
        ? `Atendimento deste chat foi desviado para o número comercial ${phone}. A conversa de campanha não continua aqui.`
        : 'Atendimento deste chat foi desviado para outro número comercial. A conversa de campanha não continua aqui.',
    roiNotes: phone
      ? `Desviado ${phone}. Acompanhar no WhatsApp comercial, não neste chat de campanha.`
      : 'Desviado para número comercial. Acompanhar no outro WhatsApp.',
  };
}
