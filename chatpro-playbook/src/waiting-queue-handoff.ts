export const WAITING_QUEUE_ALERT_AFTER_ATTEMPTS = 3;

export type WaitingQueueVerification = {
  verified: boolean;
  reason: string;
};

export type WaitingQueueClient = {
  returnSessionToWaiting: (options: { sessionId: string; departmentId: string }) => Promise<unknown>;
  getSession: (sessionId: string) => Promise<{ raw: Record<string, unknown> } | null>;
};

export type ChatProAssignmentSnapshot = {
  departmentId: string | null;
  assigneeId: string | null;
  assignedAt: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readDepartmentId(raw: Record<string, unknown>) {
  const department = asRecord(raw.department);
  const value = raw.department_id ?? raw.departmentId ?? department?.id;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readString(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

/** Reads ChatPro's real assignment fields, including its documented `assing_to` typo. */
export function assignmentSnapshot(raw: Record<string, unknown>): ChatProAssignmentSnapshot {
  return {
    departmentId: readDepartmentId(raw),
    assigneeId: readString(raw, [
      'assing_to', 'assigned_to', 'assignedTo', 'user_id', 'userId', 'attendant_id',
      'attendantId', 'operator_id', 'operatorId', 'agent_id', 'agentId',
    ]),
    assignedAt: readString(raw, ['date_assign', 'assigned_at', 'assignedAt']),
  };
}

function hasAssignedAttendant(raw: Record<string, unknown>) {
  const keys = [
    'assing_to',
    'user_id', 'userId', 'attendant_id', 'attendantId', 'operator_id', 'operatorId',
    'agent_id', 'agentId', 'assigned_to', 'assignedTo', 'assigned_user_id', 'assignedUserId',
    'user', 'attendant', 'operator', 'agent',
  ];
  return keys.some((key) => {
    const value = raw[key];
    if (value === null || value === undefined || value === '' || value === false) {
      return false;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    const record = asRecord(value);
    return record ? Object.keys(record).length > 0 : true;
  });
}

function hasExplicitUnassignedSignal(raw: Record<string, unknown>) {
  if (Object.hasOwn(raw, 'assing_to') && (raw.assing_to === '' || raw.assing_to === null)) {
    return true;
  }
  if (raw.unassigned === true || raw.waiting === true || raw.in_queue === true || raw.inQueue === true) {
    return true;
  }
  const status = String(raw.queue_status ?? raw.queueStatus ?? raw.status ?? '').trim().toLowerCase();
  if (['waiting', 'awaiting', 'queued', 'aguardando', 'aguardando_atendimento'].includes(status)) {
    return true;
  }
  const assignmentKeys = [
    'user_id', 'userId', 'attendant_id', 'attendantId', 'operator_id', 'operatorId',
    'agent_id', 'agentId', 'assigned_to', 'assignedTo', 'assigned_user_id', 'assignedUserId',
  ];
  return assignmentKeys.some((key) => Object.hasOwn(raw, key) && (raw[key] === null || raw[key] === ''));
}

/** Verifies both queue department and absence of an assigned attendant. */
export function verifyWaitingQueueSession(
  raw: Record<string, unknown>,
  expectedDepartmentId: string,
): WaitingQueueVerification {
  if (raw.open !== true) {
    return { verified: false, reason: raw.open === false ? 'session_closed' : 'open_not_confirmed' };
  }
  const departmentId = readDepartmentId(raw);
  if (departmentId !== expectedDepartmentId) {
    return { verified: false, reason: departmentId ? 'wrong_department' : 'department_not_confirmed' };
  }
  if (hasAssignedAttendant(raw)) {
    return { verified: false, reason: 'attendant_still_assigned' };
  }
  if (!hasExplicitUnassignedSignal(raw)) {
    return { verified: false, reason: 'unassign_not_confirmed' };
  }
  return { verified: true, reason: 'waiting_queue_confirmed' };
}

export type WaitingQueueAttemptResult = {
  status: 'queued_verified' | 'sent_awaiting_unassign' | 'human_claimed' | 'transferred';
  attempts: number;
  error: string | null;
  shouldAlert: boolean;
};

/**
 * Moves the chat to `departmentId` with `unassign` and only completes after a fresh lookup
 * confirms the waiting queue. `forceUnassign` keeps retrying on the live pilot, where the
 * attendant ChatPro re-assigns would otherwise look like a human takeover.
 */
export async function runWaitingQueueHandoffAttempt(options: {
  client: WaitingQueueClient;
  sessionId: string;
  departmentId: string | null;
  previousAttempts: number;
  originalAssignment?: ChatProAssignmentSnapshot | null;
  alertAfterAttempts?: number;
  forceUnassign?: boolean;
}): Promise<WaitingQueueAttemptResult> {
  const attempts = options.previousAttempts + 1;
  const alertAfterAttempts = options.alertAfterAttempts ?? WAITING_QUEUE_ALERT_AFTER_ATTEMPTS;
  const pending = (error: string): WaitingQueueAttemptResult => ({
    status: 'sent_awaiting_unassign',
    attempts,
    error,
    shouldAlert: attempts >= alertAfterAttempts,
  });

  if (!options.departmentId) {
    return pending('missing_department');
  }

  try {
    const before = await options.client.getSession(options.sessionId);
    if (!before) {
      return pending('session_not_returned_by_chatpro');
    }
    const alreadyWaiting = verifyWaitingQueueSession(before.raw, options.departmentId);
    if (alreadyWaiting.verified) {
      return {
        status: 'queued_verified',
        attempts: options.previousAttempts,
        error: null,
        shouldAlert: false,
      };
    }
    const current = assignmentSnapshot(before.raw);
    const original = options.originalAssignment;
    const expectedDepartments = new Set([options.departmentId, original?.departmentId]);
    if (current.departmentId && !expectedDepartments.has(current.departmentId)) {
      return {
        status: 'transferred',
        attempts: options.previousAttempts,
        error: 'department_changed_after_bot_send',
        shouldAlert: false,
      };
    }
    const assigneeChanged = Boolean(
      current.assigneeId
      && original
      && (current.assigneeId !== original.assigneeId
        || (original.assignedAt && current.assignedAt !== original.assignedAt)),
    );
    if (!options.forceUnassign
      && (assigneeChanged || (current.assigneeId && original?.assigneeId === null))) {
      return {
        status: 'human_claimed',
        attempts: options.previousAttempts,
        error: 'attendant_changed_after_bot_send',
        shouldAlert: false,
      };
    }
    await options.client.returnSessionToWaiting({
      sessionId: options.sessionId,
      departmentId: options.departmentId,
    });
    const fresh = await options.client.getSession(options.sessionId);
    if (!fresh) {
      return pending('session_not_returned_by_chatpro');
    }
    const verification = verifyWaitingQueueSession(fresh.raw, options.departmentId);
    if (!verification.verified) {
      return pending(verification.reason);
    }
    return {
      status: 'queued_verified',
      attempts,
      error: null,
      shouldAlert: false,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return pending(`unassign_failed:${reason}`.slice(0, 400));
  }
}
