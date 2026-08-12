import { z } from 'zod';

export const ChatProRoiStageSchema = z.enum([
  'inquiry',
  'negotiation',
  'proposal_sent',
  'contract_sent',
  'closed_won',
  'closed_lost',
  'stalled',
  'unknown',
]);

export const ChatProRoiEvaluationSchema = z.object({
  stage: ChatProRoiStageSchema,
  intentScore: z.number().min(0).max(100),
  dealLikelihood: z.number().min(0).max(100),
  estimatedMonthlyValueBrl: z.number().min(0).nullable(),
  contractDetected: z.boolean(),
  contractConsistent: z.boolean().nullable(),
  contractNotes: z.string().nullable(),
  equipmentMentioned: z.array(z.string()).max(8),
  summary: z.string().min(20).max(1200),
  suggestedStatus: z.enum(['new', 'contacted', 'qualified', 'won', 'lost']).nullable(),
  roiNotes: z.string().max(800),
  followUpPriority: z.enum(['low', 'medium', 'high']),
});

export type ChatProRoiEvaluation = z.infer<typeof ChatProRoiEvaluationSchema>;

export function buildChatProRoiOutputSchema() {
  return {
    type: 'object',
    properties: {
      stage: {
        type: 'string',
        enum: [
          'inquiry',
          'negotiation',
          'proposal_sent',
          'contract_sent',
          'closed_won',
          'closed_lost',
          'stalled',
          'unknown',
        ],
      },
      intentScore: { type: 'integer', description: '0-100 intenção comercial.' },
      dealLikelihood: { type: 'integer', description: '0-100 chance de fechamento.' },
      estimatedMonthlyValueBrl: {
        type: ['number', 'null'],
        description: 'Valor mensal estimado em BRL ou null se não houver base.',
      },
      contractDetected: { type: 'boolean' },
      contractConsistent: {
        type: ['boolean', 'null'],
        description: 'Se contrato PDF bate com a conversa; null sem PDF.',
      },
      contractNotes: { type: ['string', 'null'] },
      equipmentMentioned: {
        type: 'array',
        items: { type: 'string' },
        description: 'Equipamentos citados (plataforma, guindaste, etc.).',
      },
      summary: { type: 'string' },
      suggestedStatus: {
        anyOf: [
          {
            type: 'string',
            enum: ['new', 'contacted', 'qualified', 'won', 'lost'],
          },
          { type: 'null' },
        ],
      },
      roiNotes: { type: 'string', description: 'Notas curtas para ROI / campanha Ads.' },
      followUpPriority: { type: 'string', enum: ['low', 'medium', 'high'] },
    },
    required: [
      'stage',
      'intentScore',
      'dealLikelihood',
      'estimatedMonthlyValueBrl',
      'contractDetected',
      'contractConsistent',
      'contractNotes',
      'equipmentMentioned',
      'summary',
      'suggestedStatus',
      'roiNotes',
      'followUpPriority',
    ],
    additionalProperties: false,
  };
}
