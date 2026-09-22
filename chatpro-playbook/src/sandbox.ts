/**
 * WhatsApp send is sandbox-blocked unless AFTER_HOURS_SANDBOX is explicitly false.
 */
export function isAfterHoursSandbox(env: NodeJS.ProcessEnv = process.env) {
  const raw = env.AFTER_HOURS_SANDBOX?.trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'off') {
    return false;
  }
  return true;
}

/**
 * Live WhatsApp send only when sandbox is off and `--live` was passed.
 */
export function afterHoursMustDryRun(options: { sandbox: boolean; liveFlag: boolean }) {
  return options.sandbox || !options.liveFlag;
}

/** Parses an explicit comma, semicolon, or newline-separated live pilot allowlist. */
export function parseAfterHoursAllowedPhones(raw: string | undefined) {
  if (!raw?.trim()) {
    return [];
  }
  return [...new Set(raw.split(/[,;\n]/u)
    .map((value) => value.replaceAll(/\D/gu, ''))
    .filter((value) => value.length >= 10 && value.length <= 15))];
}

/** Allows a live recipient only by exact digits unless the explicit allow-all flag is armed. */
export function isAfterHoursPhoneAllowed(options: {
  phoneKey: string | null;
  allowedPhones: string[];
  allowAll: boolean;
}) {
  if (options.allowAll) {
    return true;
  }
  const phone = options.phoneKey?.replaceAll(/\D/gu, '') ?? '';
  if (!phone) {
    return false;
  }
  return options.allowedPhones.some((allowed) => phoneMatchesAllowlist(phone, allowed));
}

function brazilianMobileCore(digits: string) {
  const local = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length === 11 && local[2] === '9') {
    return `${local.slice(0, 2)}${local.slice(3)}`;
  }
  return local.length >= 10 ? local.slice(-10) : local;
}

function phoneMatchesAllowlist(phone: string, allowed: string) {
  if (phone === allowed) {
    return true;
  }
  const phoneTail = phone.length >= 11 ? phone.slice(-11) : phone.slice(-10);
  const allowedTail = allowed.length >= 11 ? allowed.slice(-11) : allowed.slice(-10);
  if (phoneTail.length >= 10 && phoneTail === allowedTail) {
    return true;
  }
  const phoneCore = brazilianMobileCore(phone);
  const allowedCore = brazilianMobileCore(allowed);
  return phoneCore.length >= 10 && allowedCore.length >= 10 && phoneCore === allowedCore;
}

/** Returns fail-closed blockers for a real ChatPro send. */
export function validateAfterHoursLiveConfig(options: {
  liveEnabled: boolean;
  liveArmPresent: boolean;
  allowAll: boolean;
  allowedPhones: string[];
  alertWebhookUrl: string | null;
  instanceId: string;
  instanceToken: string;
  anthropicApiKey: string | null;
}) {
  const blockers: string[] = [];
  if (!options.liveEnabled) {
    blockers.push('AFTER_HOURS_LIVE_ENABLED precisa ser true');
  }
  if (!options.liveArmPresent) {
    blockers.push('arquivo de armação live ausente');
  }
  if (!options.allowAll && options.allowedPhones.length === 0) {
    blockers.push('AFTER_HOURS_ALLOWED_PHONES precisa ter ao menos um telefone');
  }
  if (!options.alertWebhookUrl) {
    blockers.push('AFTER_HOURS_ALERT_WEBHOOK_URL é obrigatório');
  }
  if (!options.instanceId) {
    blockers.push('CHATPRO_INSTANCE_ID é obrigatório');
  }
  if (!options.instanceToken) {
    blockers.push('CHATPRO_INSTANCE_TOKEN é obrigatório');
  }
  if (!options.anthropicApiKey) {
    blockers.push('ANTHROPIC_API_KEY é obrigatória para o bot live');
  }
  return blockers;
}
