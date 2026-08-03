import type { ExecutiveSummary } from '@/lib/analytics-executive-types';
import type {
  ConversionFunnelStep,
  QuoteAbandonSummary,
} from '@/lib/analytics-funnel';
import type {
  CampaignDailyLeadsRow,
  CampaignPerformanceRow,
} from '@/lib/campaign-analytics';
import type { EquipmentConversionRow } from '@/lib/equipment-conversion-analytics';

export type AnalyticsDashboardFilters = {
  dateFrom?: string;
  dateTo?: string;
  compareDateFrom?: string;
  compareDateTo?: string;
};

type CountRow = { label: string; count: number };

export type PageEngagementRow = {
  pathname: string;
  /** Original URL when the display label differs (tooltip). */
  pathnameDetail?: string;
  views: number;
  totalActiveSeconds: number;
  avgActiveSeconds: number;
};

export type OperationalDashboard = {
  period: { dateFrom: string; dateTo: string };
  comparisonPeriod: { dateFrom: string; dateTo: string };
  comparisonMode: 'auto' | 'custom';
  /** @deprecated Use comparisonPeriod — kept for compatibility. */
  previousPeriod: { dateFrom: string; dateTo: string };
  pageViews: number;
  uniqueSessions: number;
  pageViewsPrevious: number;
  uniqueSessionsPrevious: number;
  totalActiveSeconds: number;
  totalActiveSecondsPrevious: number;
  whatsappClicks: number;
  /** WhatsApp clicks with analytics cookies accepted (eligible for Google Ads). */
  whatsappClicksWithConsent: number;
  quoteSubmits: number;
  cookieConsentLeads: number;
  whatsappClicksPrevious: number;
  quoteSubmitsPrevious: number;
  phoneClicks: number;
  phoneClicksPrevious: number;
  whatsappByOrigin: CountRow[];
  phoneByOrigin: CountRow[];
  trafficBySource: CountRow[];
  campaignPerformance: CampaignPerformanceRow[];
  campaignDailyLeads: CampaignDailyLeadsRow[];
  topEquipmentWhatsapp: CountRow[];
  topEquipmentLeads: CountRow[];
  topPages: PageEngagementRow[];
  equipmentConversion: EquipmentConversionRow[];
  landingPages: CountRow[];
  deviceSplit: CountRow[];
  conversionFunnel: ConversionFunnelStep[];
  leadReplyFunnel: ConversionFunnelStep[];
  quoteAbandon: QuoteAbandonSummary;
  topSearchTerms: CountRow[];
  scrollDepth: CountRow[];
  topEquipmentViews: CountRow[];
  topCategoryFilters: CountRow[];
  executive: ExecutiveSummary;
  posthogHint: boolean;
  /** True when some analytics tables/columns were missing and fallbacks were used. */
  schemaIncomplete?: boolean;
};

export type AnalyticsDashboardProbeStep = {
  id: string;
  label: string;
  status: 'ok' | 'error';
  durationMs: number;
  error?: string;
  cause?: string;
};

export type AnalyticsDashboardProbeResult = {
  ok: boolean;
  failedStepId?: string;
  steps: AnalyticsDashboardProbeStep[];
};
