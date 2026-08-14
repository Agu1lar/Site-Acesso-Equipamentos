import 'server-only';

import { desc, eq } from 'drizzle-orm';
import { ChatProRoiEvaluationSchema } from '@/validations/chatpro-roi';
import { db } from '@/libs/DB';
import { chatproLeadEvaluationsSchema } from '@/models/Schema';

/**
 * Returns the latest Claude ROI stage saved for a lead, if any.
 */
export async function loadLastRoiEvaluationStage(leadId: number) {
  const rows = await db
    .select({ result: chatproLeadEvaluationsSchema.result })
    .from(chatproLeadEvaluationsSchema)
    .where(eq(chatproLeadEvaluationsSchema.leadId, leadId))
    .orderBy(desc(chatproLeadEvaluationsSchema.evaluatedAt))
    .limit(1);

  const parsed = ChatProRoiEvaluationSchema.safeParse(rows[0]?.result);
  return parsed.success ? parsed.data.stage : null;
}
