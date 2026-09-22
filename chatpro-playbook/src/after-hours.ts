import { existsSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Pool } from 'pg';
import {
  decideAfterHoursNotice,
  isAttendanceTeamReply,
  sessionFlagsFromRaw,
} from './after-hours-decide.js';
import { ChatProChatClient } from './chatpro-chat.js';
import { allTeamFolders } from './attendance-team.js';
import { withAttendanceBotPrefix } from './attendance-identity.js';
import { findContactNoteByPhone } from './contact-note.js';
import type { PlaybookConfig } from './config.js';
import {
  findAfterHoursNotice,
  findUnresolvedAfterHoursNotice,
  insertBotOutbound,
  listPendingAfterHoursHandoffs,
  listKnownAfterHoursSessionIds,
  listThreadsForAfterHours,
  listUnconfirmedAfterHoursDeliveries,
  markAfterHoursNoticeAlerted,
  updateAfterHoursQueueHandoff,
  updateAfterHoursDelivery,
  upsertAfterHoursNotice,
} from './db.js';
import type { MessageRow } from './db.js';
import { botOutboundId } from './bot-origin.js';
import { isBusinessOpen, offHoursWindow } from './duty-hours.js';
import { syncRecentChatProSessions } from './sync.js';
import { expandUraMenuUserLine, stripAgentSignatures } from './attendance-brain.js';
import type { AttendanceTurnOrigin } from './attendance-brain.js';
import { runSandboxTurn } from './sandbox-session.js';
import { readPlaybookVaultKnowledge } from './vault.js';
import { assignmentSnapshot, runWaitingQueueHandoffAttempt } from './waiting-queue-handoff.js';
import type { WaitingQueueClient } from './waiting-queue-handoff.js';
import { isAfterHoursPhoneAllowed, validateAfterHoursLiveConfig } from './sandbox.js';
import { phoneKeyFromChatProRecord } from './parse-chatpro.js';

export type AfterHoursTickResult = {
  open: boolean;
  windowId: string | null;
  dryRun: boolean;
  considered: number;
  sent: number;
  dry: number;
  skipped: number;
  awaitingUnassign: number;
  queueVerified: number;
  alerts: number;
  humanClaimed: number;
  transferred: number;
  deliveryConfirmed: number;
  deliveryFailed: number;
};

async function sendOperationalAlert(options: {
  webhookUrl: string | null;
  sessionId: string;
  windowId: string;
  attempts: number;
  reason: string | null;
}) {
  if (!options.webhookUrl) {
    return;
  }
  if (options.webhookUrl.startsWith('file:')) {
    const logPath = resolve(
      import.meta.dirname,
      '..',
      options.webhookUrl.slice('file:'.length).replace(/^[\\/]/u, ''),
    );
    appendFileSync(logPath, `${JSON.stringify({
      at: new Date().toISOString(),
      event: 'chatpro_waiting_queue_alert',
      sessionId: options.sessionId,
      windowId: options.windowId,
      attempts: options.attempts,
      reason: options.reason,
    })}\n`);
    return;
  }
  const response = await fetch(options.webhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event: 'chatpro_waiting_queue_alert',
      sessionId: options.sessionId,
      windowId: options.windowId,
      attempts: options.attempts,
      reason: options.reason,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`operational_alert_http_${response.status}`);
  }
}

/**
 * Marks who wrote a thread message so the bot never reads a URA menu or a consultant
 * greeting as triage it captured itself.
 */
function attendanceTurnOriginOf(message: MessageRow): AttendanceTurnOrigin {
  if (!message.from_me) {
    return 'customer';
  }
  if (message.bot_origin === true) {
    return 'bot';
  }
  const decided = {
    id: message.id,
    fromMe: true,
    body: message.body,
    mediaType: message.media_type,
    sentAt: message.sent_at,
    botOrigin: false,
  };
  return isAttendanceTeamReply(decided) ? 'human' : 'ura';
}

function nextUnassignRetry(now: Date, attempts: number) {
  const delayMs = Math.min(60_000 * (2 ** Math.max(0, attempts - 1)), 15 * 60_000);
  return new Date(now.getTime() + delayMs);
}

async function attemptQueueHandoff(options: {
  pool: Pool;
  client: WaitingQueueClient;
  sessionId: string;
  windowId: string;
  departmentId: string | null;
  previousAttempts: number;
  alreadyAlerted: boolean;
  originalAssigneeId: string | null;
  originalAssignedAt: string | null;
  alertWebhookUrl: string | null;
  forceUnassign?: boolean;
  now: Date;
}) {
  const outcome = await runWaitingQueueHandoffAttempt({
    ...options,
    originalAssignment: {
      departmentId: options.departmentId,
      assigneeId: options.originalAssigneeId,
      assignedAt: options.originalAssignedAt,
    },
  });
  const newlyAlerted = outcome.shouldAlert && !options.alreadyAlerted;
  await updateAfterHoursQueueHandoff({
    pool: options.pool,
    sessionId: options.sessionId,
    windowId: options.windowId,
    status: outcome.status,
    departmentId: options.departmentId,
    attempts: outcome.attempts,
    error: outcome.error,
    nextUnassignAt: outcome.status === 'sent_awaiting_unassign'
      ? nextUnassignRetry(options.now, outcome.attempts)
      : null,
    shouldAlert: newlyAlerted,
  });
  if (newlyAlerted) {
    console.error('[after-hours] ALERTA: contato não voltou à fila', {
      sessionId: options.sessionId,
      windowId: options.windowId,
      attempts: outcome.attempts,
      reason: outcome.error,
    });
    try {
      await sendOperationalAlert({
        webhookUrl: options.alertWebhookUrl,
        sessionId: options.sessionId,
        windowId: options.windowId,
        attempts: outcome.attempts,
        reason: outcome.error,
      });
    } catch (error) {
      console.error('[after-hours] falha ao enviar alerta operacional', {
        sessionId: options.sessionId,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { outcome, newlyAlerted };
}

/**
 * Syncs recent chats and, outside sandbox, sends at most one after-hours notice
 * per session per night/weekend.
 */
export async function runAfterHoursTick(options: {
  pool: Pool;
  config: PlaybookConfig;
  dryRun: boolean;
  now?: Date;
}): Promise<AfterHoursTickResult> {
  const now = options.now ?? new Date();
  const dryRun = options.dryRun || options.config.sandbox;
  const forceOffHours = options.config.afterHoursForceOffHours;
  const window = offHoursWindow(now, { ignoreOpenFloor: forceOffHours });
  const result: AfterHoursTickResult = {
    open: forceOffHours ? false : isBusinessOpen(now),
    windowId: window?.id ?? null,
    dryRun,
    considered: 0,
    sent: 0,
    dry: 0,
    skipped: 0,
    awaitingUnassign: 0,
    queueVerified: 0,
    alerts: 0,
    humanClaimed: 0,
    transferred: 0,
    deliveryConfirmed: 0,
    deliveryFailed: 0,
  };

  if (!dryRun) {
    const blockers = validateAfterHoursLiveConfig({
      liveEnabled: options.config.afterHoursLiveEnabled,
      liveArmPresent: existsSync(options.config.afterHoursLiveArmPath),
      allowAll: options.config.afterHoursAllowAll,
      allowedPhones: options.config.afterHoursAllowedPhones,
      alertWebhookUrl: options.config.afterHoursAlertWebhookUrl,
      instanceId: options.config.chatproInstanceId,
      instanceToken: options.config.chatproInstanceToken,
      anthropicApiKey: options.config.anthropicApiKey,
    });
    if (blockers.length > 0) {
      throw new Error(`after_hours_live_blocked:${blockers.join('; ')}`);
    }
  }

  const client = dryRun
    ? null
    : new ChatProChatClient({
        instanceId: options.config.chatproInstanceId,
        instanceToken: options.config.chatproInstanceToken,
      });

  if (client) {
    const deliveries = await listUnconfirmedAfterHoursDeliveries({ pool: options.pool });
    for (const stored of deliveries) {
      if (!stored.chatpro_message_id) {
        continue;
      }
      const delivery = await client.getMessageDeliveryStatus(
        stored.session_id,
        stored.chatpro_message_id,
      );
      if (delivery?.status === null || delivery?.status === undefined) {
        continue;
      }
      const failed = delivery.status === -1;
      const confirmed = delivery.status >= 1;
      await updateAfterHoursDelivery({
        pool: options.pool,
        sessionId: stored.session_id,
        windowId: stored.window_id,
        deliveryStatus: failed ? 'provider_failed' : confirmed ? 'provider_confirmed' : 'provider_sending',
        confirmed,
        failed,
        error: delivery.error,
      });
      if (confirmed) {
        result.deliveryConfirmed += 1;
      }
      if (failed) {
        result.deliveryFailed += 1;
        try {
          await sendOperationalAlert({
            webhookUrl: options.config.afterHoursAlertWebhookUrl,
            sessionId: stored.session_id,
            windowId: stored.window_id,
            attempts: 0,
            reason: `message_delivery_failed:${delivery.error ?? 'unknown'}`,
          });
        } catch (error) {
          console.error('[after-hours] falha ao alertar erro de entrega', {
            sessionId: stored.session_id,
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    const pending = await listPendingAfterHoursHandoffs({ pool: options.pool, now });
    const pilotOnly = options.config.afterHoursAllowedPhones.length > 0
      && !options.config.afterHoursAllowAll;
    for (const stored of pending) {
      const handoff = await attemptQueueHandoff({
        pool: options.pool,
        client,
        sessionId: stored.session_id,
        windowId: stored.window_id,
        departmentId: stored.department_id,
        previousAttempts: stored.unassign_attempts,
        alreadyAlerted: stored.alerted_at !== null,
        originalAssigneeId: stored.original_assing_to,
        originalAssignedAt: stored.original_date_assign,
        alertWebhookUrl: options.config.afterHoursAlertWebhookUrl,
        forceUnassign: pilotOnly,
        now,
      });
      if (handoff.outcome.status === 'queued_verified') {
        result.queueVerified += 1;
      }
      if (handoff.outcome.status === 'sent_awaiting_unassign') {
        result.awaitingUnassign += 1;
      }
      if (handoff.outcome.status === 'human_claimed') {
        result.humanClaimed += 1;
      }
      if (handoff.outcome.status === 'transferred') {
        result.transferred += 1;
      }
      if (handoff.newlyAlerted) {
        result.alerts += 1;
      }
    }
  }

  if (result.open || !window) {
    return result;
  }

  const knownSessionIds = await listKnownAfterHoursSessionIds({
    pool: options.pool,
    allowedPhones: options.config.afterHoursAllowedPhones,
  });
  const recent = await syncRecentChatProSessions({
    pool: options.pool,
    config: options.config,
    allowedPhones: options.config.afterHoursAllowedPhones,
    knownSessionIds,
    knownSessionsOnly: !dryRun
      && options.config.afterHoursAllowedPhones.length > 0
      && knownSessionIds.length > 0,
    recentMs: 10 * 60 * 1000,
    maxMessagesPerSession: 40,
  });
  console.log('[after-hours] sync recente', recent);

  const threads = await listThreadsForAfterHours({
    pool: options.pool,
    maxSessions: options.config.afterHoursAllowedPhones.length > 0 ? 8 : Math.max(options.config.maxSessions, 40),
    allowedPhones: options.config.afterHoursAllowedPhones,
  });
  result.considered = threads.length;

  let knownDepartmentIds: Set<string> | null = null;
  const vaultKnowledge = client && options.config.anthropicApiKey
    ? readPlaybookVaultKnowledge({
        vaultPath: options.config.obsidianVaultPath,
        folder: options.config.obsidianPlaybookFolder,
      })
    : '';
  if (client) {
    try {
      knownDepartmentIds = new Set((await client.listDepartments()).map((department) => department.id));
    } catch (error) {
      console.warn('[after-hours] não foi possível validar departamentos', {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const thread of threads) {
    const phoneKey = thread.session.phone_key
      ?? thread.messages
        .map((message) => phoneKeyFromChatProRecord(message.raw ?? null))
        .find((phone): phone is string => Boolean(phone))
      ?? null;
    if (!dryRun && !isAfterHoursPhoneAllowed({
      phoneKey,
      allowedPhones: options.config.afterHoursAllowedPhones,
      allowAll: options.config.afterHoursAllowAll,
    })) {
      result.skipped += 1;
      continue;
    }
    const stored = await findAfterHoursNotice({
      pool: options.pool,
      sessionId: thread.session.id,
      windowId: window.id,
    });
    const unresolved = stored ?? await findUnresolvedAfterHoursNotice({
      pool: options.pool,
      sessionId: thread.session.id,
    });
    const ignoreHumanReplies = isAfterHoursPhoneAllowed({
      phoneKey,
      allowedPhones: options.config.afterHoursAllowedPhones,
      allowAll: false,
    });
    if (unresolved?.status === 'sent_awaiting_unassign' && !ignoreHumanReplies) {
      result.awaitingUnassign += 1;
      continue;
    }
    if (stored?.status === 'failed'
      && stored.next_unassign_at
      && stored.next_unassign_at.getTime() > now.getTime()
      && !ignoreHumanReplies) {
      result.skipped += 1;
      continue;
    }
    const hasPendingHandoff = stored?.status === 'sent'
      || stored?.status === 'sent_awaiting_unassign';

    const alreadySent = stored?.status === 'queued_verified'
      || hasPendingHandoff
      || (dryRun && stored?.status === 'dry_run');
    const decision = decideAfterHoursNotice({
      now,
      alreadySent,
      forceOffHours,
      ignoreHumanReplies,
      session: {
        id: thread.session.id,
        ...sessionFlagsFromRaw(thread.session.raw ?? {}),
      },
      messages: thread.messages.map((message) => ({
        id: message.id,
        fromMe: message.from_me,
        body: message.body,
        mediaType: message.media_type,
        sentAt: message.sent_at,
        botOrigin: message.bot_origin === true,
      })),
    });

    if (decision.action !== 'send') {
      result.skipped += 1;
      console.log('[after-hours] skip', {
        sessionId: thread.session.id,
        last4: phoneKey?.slice(-4) ?? null,
        reason: decision.reason,
        bot: sessionFlagsFromRaw(thread.session.raw ?? {}).botActive,
      });
      continue;
    }

    if (dryRun) {
      await upsertAfterHoursNotice({
        pool: options.pool,
        sessionId: thread.session.id,
        windowId: decision.windowId,
        inboundMessageId: decision.inboundMessageId,
        dryRun: true,
        status: 'dry_run',
        error: null,
      });
      result.dry += 1;
      console.log('[after-hours] dry-run', {
        sessionId: thread.session.id,
        windowId: decision.windowId,
      });
      continue;
    }

    if (!client) {
      throw new Error('sandbox_blocks_whatsapp_send');
    }
    let messageWasSent = false;
    const departmentId = options.config.afterHoursWaitingDepartmentId;
    try {
      const freshBeforeSend = await client.getSession(thread.session.id);
      if (!freshBeforeSend) {
        throw new Error('session_not_returned_by_chatpro_before_send');
      }
      const originalAssignment = assignmentSnapshot(freshBeforeSend.raw);
      if (!originalAssignment.departmentId) {
        throw new Error('missing_department_before_send');
      }
      if (knownDepartmentIds && !knownDepartmentIds.has(departmentId)) {
        throw new Error('unknown_department_before_send');
      }
      const conversation = thread.messages.flatMap((message) => message.body?.trim()
        ? [{
            id: message.id,
            role: message.from_me ? 'assistant' as const : 'user' as const,
            text: message.body.trim(),
            origin: attendanceTurnOriginOf(message),
            at: message.sent_at ?? undefined,
          }]
        : []);
      const inboundIndex = conversation.findIndex((message) => message.id === decision.inboundMessageId);
      const inbound = inboundIndex >= 0 ? conversation[inboundIndex] : null;
      const history = conversation.slice(Math.max(0, inboundIndex - 16), inboundIndex).map((message) => ({
        role: message.role,
        text: stripAgentSignatures(message.text),
        origin: message.origin,
        at: message.at,
      }));
      const previousAssistant = history.findLast((turn) => turn.role === 'assistant')?.text ?? null;
      const generated = options.config.anthropicApiKey && inbound?.role === 'user'
        ? await runSandboxTurn({
            config: options.config,
            apiKey: options.config.anthropicApiKey,
            vaultKnowledge,
            history,
            line: expandUraMenuUserLine(stripAgentSignatures(inbound.text), previousAssistant),
            offHours: true,
            live: true,
            now,
            contactContext: findContactNoteByPhone({
              vaultPath: options.config.obsidianVaultPath,
              folders: allTeamFolders(options.config.obsidianCompanyFolder),
              query: thread.session.phone_key ?? '',
            })?.body ?? null,
          })
        : null;
      const messageToSend = withAttendanceBotPrefix(
        stripAgentSignatures(generated?.text.trim() || options.config.afterHoursMessage),
      );
      try {
        await client.returnSessionToWaiting({ sessionId: thread.session.id, departmentId });
      } catch (unassignError) {
        console.warn('[after-hours] unassign antes do envio falhou; envia mesmo assim', {
          sessionId: thread.session.id,
          reason: unassignError instanceof Error ? unassignError.message : String(unassignError),
        });
      }
      const sent = await client.sendSessionMessage({
        sessionId: thread.session.id,
        message: messageToSend,
        provider: decision.provider,
      });
      messageWasSent = true;
      await upsertAfterHoursNotice({
        pool: options.pool,
        sessionId: thread.session.id,
        windowId: decision.windowId,
        inboundMessageId: decision.inboundMessageId,
        dryRun: false,
        status: 'sent_awaiting_unassign',
        error: departmentId ? null : 'missing_department',
        departmentId,
        unassignAttempts: 0,
        nextUnassignAt: now,
        originalAssigneeId: originalAssignment.assigneeId,
        originalAssignedAt: originalAssignment.assignedAt,
        chatproMessageId: sent.messageId,
        deliveryStatus: sent.messageId ? 'api_accepted' : 'api_response_without_message_id',
      });
      result.sent += 1;
      await insertBotOutbound({
        pool: options.pool,
        id: botOutboundId({
          sessionId: thread.session.id,
          kind: 'after-hours-notice',
          windowId: decision.windowId,
        }),
        sessionId: thread.session.id,
        kind: 'after-hours-notice',
        body: messageToSend,
        windowId: decision.windowId,
        inboundMessageId: decision.inboundMessageId,
        chatproMessageId: sent.messageId,
      });
      const handoff = await attemptQueueHandoff({
        pool: options.pool,
        client,
        sessionId: thread.session.id,
        windowId: decision.windowId,
        departmentId,
        previousAttempts: 0,
        alreadyAlerted: false,
        originalAssigneeId: originalAssignment.assigneeId,
        originalAssignedAt: originalAssignment.assignedAt,
        alertWebhookUrl: options.config.afterHoursAlertWebhookUrl,
        forceUnassign: ignoreHumanReplies,
        now,
      });
      if (handoff.outcome.status === 'queued_verified') {
        result.queueVerified += 1;
      } else if (handoff.outcome.status === 'sent_awaiting_unassign') {
        result.awaitingUnassign += 1;
      } else if (handoff.outcome.status === 'human_claimed') {
        result.humanClaimed += 1;
      } else {
        result.transferred += 1;
      }
      if (handoff.newlyAlerted) {
        result.alerts += 1;
      }
      console.log('[after-hours] mensagem enviada; devolução à fila processada', {
        sessionId: thread.session.id,
        windowId: decision.windowId,
        queueStatus: handoff.outcome.status,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const failedAttempts = messageWasSent ? 0 : (stored?.unassign_attempts ?? 0) + 1;
      const shouldAlert = !messageWasSent && failedAttempts >= 3 && !stored?.alerted_at;
      await upsertAfterHoursNotice({
        pool: options.pool,
        sessionId: thread.session.id,
        windowId: decision.windowId,
        inboundMessageId: decision.inboundMessageId,
        dryRun: false,
        status: messageWasSent ? 'sent_awaiting_unassign' : 'failed',
        error: reason.slice(0, 400),
        departmentId,
        unassignAttempts: failedAttempts,
        nextUnassignAt: nextUnassignRetry(now, Math.max(1, failedAttempts)),
      });
      if (shouldAlert) {
        await markAfterHoursNoticeAlerted({
          pool: options.pool,
          sessionId: thread.session.id,
          windowId: decision.windowId,
        });
        result.alerts += 1;
        try {
          await sendOperationalAlert({
            webhookUrl: options.config.afterHoursAlertWebhookUrl,
            sessionId: thread.session.id,
            windowId: decision.windowId,
            attempts: failedAttempts,
            reason,
          });
        } catch (alertError) {
          console.error('[after-hours] falha ao enviar alerta operacional', {
            sessionId: thread.session.id,
            reason: alertError instanceof Error ? alertError.message : String(alertError),
          });
        }
      }
      if (messageWasSent) {
        result.awaitingUnassign += 1;
      }
      console.warn(messageWasSent
        ? '[after-hours] mensagem enviada; pós-envio pendente, tenta no próximo ciclo'
        : '[after-hours] envio falhou, tenta no próximo ciclo', {
        sessionId: thread.session.id,
        reason,
      });
    }
  }

  return result;
}
