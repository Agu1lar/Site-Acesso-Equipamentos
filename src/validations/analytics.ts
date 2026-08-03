import * as z from 'zod';
import { AttributionSchema } from '@/lib/attribution';
import { VisitorGeoSchema } from '@/lib/visitor-geo';

const AnalyticsEventFieldsSchema = z.object({
  origin: z.string().min(1).max(80).optional(),
  equipmentSlug: z.string().max(120).optional(),
  equipmentName: z.string().max(300).optional(),
  pathname: z.string().max(500).optional(),
  device: z.enum(['mobile', 'desktop']).optional(),
  analyticsConsent: z.boolean().optional(),
  attribution: AttributionSchema.optional(),
  visitorGeo: VisitorGeoSchema.optional(),
});

const ConversionEventSchema = AnalyticsEventFieldsSchema.extend({
  eventType: z.enum([
    'equipment_view',
    'add_to_quote',
    'remove_from_quote',
    'quote_abandon',
    'category_filter',
    'search',
    'scroll_depth',
  ]),
});

export const AnalyticsEventSchema = z.union([
  AnalyticsEventFieldsSchema.extend({
    eventType: z.literal('whatsapp_click'),
    origin: z.string().min(1).max(80),
  }),
  AnalyticsEventFieldsSchema.extend({
    eventType: z.literal('phone_click'),
    origin: z.string().min(1).max(80),
  }),
  ConversionEventSchema,
]);

export type AnalyticsEventInput = z.infer<typeof AnalyticsEventSchema>;
