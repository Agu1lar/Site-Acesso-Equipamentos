export const ANALYTICS_SECTIONS = [
  'visao-geral',
  'conversao',
  'catalogo',
  'trafego',
  'comportamento',
  'executivo',
] as const;

export type AnalyticsSectionId = (typeof ANALYTICS_SECTIONS)[number];

export const ANALYTICS_DATA_TYPES = [
  'count',
  'rate',
  'ranking',
  'funnel',
  'timeseries',
  'breakdown',
  'table',
] as const;

export type AnalyticsDataType = (typeof ANALYTICS_DATA_TYPES)[number];

export function parseAnalyticsSection(value: string | undefined): AnalyticsSectionId {
  if (value && ANALYTICS_SECTIONS.includes(value as AnalyticsSectionId)) {
    return value as AnalyticsSectionId;
  }

  return 'visao-geral';
}
