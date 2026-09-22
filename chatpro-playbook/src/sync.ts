import type { Pool } from 'pg';
import { ChatProChatClient } from './chatpro-chat.js';
import type { PlaybookConfig } from './config.js';
import { upsertMessage, upsertSession } from './db.js';
import { phoneKeyFromChatProMessageId, phoneKeyFromChatProRecord } from './parse-chatpro.js';
import type { ParsedChatProSession } from './parse-chatpro.js';
import { takeSessionsForUniqueLeads } from './playbook-leads.js';
import { isAfterHoursPhoneAllowed } from './sandbox.js';

const SESSION_PAGE = 20;
const MAX_SESSION_PAGES = 8;
const EXTRA_PAGES_AFTER_CAP = 2;

async function collectSessionPage(options: {
  client: ChatProChatClient;
  start: Date;
  end: Date;
  open?: boolean;
  seenIds: Set<string>;
  collected: ParsedChatProSession[];
  maxLeads: number;
}) {
  let offset = 0;
  let extraPages = 0;
  for (let page = 0; page < MAX_SESSION_PAGES; page += 1) {
    const batch = await options.client.listSessions({
      start: options.start,
      end: options.end,
      open: options.open,
      limit: SESSION_PAGE,
      offset,
    });
    if (batch.length === 0) {
      break;
    }
    for (const session of batch) {
      if (options.seenIds.has(session.id)) {
        continue;
      }
      options.seenIds.add(session.id);
      options.collected.push(session);
    }
    const taken = takeSessionsForUniqueLeads(options.collected, options.maxLeads);
    if (taken.leadCount >= options.maxLeads) {
      extraPages += 1;
      if (extraPages > EXTRA_PAGES_AFTER_CAP) {
        break;
      }
    }
    if (batch.length < SESSION_PAGE) {
      break;
    }
    offset += SESSION_PAGE;
  }
}

/**
 * Pulls the most recent ChatPro inbox sessions into local Postgres.
 * Caps distinct WhatsApp numbers, not raw sessions, so a transfer is not a new lead.
 */
export async function syncChatProToLocalPostgres(options: {
  pool: Pool;
  config: PlaybookConfig;
  maxMessagesPerSession?: number;
}) {
  if (!options.config.chatproInstanceId || !options.config.chatproInstanceToken) {
    throw new Error(
      'CHATPRO_INSTANCE_ID e CHATPRO_INSTANCE_TOKEN são obrigatórios. Crie o token em Configurações → Desenvolvedor no app ChatPro.',
    );
  }

  const client = new ChatProChatClient({
    instanceId: options.config.chatproInstanceId,
    instanceToken: options.config.chatproInstanceToken,
  });

  const end = new Date();
  const start = new Date(end.getTime() - options.config.lookbackDays * 24 * 60 * 60 * 1000);
  const maxLeads = options.config.maxSessions;
  const collected: ParsedChatProSession[] = [];
  const seenIds = new Set<string>();

  await collectSessionPage({
    client,
    start,
    end,
    open: true,
    seenIds,
    collected,
    maxLeads,
  });
  await collectSessionPage({
    client,
    start,
    end,
    seenIds,
    collected,
    maxLeads,
  });

  const unique = takeSessionsForUniqueLeads(collected, maxLeads);
  let messageCount = 0;

  for (const session of unique.sessions) {
    await upsertSession(options.pool, session);
    try {
      const messages = await client.listMessages(session.id, {
        maxMessages: options.maxMessagesPerSession,
      });
      for (const message of messages) {
        await upsertMessage(options.pool, { ...message, sessionId: session.id });
      }
      const phoneFromChat = messages
        .map((message) => phoneKeyFromChatProRecord(message.raw))
        .find((phone) => phone);
      if (phoneFromChat && phoneFromChat !== session.phoneKey) {
        await upsertSession(options.pool, { ...session, phoneKey: phoneFromChat });
      }
      messageCount += messages.length;
      console.log('[chatpro-playbook] sessão sincronizada', {
        sessionId: session.id,
        messages: messages.length,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn('[chatpro-playbook] sessão falhou, segue', { sessionId: session.id, reason });
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  return {
    sessionCount: unique.sessions.length,
    leadCount: unique.leadCount,
    messageCount,
  };
}

export type AfterHoursSyncCandidate = {
  id: string;
  lastUpdateMs: number;
  known: boolean;
};

/**
 * Keeps known pilot chats plus only the last couple of minutes of inbox activity.
 */
export function pickAfterHoursSessionsToSync(options: {
  sessions: AfterHoursSyncCandidate[];
  nowMs: number;
  recentMs: number;
  limit: number;
}) {
  const recent = options.sessions.filter((session) => (
    session.known
    || options.nowMs - session.lastUpdateMs <= options.recentMs
  ));
  const known = recent.filter((session) => session.known);
  const fresh = recent
    .filter((session) => !session.known)
    .sort((left, right) => right.lastUpdateMs - left.lastUpdateMs);
  const picked = [...known];
  for (const session of fresh) {
    if (picked.length >= options.limit) {
      break;
    }
    if (!picked.some((item) => item.id === session.id)) {
      picked.push(session);
    }
  }
  return picked.map((session) => session.id);
}

function readSessionLastUpdateMs(session: ParsedChatProSession) {
  const raw = session.raw.last_update;
  if (typeof raw === 'string') {
    const ms = Date.parse(raw);
    if (Number.isFinite(ms)) {
      return ms;
    }
  }
  return 0;
}

async function persistSessionMessages(options: {
  pool: Pool;
  client: ChatProChatClient;
  session: ParsedChatProSession;
  maxMessages: number;
}) {
  await upsertSession(options.pool, options.session);
  const messages = await options.client.listMessages(options.session.id, {
    maxMessages: options.maxMessages,
  });
  for (const message of messages) {
    await upsertMessage(options.pool, { ...message, sessionId: options.session.id });
  }
  const phoneFromChat = messages
    .map((message) => phoneKeyFromChatProRecord(message.raw) ?? phoneKeyFromChatProMessageId(message.id))
    .find((phone) => phone);
  if (phoneFromChat && phoneFromChat !== options.session.phoneKey) {
    await upsertSession(options.pool, { ...options.session, phoneKey: phoneFromChat });
  }
  return { messages: messages.length, phoneKey: phoneFromChat ?? options.session.phoneKey };
}

/**
 * Syncs recently active ChatPro chats for the after-hours worker, including URA
 * conversations that the playbook 40-lead cap can drop.
 */
export async function syncRecentChatProSessions(options: {
  pool: Pool;
  config: PlaybookConfig;
  allowedPhones?: string[];
  knownSessionIds?: string[];
  knownSessionsOnly?: boolean;
  recentMs?: number;
  maxMessagesPerSession?: number;
}) {
  if (!options.config.chatproInstanceId || !options.config.chatproInstanceToken) {
    throw new Error(
      'CHATPRO_INSTANCE_ID e CHATPRO_INSTANCE_TOKEN são obrigatórios. Crie o token em Configurações → Desenvolvedor no app ChatPro.',
    );
  }

  const client = new ChatProChatClient({
    instanceId: options.config.chatproInstanceId,
    instanceToken: options.config.chatproInstanceToken,
  });
  const end = new Date();
  const start = new Date(end.getTime() - options.config.lookbackDays * 24 * 60 * 60 * 1000);
  const seenIds = new Set<string>();
  const collected: ParsedChatProSession[] = [];
  const recentMs = options.recentMs ?? 2 * 60 * 1000;
  const maxMessages = options.maxMessagesPerSession ?? 40;
  const knownIds = options.knownSessionIds ?? [];

  for (const sessionId of knownIds) {
    try {
      const session = await client.getSession(sessionId);
      if (!session || seenIds.has(session.id)) {
        continue;
      }
      seenIds.add(session.id);
      collected.push(session);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn('[after-hours] getSession falhou', { sessionId, reason });
    }
  }

  if (!options.knownSessionsOnly) {
    try {
      const batch = await client.listSessions({
        start,
        end,
        open: true,
        limit: SESSION_PAGE,
        offset: 0,
      });
      for (const session of batch) {
        if (seenIds.has(session.id)) {
          continue;
        }
        seenIds.add(session.id);
        collected.push(session);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn('[after-hours] listSessions recente falhou', { reason });
    }
  }

  // DB-known allowlist chats always sync. ChatPro ignores `number=` filters, so we
  // do not probe the whole inbox here (that hangs on rate limits). Fresh open chats
  // still sync via recentMs; phone_key is backfilled from messages/wamid on persist.
  const knownSet = new Set(knownIds);
  if ((options.allowedPhones?.length ?? 0) > 0 && knownIds.length === 0) {
    console.warn('[after-hours] allowlist sem sessão conhecida no Postgres', {
      phones: (options.allowedPhones ?? []).map((phone) => phone.slice(-4)),
    });
  } else if ((options.allowedPhones?.length ?? 0) > 0) {
    for (const sessionId of knownIds) {
      console.log('[after-hours] allowlist known', {
        sessionId,
      });
    }
  }

  const pickedIds = new Set(pickAfterHoursSessionsToSync({
    sessions: collected.map((session) => ({
      id: session.id,
      lastUpdateMs: readSessionLastUpdateMs(session),
      known: knownSet.has(session.id),
    })),
    nowMs: end.getTime(),
    recentMs,
    limit: Math.max(knownSet.size + 2, 6),
  }));
  const recent = options.knownSessionsOnly
    ? collected
    : collected.filter((session) => pickedIds.has(session.id));

  let messageCount = 0;
  for (const session of recent) {
    try {
      const persisted = await persistSessionMessages({
        pool: options.pool,
        client,
        session,
        maxMessages,
      });
      messageCount += persisted.messages;
      if (
        persisted.phoneKey
        && isAfterHoursPhoneAllowed({
          phoneKey: persisted.phoneKey,
          allowedPhones: options.allowedPhones ?? [],
          allowAll: false,
        })
      ) {
        knownSet.add(session.id);
      }
      console.log('[after-hours] sessão recente', {
        sessionId: session.id,
        messages: persisted.messages,
        last4: persisted.phoneKey?.slice(-4) ?? null,
        bot: session.raw.bot_active === true,
        allowlist: knownSet.has(session.id),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn('[after-hours] sessão recente falhou', { sessionId: session.id, reason });
    }
  }

  return {
    listed: collected.length,
    synced: recent.length,
    messageCount,
    allowlistSynced: [...knownSet],
  };
}
