import 'server-only';

import { and, desc, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import {
  type AdsQualityFilters,
  parseAdsQualityFilters,
} from '@/lib/ads-quality-api';
import { googleAdsCampaignSpendKey } from '@/lib/google-ads-spend';
import { db } from '@/libs/DB';
import { chatproLeadEvaluationsSchema, leadsSchema } from '@/models/Schema';
import type { ChatProRoiEvaluation } from '@/validations/chatpro-roi';

export type CampaignSpendMap = Record<string, number>;

export type ChatProRoiCampaignMetrics = {
  campaign: string;
  leads: number;
  withEvaluation: number;
  crmWon: number;
  aiClosedWon: number;
  aiContractSent: number;
  aiHighIntent: number;
  estimatedMonthlyValueBrl: number;
  spendBrl: number | null;
  costPerLeadBrl: number | null;
  costPerCrmWonBrl: number | null;
  costPerAiWonBrl: number | null;
  estimatedRoas: number | null;
};

export type ChatProRoiReportHighlight = {
  leadId: number;
  campaign: string;
  status: string;
  stage: string;
  dealLikelihood: number;
  estimatedMonthlyValueBrl: number | null;
  summary: string;
};

export type ChatProRoiReport = {
  period: {
    dateFrom: string;
    dateTo: string;
    timezone: 'America/Sao_Paulo';
  };
  filters: {
    campaignPrefix: string;
    source: string | null;
    medium: string | null;
  };
  spendProvided: boolean;
  spendSource: 'none' | 'manual' | 'google_ads' | 'merged';
  spendMeta: {
    googleAdsCurrency: string | null;
    googleAdsCampaignsMatched: number | null;
  };
  campaigns: ChatProRoiCampaignMetrics[];
  totals: ChatProRoiCampaignMetrics;
  highlights: {
    aiClosedWon: ChatProRoiReportHighlight[];
    highValuePipeline: ChatProRoiReportHighlight[];
  };
};

function campaignKey(value: string | null) {
  return value?.trim() || '(sem campanha)';
}

function normalizeCampaignKey(value: string) {
  return value.trim().toLowerCase();
}

function ratioValue(part: number, whole: number) {
  if (whole <= 0) {
    return null;
  }
  return Number((part / whole).toFixed(2));
}

function compactConditions(conditions: (SQL | undefined)[]) {
  const compacted: SQL[] = [];
  for (const condition of conditions) {
    if (condition) {
      compacted.push(condition);
    }
  }
  return compacted;
}

function campaignPrefixWhere(column: typeof leadsSchema.utmCampaign, prefix: string) {
  return sql`lower(trim(coalesce(${column}, ''))) like ${`${prefix.toLowerCase()}%`}`;
}

function optionalExactTextWhere(
  column: typeof leadsSchema.utmSource | typeof leadsSchema.utmMedium,
  value: string | undefined,
) {
  if (!value) {
    return;
  }
  return sql`lower(trim(coalesce(${column}, ''))) = ${value.toLowerCase()}`;
}

function leadWhere(filters: AdsQualityFilters) {
  return and(
    ...compactConditions([
      ne(leadsSchema.leadKind, 'cookie_consent'),
      gte(leadsSchema.createdAt, filters.fromUtc),
      lte(leadsSchema.createdAt, filters.toUtc),
      campaignPrefixWhere(leadsSchema.utmCampaign, filters.campaignPrefix),
      optionalExactTextWhere(leadsSchema.utmSource, filters.source),
      optionalExactTextWhere(leadsSchema.utmMedium, filters.medium),
    ]),
  );
}

function emptyCampaignMetrics(campaign: string): ChatProRoiCampaignMetrics {
  return {
    campaign,
    leads: 0,
    withEvaluation: 0,
    crmWon: 0,
    aiClosedWon: 0,
    aiContractSent: 0,
    aiHighIntent: 0,
    estimatedMonthlyValueBrl: 0,
    spendBrl: null,
    costPerLeadBrl: null,
    costPerCrmWonBrl: null,
    costPerAiWonBrl: null,
    estimatedRoas: null,
  };
}

/** Parses spend map from JSON (campaign name → BRL). Keys are case-insensitive. */
export function parseCampaignSpendMap(input: unknown): CampaignSpendMap {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const spend: CampaignSpendMap = {};
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = rawKey.trim();
    if (!key) {
      continue;
    }
    const amount = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    if (!Number.isFinite(amount) || amount < 0) {
      continue;
    }
    spend[normalizeCampaignKey(key)] = amount;
  }

  return spend;
}

/** Parses optional `spendJson` query param (URL-encoded JSON object). */
export function parseSpendJsonParam(value: string | null) {
  if (!value?.trim()) {
    return { ok: true as const, spend: {} as CampaignSpendMap };
  }

  try {
    const decoded = decodeURIComponent(value.trim());
    const parsed = JSON.parse(decoded) as unknown;
    return { ok: true as const, spend: parseCampaignSpendMap(parsed) };
  } catch {
    return { ok: false as const, error: 'invalid_spend_json' as const };
  }
}

function readEvaluationResult(raw: Record<string, unknown> | null | undefined): ChatProRoiEvaluation | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const stage = raw.stage;
  if (typeof stage !== 'string') {
    return null;
  }

  return {
    stage: stage as ChatProRoiEvaluation['stage'],
    intentScore: Number(raw.intentScore) || 0,
    dealLikelihood: Number(raw.dealLikelihood) || 0,
    estimatedMonthlyValueBrl:
      raw.estimatedMonthlyValueBrl === null || raw.estimatedMonthlyValueBrl === undefined
        ? null
        : Number(raw.estimatedMonthlyValueBrl),
    contractDetected: Boolean(raw.contractDetected),
    contractConsistent:
      raw.contractConsistent === null || raw.contractConsistent === undefined
        ? null
        : Boolean(raw.contractConsistent),
    contractNotes: typeof raw.contractNotes === 'string' ? raw.contractNotes : null,
    equipmentMentioned: Array.isArray(raw.equipmentMentioned)
      ? raw.equipmentMentioned.filter((item): item is string => typeof item === 'string')
      : [],
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    suggestedStatus:
      raw.suggestedStatus === 'new'
      || raw.suggestedStatus === 'contacted'
      || raw.suggestedStatus === 'qualified'
      || raw.suggestedStatus === 'won'
      || raw.suggestedStatus === 'lost'
        ? raw.suggestedStatus
        : null,
    roiNotes: typeof raw.roiNotes === 'string' ? raw.roiNotes : '',
    followUpPriority:
      raw.followUpPriority === 'low' || raw.followUpPriority === 'medium' || raw.followUpPriority === 'high'
        ? raw.followUpPriority
        : 'low',
  };
}

function resolveSpendForCampaign(campaign: string, spendMap: CampaignSpendMap) {
  const candidates = [
    normalizeCampaignKey(campaign),
    googleAdsCampaignSpendKey(campaign),
    normalizeCampaignKey(campaign.replace(/\s+/g, '_')),
  ];

  for (const key of candidates) {
    const value = spendMap[key];
    if (value !== undefined) {
      return value;
    }
  }

  return null;
}

/** Merges Google Ads spend with manual overrides (manual wins). */
export function mergeCampaignSpendMaps(
  googleAdsSpend: CampaignSpendMap,
  manualSpend: CampaignSpendMap,
): CampaignSpendMap {
  return { ...googleAdsSpend, ...manualSpend };
}

function detectSpendSource(
  manualSpend: CampaignSpendMap,
  googleAdsSpend: CampaignSpendMap,
): ChatProRoiReport['spendSource'] {
  const hasManual = Object.keys(manualSpend).length > 0;
  const hasGoogle = Object.keys(googleAdsSpend).length > 0;
  if (hasManual && hasGoogle) {
    return 'merged';
  }
  if (hasManual) {
    return 'manual';
  }
  if (hasGoogle) {
    return 'google_ads';
  }
  return 'none';
}

function finalizeCampaignMetrics(row: ChatProRoiCampaignMetrics): ChatProRoiCampaignMetrics {
  const spend = row.spendBrl;
  return {
    ...row,
    costPerLeadBrl: spend !== null ? ratioValue(spend, row.leads) : null,
    costPerCrmWonBrl: spend !== null ? ratioValue(spend, row.crmWon) : null,
    costPerAiWonBrl: spend !== null ? ratioValue(spend, row.aiClosedWon) : null,
    estimatedRoas:
      spend !== null && spend > 0 && row.estimatedMonthlyValueBrl > 0
        ? Number((row.estimatedMonthlyValueBrl / spend).toFixed(2))
        : null,
  };
}

function sumCampaignMetrics(rows: ChatProRoiCampaignMetrics[]): ChatProRoiCampaignMetrics {
  const totals = emptyCampaignMetrics('(total)');
  let spendSum = 0;
  let hasSpend = false;

  for (const row of rows) {
    totals.leads += row.leads;
    totals.withEvaluation += row.withEvaluation;
    totals.crmWon += row.crmWon;
    totals.aiClosedWon += row.aiClosedWon;
    totals.aiContractSent += row.aiContractSent;
    totals.aiHighIntent += row.aiHighIntent;
    totals.estimatedMonthlyValueBrl += row.estimatedMonthlyValueBrl;
    if (row.spendBrl !== null) {
      hasSpend = true;
      spendSum += row.spendBrl;
    }
  }

  totals.spendBrl = hasSpend ? Number(spendSum.toFixed(2)) : null;
  return finalizeCampaignMetrics(totals);
}

/**
 * Builds ROI report crossing CRM leads, Claude evaluations and optional Ads spend.
 * @param filters Same filters as ads-quality (campaignPrefix required).
 * @param spendByCampaign Map utm_campaign → spend BRL in period.
 * @param spendMeta Optional metadata from Google Ads fetch.
 */
export async function buildChatProRoiReport(
  filters: AdsQualityFilters,
  spendByCampaign: CampaignSpendMap = {},
  spendMeta: ChatProRoiReport['spendMeta'] = {
    googleAdsCurrency: null,
    googleAdsCampaignsMatched: null,
  },
  spendParts: { manual: CampaignSpendMap; googleAds: CampaignSpendMap } = {
    manual: {},
    googleAds: {},
  },
): Promise<ChatProRoiReport> {
  const leadRows = await db
    .select({
      id: leadsSchema.id,
      status: leadsSchema.status,
      utmCampaign: leadsSchema.utmCampaign,
    })
    .from(leadsSchema)
    .where(leadWhere(filters));

  const leadIds = leadRows.map((row) => row.id);
  const evaluationRows = leadIds.length > 0
    ? await db
        .select({
          leadId: chatproLeadEvaluationsSchema.leadId,
          result: chatproLeadEvaluationsSchema.result,
          evaluatedAt: chatproLeadEvaluationsSchema.evaluatedAt,
        })
        .from(chatproLeadEvaluationsSchema)
        .where(inArray(chatproLeadEvaluationsSchema.leadId, leadIds))
        .orderBy(desc(chatproLeadEvaluationsSchema.evaluatedAt))
    : [];

  const latestEvalByLead = new Map<number, ChatProRoiEvaluation>();
  for (const row of evaluationRows) {
    if (latestEvalByLead.has(row.leadId)) {
      continue;
    }
    const parsed = readEvaluationResult(row.result);
    if (parsed) {
      latestEvalByLead.set(row.leadId, parsed);
    }
  }

  const campaigns = new Map<string, ChatProRoiCampaignMetrics>();
  const highlights: ChatProRoiReportHighlight[] = [];

  for (const lead of leadRows) {
    const key = campaignKey(lead.utmCampaign);
    const bucket = campaigns.get(key) ?? emptyCampaignMetrics(key);
    bucket.leads += 1;

    if (lead.status === 'won') {
      bucket.crmWon += 1;
    }

    const evaluation = latestEvalByLead.get(lead.id);
    if (evaluation) {
      bucket.withEvaluation += 1;

      if (evaluation.stage === 'closed_won') {
        bucket.aiClosedWon += 1;
      }
      if (evaluation.stage === 'contract_sent' || evaluation.stage === 'closed_won') {
        bucket.aiContractSent += 1;
      }
      if (evaluation.dealLikelihood >= 70) {
        bucket.aiHighIntent += 1;
      }
      if (evaluation.estimatedMonthlyValueBrl && evaluation.estimatedMonthlyValueBrl > 0) {
        bucket.estimatedMonthlyValueBrl += evaluation.estimatedMonthlyValueBrl;
      }

      if (
        evaluation.stage === 'closed_won'
        || (evaluation.estimatedMonthlyValueBrl && evaluation.estimatedMonthlyValueBrl > 0)
      ) {
        highlights.push({
          leadId: lead.id,
          campaign: key,
          status: lead.status,
          stage: evaluation.stage,
          dealLikelihood: evaluation.dealLikelihood,
          estimatedMonthlyValueBrl: evaluation.estimatedMonthlyValueBrl,
          summary: evaluation.summary,
        });
      }
    }

    campaigns.set(key, bucket);
  }

  const campaignRows = [...campaigns.values()]
    .map((row) => {
      const spend = resolveSpendForCampaign(row.campaign, spendByCampaign);
      return finalizeCampaignMetrics({
        ...row,
        estimatedMonthlyValueBrl: Number(row.estimatedMonthlyValueBrl.toFixed(2)),
        spendBrl: spend,
      });
    })
    .toSorted((a, b) => b.estimatedMonthlyValueBrl - a.estimatedMonthlyValueBrl || b.leads - a.leads);

  const aiClosedWon = highlights
    .filter((row) => row.stage === 'closed_won')
    .toSorted((a, b) => (b.estimatedMonthlyValueBrl ?? 0) - (a.estimatedMonthlyValueBrl ?? 0))
    .slice(0, 20);

  const highValuePipeline = highlights
    .filter((row) => row.stage !== 'closed_won' && (row.estimatedMonthlyValueBrl ?? 0) > 0)
    .toSorted((a, b) => (b.estimatedMonthlyValueBrl ?? 0) - (a.estimatedMonthlyValueBrl ?? 0))
    .slice(0, 20);

  return {
    period: {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      timezone: 'America/Sao_Paulo',
    },
    filters: {
      campaignPrefix: filters.campaignPrefix,
      source: filters.source ?? null,
      medium: filters.medium ?? null,
    },
    spendProvided: Object.keys(spendByCampaign).length > 0,
    spendSource: detectSpendSource(spendParts.manual, spendParts.googleAds),
    spendMeta,
    campaigns: campaignRows,
    totals: sumCampaignMetrics(campaignRows),
    highlights: {
      aiClosedWon,
      highValuePipeline,
    },
  };
}

export { parseAdsQualityFilters };

/**
 * Resolves spend from Google Ads API and/or manual map for the ROI report.
 * @param filters Report date range and campaign prefix.
 * @param manualSpend Manual overrides (win over Google Ads keys).
 * @param useGoogleAdsSpend When true, fetches live spend from Google Ads API.
 */
export async function resolveChatProRoiSpend(
  filters: AdsQualityFilters,
  manualSpend: CampaignSpendMap,
  useGoogleAdsSpend: boolean,
) {
  let googleAdsSpend: CampaignSpendMap = {};
  let spendMeta: ChatProRoiReport['spendMeta'] = {
    googleAdsCurrency: null,
    googleAdsCampaignsMatched: null,
  };

  if (useGoogleAdsSpend) {
    const { fetchGoogleAdsCampaignSpend } = await import('@/lib/google-ads-spend');
    const adsResult = await fetchGoogleAdsCampaignSpend({
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      campaignPrefix: filters.campaignPrefix,
    });
    googleAdsSpend = adsResult.spendByCampaign;
    spendMeta = {
      googleAdsCurrency: adsResult.currencyCode,
      googleAdsCampaignsMatched: adsResult.campaignsMatched,
    };
  }

  return {
    merged: mergeCampaignSpendMaps(googleAdsSpend, manualSpend),
    spendMeta,
    parts: { manual: manualSpend, googleAds: googleAdsSpend },
  };
}
