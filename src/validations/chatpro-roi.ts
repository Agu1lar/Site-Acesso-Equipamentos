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
  suggestedStatus: z.preprocess(
    (value) => (value === 'qualified' ? 'quoted' : value),
    z.enum(['new', 'contacted', 'quoted', 'won', 'lost']).nullable(),
  ),
  detectedContactName: z
    .string()
    .trim()
    .min(2)
    .max(200)
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  detectedEmail: z
    .string()
    .trim()
    .email()
    .max(320)
    .nullable()
    .optional()
    .transform((value) => value ?? null),
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
            enum: ['new', 'contacted', 'quoted', 'won', 'lost'],
          },
          { type: 'null' },
        ],
      },
      detectedContactName: {
        anyOf: [
          {
            type: 'string',
            description: 'Nome real do cliente se ele se identificou claramente no chat; null se não houver.',
          },
          { type: 'null' },
        ],
      },
      detectedEmail: {
        anyOf: [
          {
            type: 'string',
            description: 'E-mail explícito dito no chat; null se não houver. Nunca invente.',
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
      'detectedContactName',
      'detectedEmail',
      'roiNotes',
      'followUpPriority',
    ],
    additionalProperties: false,
  };
}
