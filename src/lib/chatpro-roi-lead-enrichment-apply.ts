import 'server-only';

import { eq } from 'drizzle-orm';
import {
  resolveLeadContactEnrichment,
} from '@/lib/chatpro-roi-lead-enrichment';
import { linkLeadToClient } from '@/lib/clients';
import type { ChatProRoiEvaluation } from '@/validations/chatpro-roi';
import { db } from '@/libs/DB';
import { leadsSchema } from '@/models/Schema';

/**
 * Applies Claude-detected contact fields onto a lead when current values are empty/placeholder.
 */
export async function applyChatProRoiLeadContactEnrichment(
  leadId: number,
  evaluation: ChatProRoiEvaluation,
) {
  const rows = await db
    .select({
      id: leadsSchema.id,
      name: leadsSchema.name,
      email: leadsSchema.email,
      phone: leadsSchema.phone,
      company: leadsSchema.company,
      lastActivityAt: leadsSchema.lastActivityAt,
      createdAt: leadsSchema.createdAt,
    })
    .from(leadsSchema)
    .where(eq(leadsSchema.id, leadId))
    .limit(1);

  const lead = rows[0];
  if (!lead) {
    return { updated: false as const };
  }

  const enrichment = resolveLeadContactEnrichment({
    currentName: lead.name,
    currentEmail: lead.email,
    detectedContactName: evaluation.detectedContactName,
    detectedEmail: evaluation.detectedEmail,
  });

  if (!enrichment.shouldUpdate) {
    return { updated: false as const };
  }

  const nextName = enrichment.name ?? lead.name;
  const nextEmail = enrichment.email ?? lead.email;

  await db
    .update(leadsSchema)
    .set({
      ...(enrichment.name ? { name: enrichment.name } : {}),
      ...(enrichment.email ? { email: enrichment.email } : {}),
      lastActivityAt: new Date(),
    })
    .where(eq(leadsSchema.id, leadId));

  await linkLeadToClient(
    leadId,
    {
      displayName: nextName,
      email: nextEmail,
      phone: lead.phone,
      company: lead.company,
    },
    new Date(),
  );

  return {
    updated: true as const,
    name: enrichment.name,
    email: enrichment.email,
  };
}
