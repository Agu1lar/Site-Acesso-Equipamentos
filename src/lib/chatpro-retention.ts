import 'server-only';

import { sql } from 'drizzle-orm';
import { db } from '@/libs/DB';

export const CHATPRO_RETENTION_DAYS = 15;

type DeleteResult = {
  rowCount?: number | null;
};

function deletedRowCount(result: DeleteResult) {
  return result.rowCount ?? 0;
}

/**
 * Removes expired ChatPro conversation data while preserving leads and each lead's newest summary.
 * @returns Counts of deleted records and the cutoff applied.
 */
export function cleanupChatProRetention() {
  const cutoff = new Date(Date.now() - CHATPRO_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  return db.transaction(async (tx) => {
    const oldEvaluations = await tx.execute(sql`
      WITH ranked AS (
        SELECT
          id,
          row_number() OVER (
            PARTITION BY lead_id
            ORDER BY evaluated_at DESC, id DESC
          ) AS position
        FROM chatpro_lead_evaluations
      )
      DELETE FROM chatpro_lead_evaluations AS evaluation
      USING ranked
      WHERE evaluation.id = ranked.id
        AND ranked.position > 1
    `);

    const deliveredOutbox = await tx.execute(sql`
      DELETE FROM chatpro_outbox
      WHERE delivered_at IS NOT NULL
        AND delivered_at < ${cutoff}
    `);

    const oldMessages = await tx.execute(sql`
      DELETE FROM chatpro_messages AS message
      WHERE coalesce(message.event_at, message.created_at) < ${cutoff}
        AND NOT EXISTS (
          SELECT 1
          FROM chatpro_outbox AS outbox
          WHERE outbox.message_id = message.id
            AND outbox.delivered_at IS NULL
        )
    `);

    return {
      cutoff,
      deletedEvaluations: deletedRowCount(oldEvaluations),
      deletedOutboxEvents: deletedRowCount(deliveredOutbox),
      deletedMessages: deletedRowCount(oldMessages),
    };
  });
}
