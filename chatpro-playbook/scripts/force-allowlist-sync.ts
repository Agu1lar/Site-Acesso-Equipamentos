/**
 * Force-refresh only DB-known allowlist sessions (no open-inbox hunt).
 */
import { ChatProChatClient } from '../src/chatpro-chat.js';
import { loadPlaybookConfig } from '../src/config.js';
import {
  createPlaybookPool,
  listKnownAfterHoursSessionIds,
  migratePlaybookSchema,
  upsertMessage,
  upsertSession,
} from '../src/db.js';
import {
  phoneKeyFromChatProMessageId,
  phoneKeyFromChatProRecord,
} from '../src/parse-chatpro.js';

const config = loadPlaybookConfig();
const pool = createPlaybookPool(config.databaseUrl);
await migratePlaybookSchema(pool);
const client = new ChatProChatClient({
  instanceId: config.chatproInstanceId,
  instanceToken: config.chatproInstanceToken,
});

const allowed = config.afterHoursAllowedPhones;
const knownSessionIds = await listKnownAfterHoursSessionIds({ pool, allowedPhones: allowed });
console.log('[force-sync] known', knownSessionIds);

for (const sessionId of knownSessionIds) {
  const session = await client.getSession(sessionId);
  if (!session) {
    console.warn('[force-sync] missing session', sessionId);
    continue;
  }
  await upsertSession(pool, session);
  const messages = await client.listMessages(session.id, { maxMessages: 40 });
  for (const message of messages) {
    await upsertMessage(pool, { ...message, sessionId: session.id });
  }
  const phone = messages
    .map((message) => phoneKeyFromChatProRecord(message.raw) ?? phoneKeyFromChatProMessageId(message.id))
    .find((value) => value)
    ?? session.phoneKey;
  if (phone) {
    await upsertSession(pool, { ...session, phoneKey: phone });
  }
  console.log('[force-sync] refreshed', {
    sessionId: session.id,
    phone,
    messages: messages.length,
    latest: messages.at(-1)?.body?.slice(0, 60) ?? null,
  });
}

for (const phone of allowed) {
  const row = await pool.query(
    `SELECT id, phone_key,
            (SELECT left(body, 40) FROM messages m WHERE m.session_id = s.id ORDER BY sent_at DESC NULLS LAST LIMIT 1) AS last_body
     FROM sessions s
     WHERE phone_key = $1
        OR right(regexp_replace(coalesce(phone_key,''), '\\D', '', 'g'), 11) = right($1, 11)
        OR right(regexp_replace(coalesce(phone_key,''), '\\D', '', 'g'), 10) = right($1, 10)
     LIMIT 1`,
    [phone],
  );
  console.log('[force-sync] phone', phone.slice(-4), row.rows[0] ?? null);
}

await pool.end();
