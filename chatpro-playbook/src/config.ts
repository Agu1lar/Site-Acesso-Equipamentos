import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { companyFolderFromPlaybookFolder, WAITING_QUEUE_DEPARTMENT_ID } from './attendance-team.js';
import { DEFAULT_AFTER_HOURS_MESSAGE } from './after-hours-decide.js';
import { isAfterHoursSandbox, parseAfterHoursAllowedPhones } from './sandbox.js';

export type PlaybookConfig = {
  databaseUrl: string;
  chatproInstanceId: string;
  chatproInstanceToken: string;
  anthropicApiKey: string | null;
  anthropicModel: string;
  obsidianVaultPath: string;
  obsidianCompanyFolder: string;
  obsidianPlaybookFolder: string;
  lookbackDays: number;
  maxSessions: number;
  afterHoursMessage: string;
  afterHoursPollMs: number;
  afterHoursAlertWebhookUrl: string | null;
  afterHoursLiveEnabled: boolean;
  afterHoursAllowAll: boolean;
  afterHoursAllowedPhones: string[];
  afterHoursLiveArmPath: string;
  afterHoursForceOffHours: boolean;
  afterHoursWaitingDepartmentId: string;
  playbookRefreshMs: number;
  workerPollMs: number;
  sandbox: boolean;
  whisperEnabled: boolean;
  whisperModel: string;
};

function loadDotEnvFile(envPath: string) {
  if (!existsSync(envPath)) {
    return;
  }

  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function readRequired(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

/**
 * Loads playbook worker environment from chatpro-playbook/.env.
 */
export function loadPlaybookConfig(): PlaybookConfig {
  loadDotEnvFile(resolve(import.meta.dirname, '../.env'));
  const obsidianPlaybookFolder = process.env.OBSIDIAN_PLAYBOOK_FOLDER?.trim()
    || 'Acesso Equipamentos/Comercial';

  return {
    databaseUrl: readRequired('PLAYBOOK_DATABASE_URL'),
    chatproInstanceId: process.env.CHATPRO_INSTANCE_ID?.trim() || '',
    chatproInstanceToken: process.env.CHATPRO_INSTANCE_TOKEN?.trim() || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() || null,
    anthropicModel: process.env.ANTHROPIC_MODEL?.trim() || 'claude-haiku-4-5-20251001',
    obsidianVaultPath: process.env.OBSIDIAN_VAULT_PATH?.trim()
      || 'C:\\Users\\User\\Documents\\CofreObsidian\\Aguilar',
    obsidianCompanyFolder: process.env.OBSIDIAN_COMPANY_FOLDER?.trim()
      || companyFolderFromPlaybookFolder(obsidianPlaybookFolder),
    obsidianPlaybookFolder,
    lookbackDays: Number(process.env.PLAYBOOK_LOOKBACK_DAYS ?? 45),
    maxSessions: Number(process.env.PLAYBOOK_MAX_SESSIONS ?? 40),
    afterHoursMessage: process.env.AFTER_HOURS_MESSAGE?.trim() || DEFAULT_AFTER_HOURS_MESSAGE,
    afterHoursPollMs: Number(process.env.AFTER_HOURS_POLL_MS ?? 3_000),
    afterHoursAlertWebhookUrl: process.env.AFTER_HOURS_ALERT_WEBHOOK_URL?.trim() || null,
    afterHoursLiveEnabled: process.env.AFTER_HOURS_LIVE_ENABLED?.trim().toLowerCase() === 'true',
    afterHoursAllowAll: process.env.AFTER_HOURS_ALLOW_ALL?.trim().toLowerCase() === 'true',
    afterHoursAllowedPhones: parseAfterHoursAllowedPhones(process.env.AFTER_HOURS_ALLOWED_PHONES),
    afterHoursLiveArmPath: process.env.AFTER_HOURS_LIVE_ARM_PATH?.trim()
      || resolve(import.meta.dirname, '../.after-hours-live'),
    afterHoursForceOffHours: process.env.AFTER_HOURS_FORCE_OFF_HOURS?.trim().toLowerCase() === 'true',
    afterHoursWaitingDepartmentId: process.env.AFTER_HOURS_WAITING_DEPARTMENT_ID?.trim()
      || WAITING_QUEUE_DEPARTMENT_ID,
    playbookRefreshMs: Number(process.env.PLAYBOOK_REFRESH_MS ?? 0),
    workerPollMs: Number(process.env.PLAYBOOK_WORKER_POLL_MS ?? 300_000),
    sandbox: isAfterHoursSandbox(),
    whisperEnabled: (process.env.PLAYBOOK_WHISPER?.trim() || 'transformers') !== 'off',
    whisperModel: process.env.PLAYBOOK_WHISPER_MODEL?.trim() || 'Xenova/whisper-tiny',
  };
}
