import {
  attendanceTriageContext,
  expandUraMenuUserLine,
  replyAsAttendanceBot,
  stripAgentSignatures,
} from './attendance-brain.js';
import type { AttendanceTurn } from './attendance-brain.js';
import type { AttendanceKnowledgeHit } from './attendance-agent.js';
import { mergeAttendanceAgentState } from './attendance-state.js';
import type { AttendanceAgentState } from './attendance-state.js';
import { allTeamFolders, vaultFolderForTeam } from './attendance-team.js';
import type { PlaybookConfig } from './config.js';
import { searchVaultKnowledge } from './vault-search.js';

function attendanceSearchRoots(config: PlaybookConfig) {
  return [
    ...allTeamFolders(config.obsidianCompanyFolder).flatMap((folder) => [
      `${folder}/Modulos`,
      `${folder}/Conhecimento`,
    ]),
    `${vaultFolderForTeam(config.obsidianCompanyFolder, 'mecanica')}/Manuais`,
  ];
}

function searchAttendanceKnowledge(config: PlaybookConfig, query: string): AttendanceKnowledgeHit[] {
  return searchVaultKnowledge({
    vaultPath: config.obsidianVaultPath,
    roots: attendanceSearchRoots(config),
    query,
  }).map((hit) => ({
    id: `knowledge:${hit.title}`,
    title: hit.title,
    excerpt: hit.excerpt,
  }));
}

/**
 * Builds the same retrieval block the sandbox REPL sends to the attendance bot.
 */
export function retrieveSandboxKnowledge(options: {
  config: PlaybookConfig;
  userTurns: string[];
  line: string;
  extraRetrieved?: string;
}) {
  return options.extraRetrieved?.trim() ?? '';
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
  agentState?: AttendanceAgentState | null;
  inboundMessageId?: string | null;
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
  const activeAgentState = options.agentState ?? null;
  const retrieved = retrieveSandboxKnowledge({
    config: options.config,
    userTurns: triageContext.userTurns,
    line,
    extraRetrieved: options.extraRetrieved,
  });
  const reply = await replyAsAttendanceBot({
    apiKey: options.apiKey,
    model: options.config.anthropicModel,
    strongModel: options.config.anthropicStrongModel,
    vaultKnowledge: options.vaultKnowledge,
    retrievedKnowledge: retrieved || null,
    contactContext: options.contactContext ?? null,
    history,
    userText: line,
    offHours: options.offHours,
    live: options.live,
    now: options.now,
    triageContext,
    searchKnowledge: (query) => searchAttendanceKnowledge(options.config, query),
    agentState: activeAgentState,
  });
  const nextAgentState = reply.decision
    ? mergeAttendanceAgentState({
        previous: activeAgentState,
        decision: reply.decision,
        inboundMessageId: options.inboundMessageId,
        now: options.now,
      })
    : options.agentState ?? null;
  return {
    ...reply,
    retrieved,
    agentState: nextAgentState,
  };
}
