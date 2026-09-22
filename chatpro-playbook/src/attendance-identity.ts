import { formatAttendanceGreeting } from './attendance-clock.js';

/**
 * Display name of the after-hours AI. Change this constant to rename the bot.
 */
export const ATTENDANCE_BOT_NAME = 'IA Eva';

function botPrefixPattern() {
  const name = ATTENDANCE_BOT_NAME.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`^(?:${name}|Eva)\\s*:\\s*`, 'iu');
}

/**
 * Drops a leading `Nome:` so the prefix can be applied once.
 */
export function stripAttendanceBotPrefix(text: string) {
  let next = text.trim();
  for (let index = 0; index < 3; index += 1) {
    const stripped = next.replace(botPrefixPattern(), '').trim();
    if (stripped === next) {
      break;
    }
    next = stripped;
  }
  return next;
}

/**
 * Formats an outbound turn as `Nome: mensagem`.
 */
export function withAttendanceBotPrefix(text: string) {
  const body = stripAttendanceBotPrefix(text);
  return body ? `${ATTENDANCE_BOT_NAME}: ${body}` : `${ATTENDANCE_BOT_NAME}:`;
}

/**
 * True when the draft already said it is the Acesso after-hours AI.
 */
export function replyHasAttendanceIntro(text: string) {
  return /sou a ia(?: eva)?(?:, a ia)? da acesso|ia eva da acesso|ia da acesso equipamentos|atendimento fora do hor[áa]rio comercial/iu
    .test(stripAttendanceBotPrefix(text));
}

/**
 * True when the customer asked who the bot is.
 */
export function isAttendanceIdentityAsk(text: string) {
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
  return /quem (?:e|eh) (?:voce|vc|tu)|(?:voce|vc) e quem|(?:voce|vc) e (?:a )?(?:ia |um |uma )?(?:eva|robo|bot|inteligencia)|se apresenta|e (?:um|uma) (?:ia|inteligencia artificial)/u
    .test(t);
}

/**
 * First-turn introduction. The model may write this in its own words; this is the fallback.
 */
export function attendanceBotIntro(now: Date) {
  return `${formatAttendanceGreeting(now)} Sou a ${ATTENDANCE_BOT_NAME}, a IA da Acesso Equipamentos, e faço o atendimento fora do horário comercial.`;
}

/**
 * Prefixes the bot name and, on the first turn or an identity ask, ensures the after-hours AI intro.
 */
export function ensureAttendanceIdentity(text: string, options: {
  introduce: boolean;
  now: Date;
  userText?: string;
}) {
  let body = stripAttendanceBotPrefix(text);
  const mustIntroduce = options.introduce || isAttendanceIdentityAsk(options.userText ?? '');
  if (mustIntroduce && !replyHasAttendanceIntro(body)) {
    const intro = attendanceBotIntro(options.now);
    const rest = body.replace(/^(bom dia|boa tarde|boa noite)[!.,]?\s*/iu, '');
    body = rest ? `${intro} ${rest}`.trim() : intro;
  }
  return withAttendanceBotPrefix(body);
}
