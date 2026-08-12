import { NextResponse } from 'next/server';
import {
  buildChatProRoiReport,
  parseAdsQualityFilters,
  parseSpendJsonParam,
  resolveChatProRoiSpend,
} from '@/lib/chatpro-roi-report';
import { isGoogleAdsApiConfigured } from '@/lib/google-ads-spend';
import { authorizeInternalApi } from '@/lib/internal-api-auth';

export const runtime = 'nodejs';

/** ROI report: CRM won × Claude signals × Google Ads spend (API or manual). */
export async function GET(request: Request) {
  const auth = authorizeInternalApi(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const parsedFilters = parseAdsQualityFilters(searchParams);
  if (!parsedFilters.ok) {
    return NextResponse.json({ error: parsedFilters.error }, { status: parsedFilters.status });
  }

  const spendParsed = parseSpendJsonParam(searchParams.get('spendJson'));
  if (!spendParsed.ok) {
    return NextResponse.json({ error: spendParsed.error }, { status: 400 });
  }

  const useGoogleAdsSpend = searchParams.get('useGoogleAdsSpend') === 'true';
  if (useGoogleAdsSpend && !isGoogleAdsApiConfigured()) {
    return NextResponse.json({ error: 'google_ads_not_configured' }, { status: 503 });
  }

  const spendResolved = await resolveChatProRoiSpend(
    parsedFilters.filters,
    spendParsed.spend,
    useGoogleAdsSpend,
  );

  const report = await buildChatProRoiReport(
    parsedFilters.filters,
    spendResolved.merged,
    spendResolved.spendMeta,
    spendResolved.parts,
  );

  return NextResponse.json(report);
}
