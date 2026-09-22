import {
  attendanceTriageContext,
  expandUraMenuUserLine,
  replyAsAttendanceBot,
  stripAgentSignatures,
} from './attendance-brain.js';
import type { AttendanceTurn } from './attendance-brain.js';
import { allTeamFolders, vaultFolderForTeam } from './attendance-team.js';
import type { PlaybookConfig } from './config.js';
import { retrievedFleetBlock } from './fleet-catalog.js';
import { formatVaultSearchHits, searchVaultKnowledge, shouldSearchAttendanceModules } from './vault-search.js';

/**
 * Builds the same retrieval block the sandbox REPL sends to the attendance bot.
 */
export function retrieveSandboxKnowledge(options: {
  config: PlaybookConfig;
  userTurns: string[];
  line: string;
  extraRetrieved?: string;
}) {
  const searchRoots = [
    ...allTeamFolders(options.config.obsidianCompanyFolder).flatMap((folder) => [
      `${folder}/Modulos`,
      `${folder}/Conhecimento`,
    ]),
    `${vaultFolderForTeam(options.config.obsidianCompanyFolder, 'mecanica')}/Manuais`,
  ];
  return [
    retrievedFleetBlock(options.userTurns),
    shouldSearchAttendanceModules(options.line)
      ? formatVaultSearchHits(searchVaultKnowledge({
        vaultPath: options.config.obsidianVaultPath,
        roots: searchRoots,
        query: options.line,
      }))
      : '',
    options.extraRetrieved ?? '',
  ].filter(Boolean).join('\n\n');
}

/**
 * One sandbox turn: retrieve catalog/vault notes and reply. WhatsApp stays off.
 */
export async function runSandboxTurn(options: {
  config: PlaybookConfig;
  apiKey: string;
  vaultKnowledge: string;
  history: AttendanceTurn[];
  line: string;
  offHours: boolean;
  contactContext?: string | null;
  extraRetrieved?: string;
  live?: boolean;
  now?: Date;
}) {
  const history = options.history.slice(-16).map((turn) => ({
    role: turn.role,
    text: stripAgentSignatures(turn.text),
    origin: turn.origin,
    at: turn.at,
  }));
  const previousAssistant = history.findLast((turn) => turn.role === 'assistant')?.text ?? null;
  const line = expandUraMenuUserLine(stripAgentSignatures(options.line), previousAssistant);
  const triageContext = attendanceTriageContext({
    history,
    userText: line,
    now: options.now,
  });
  const retrieved = retrieveSandboxKnowledge({
    config: options.config,
    userTurns: triageContext.userTurns,
    line,
    extraRetrieved: options.extraRetrieved,
  });
  const reply = await replyAsAttendanceBot({
    apiKey: options.apiKey,
    model: options.config.anthropicModel,
    vaultKnowledge: options.vaultKnowledge,
    retrievedKnowledge: retrieved || null,
    contactContext: options.contactContext ?? null,
    history,
    userText: line,
    offHours: options.offHours,
    live: options.live,
    now: options.now,
    triageContext,
  });
  return {
    ...reply,
    retrieved,
  };
}
