import { z } from 'zod';

export const ChatProOutboxAckSchema = z.object({
  outboxIds: z.array(z.number().int().positive()).min(1).max(200),
});

export type ChatProOutboxAckInput = z.infer<typeof ChatProOutboxAckSchema>;

export const ChatProRoiEvaluationSubmitSchema = z.object({
  leadId: z.number().int().positive(),
  messageCount: z.number().int().min(0),
  lastMessageId: z.number().int().positive().nullable(),
  model: z.string().min(1).max(80),
  trigger: z.enum(['local_consumer', 'daily_worker', 'manual']).default('local_consumer'),
  result: z.record(z.string(), z.unknown()),
});

export type ChatProRoiEvaluationSubmitInput = z.infer<typeof ChatProRoiEvaluationSubmitSchema>;
