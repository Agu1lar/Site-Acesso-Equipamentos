export type ClassifiableThread = {
  session: { raw?: Record<string, unknown> };
  messages: Array<{ from_me: boolean; body: string | null }>;
};

export const ATTENDANCE_TEAMS = ['comercial', 'logistica', 'mecanica'] as const;

export type AttendanceTeam = (typeof ATTENDANCE_TEAMS)[number];

export type AttendanceDesk = AttendanceTeam | 'financeiro' | 'manutencao';

export const TEAM_FOLDER: Record<AttendanceTeam, string> = {
  comercial: 'Comercial',
  logistica: 'Logistica',
  mecanica: 'Mecanica',
};

const LOGISTICS_DEPARTMENT_IDS = new Set([
  'a3497569-a552-4b5d-a0f4-131c8a3f15d3',
]);

const COMMERCIAL_DEPARTMENT_IDS = new Set([
  'b8398ed0-56e9-4516-9828-e9f6f5278535',
  'bfa204ae-40b3-42a6-91a6-f24704aae08a',
  '1fb4f59a-4f02-4893-809f-e602ab641812',
  '89aa9825-89c4-4624-8dfc-c761650cd77e',
  'e1f662f4-bd9c-4119-9581-006e41491572',
]);

/**
 * ChatPro "Aguardando Atendimento" department. `unassign` only clears `assing_to` when the
 * department really changes, so the bot hands the chat over to this queue.
 */
export const WAITING_QUEUE_DEPARTMENT_ID = 'bfa204ae-40b3-42a6-91a6-f24704aae08a';

const FINANCEIRO_DEPARTMENT_IDS = new Set([
  'effe735a-23b9-4b4a-be4a-4aa46b5c8daf',
]);

const MANUTENCAO_DEPARTMENT_IDS = new Set([
  'c8b80b2d-9587-4cc6-af7e-0b89d991c0a2',
]);

const DEPARTMENT_TRANSFER = /Sessão transferida para o departamento `([0-9a-f-]{36})`/iu;
const EXISTING_CLIENT_MENU = /LOG[IÍ]STICA\/\s*TROCA/iu;
const MENU_DIGIT = /^[1-6]$/u;
const LOGISTICS_TALK = /\b(program(?:a|e|ar).{0,24}devolu|devolu[cç][aã]o|troca (?:do |da |de )?(?:equipamento|m[aá]quina|plataforma)|retirada do equipamento)\b/iu;
const MECHANIC_TALK = /\b(manuten[cç][aã]o corretiva|abrir chamado|n[aã]o est[aá] (abaixando|subindo|ligando)|motor n[aã]o pega|vazamento hidr[aá]ulico|gaiola)\b/iu;

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function deskFromDepartmentId(departmentId: string | null): AttendanceDesk | null {
  if (!departmentId) {
    return null;
  }
  if (LOGISTICS_DEPARTMENT_IDS.has(departmentId)) {
    return 'logistica';
  }
  if (COMMERCIAL_DEPARTMENT_IDS.has(departmentId)) {
    return 'comercial';
  }
  if (FINANCEIRO_DEPARTMENT_IDS.has(departmentId)) {
    return 'financeiro';
  }
  if (MANUTENCAO_DEPARTMENT_IDS.has(departmentId)) {
    return 'manutencao';
  }
  return null;
}

function departmentIdFromSession(thread: ClassifiableThread) {
  return waitingQueueDepartmentId(thread.session.raw);
}

/**
 * Department that owns the chat, used to put it back in "aguardando atendimento".
 */
export function waitingQueueDepartmentId(raw?: Record<string, unknown> | null) {
  const value = asRecord(raw ?? {}).department_id;
  return typeof value === 'string' && /^[0-9a-f-]{36}$/iu.test(value.trim())
    ? value.trim()
    : null;
}

function lastTransferredDepartmentId(thread: ClassifiableThread) {
  let found: string | null = null;
  for (const message of thread.messages) {
    const match = message.body?.match(DEPARTMENT_TRANSFER);
    if (match?.[1]) {
      found = match[1];
    }
  }
  return found;
}

function deskFromExistingClientMenu(thread: ClassifiableThread): AttendanceDesk | null {
  let waitingDigit = false;
  for (const message of thread.messages) {
    if (message.from_me && message.body && EXISTING_CLIENT_MENU.test(message.body)) {
      waitingDigit = true;
      continue;
    }
    if (!waitingDigit || message.from_me || !message.body) {
      continue;
    }
    const digit = message.body.trim();
    if (!MENU_DIGIT.test(digit)) {
      continue;
    }
    if (digit === '6') {
      return 'logistica';
    }
    if (digit === '3') {
      return 'manutencao';
    }
    if (digit === '4' || digit === '5') {
      return 'financeiro';
    }
    return 'comercial';
  }
  return null;
}

function looksLikeLogisticsTalk(thread: ClassifiableThread) {
  return thread.messages.some((message) => message.body && LOGISTICS_TALK.test(message.body));
}

function looksLikeMechanicTalk(thread: ClassifiableThread) {
  return thread.messages.some((message) => message.body && MECHANIC_TALK.test(message.body));
}

/**
 * Maps a ChatPro desk to the Obsidian folder that owns the notes.
 */
export function vaultTeamForDesk(desk: AttendanceDesk): AttendanceTeam {
  if (desk === 'logistica') {
    return 'logistica';
  }
  if (desk === 'manutencao' || desk === 'mecanica') {
    return 'mecanica';
  }
  return 'comercial';
}

/**
 * True when the desk should train that team's Haiku playbook.
 */
export function deskBelongsInPlaybook(desk: AttendanceDesk, team: AttendanceTeam) {
  if (team === 'logistica') {
    return desk === 'logistica';
  }
  if (team === 'mecanica') {
    return desk === 'manutencao' || desk === 'mecanica';
  }
  return desk === 'comercial';
}

/**
 * Company folder from `OBSIDIAN_PLAYBOOK_FOLDER` (strips team suffix).
 */
export function companyFolderFromPlaybookFolder(folder: string) {
  const stripped = folder.replace(/[\\/]+(Comercial|Logistica|Mecanica)\s*$/iu, '').trim();
  return stripped || 'Acesso Equipamentos';
}

/**
 * Vault relative path for one attendance team.
 */
export function vaultFolderForTeam(companyFolder: string, team: AttendanceTeam) {
  return `${companyFolder}/${TEAM_FOLDER[team]}`;
}

/**
 * All team folders under the company path.
 */
export function allTeamFolders(companyFolder: string) {
  return ATTENDANCE_TEAMS.map((team) => vaultFolderForTeam(companyFolder, team));
}

/**
 * Classifies a ChatPro thread by department, URA menu, or talk.
 */
export function classifyAttendanceDesk(thread: ClassifiableThread): AttendanceDesk {
  return deskFromDepartmentId(departmentIdFromSession(thread))
    ?? deskFromDepartmentId(lastTransferredDepartmentId(thread))
    ?? deskFromExistingClientMenu(thread)
    ?? (looksLikeLogisticsTalk(thread)
      ? 'logistica'
      : looksLikeMechanicTalk(thread)
        ? 'manutencao'
        : 'comercial');
}

/**
 * Every desk that owned this WhatsApp: current department plus each transfer.
 */
export function desksTouchedByThread(thread: ClassifiableThread): AttendanceDesk[] {
  const desks: AttendanceDesk[] = [];
  const seen = new Set<AttendanceDesk>();
  const add = (desk: AttendanceDesk | null) => {
    if (!desk || seen.has(desk)) {
      return;
    }
    seen.add(desk);
    desks.push(desk);
  };

  add(deskFromDepartmentId(departmentIdFromSession(thread)));
  for (const message of thread.messages) {
    const match = message.body?.match(DEPARTMENT_TRANSFER);
    add(deskFromDepartmentId(match?.[1] ?? null));
  }
  add(deskFromExistingClientMenu(thread));
  add(classifyAttendanceDesk(thread));
  return desks;
}

function emptyTeamBuckets<T>(): Record<AttendanceTeam, T[]> {
  return {
    comercial: [],
    logistica: [],
    mecanica: [],
  };
}

/**
 * Splits threads into team folders. A transferred client can appear in more than one team.
 */
export function partitionAttendanceThreads<T extends ClassifiableThread>(threads: T[]) {
  const vault = emptyTeamBuckets<T>();
  const playbook = emptyTeamBuckets<T>();

  for (const thread of threads) {
    const vaultSeen = new Set<AttendanceTeam>();
    const playbookSeen = new Set<AttendanceTeam>();
    for (const desk of desksTouchedByThread(thread)) {
      const team = vaultTeamForDesk(desk);
      if (!vaultSeen.has(team)) {
        vaultSeen.add(team);
        vault[team].push(thread);
      }
      if (deskBelongsInPlaybook(desk, team) && !playbookSeen.has(team)) {
        playbookSeen.add(team);
        playbook[team].push(thread);
      }
    }
  }

  return { vault, playbook };
}
