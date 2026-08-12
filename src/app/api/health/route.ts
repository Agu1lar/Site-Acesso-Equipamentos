import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { brand } from '@/lib/brand';
import { legacyRedirectStats } from '@/lib/legacy-redirects';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { getBaseUrl } from '@/utils/Helpers';

/**
 * Lightweight operational health for go-live checks (DB, redirects, Resend).
 */
export async function GET() {
  let database: 'ok' | 'error' = 'error';
  let dashboardUsersTable: 'ok' | 'missing' | 'error' = 'error';
  let dashboardPasswordColumn: 'ok' | 'missing' | 'error' = 'error';

  try {
    await db.execute(sql`select 1`);
    database = 'ok';
  } catch {
    database = 'error';
  }

  if (database === 'ok') {
    try {
      await db.execute(sql`select 1 from dashboard_allowlist limit 1`);
      dashboardUsersTable = 'ok';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      dashboardUsersTable =
        /does not exist|relation/u.test(message) || /42P01/u.test(message) ? 'missing' : 'error';
    }

    try {
      await db.execute(sql`select password_hash from dashboard_allowlist limit 1`);
      dashboardPasswordColumn = 'ok';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      dashboardPasswordColumn =
        /password_hash/u.test(message) && (/does not exist|column/u.test(message) || /42703/u.test(message))
          ? 'missing'
          : 'error';
    }
  }

  const resendConfigured = Boolean(Env.RESEND_API_KEY?.startsWith('re_'));
  const googleClientIdConfigured = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim());
  const ga4Configured = Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim());
  const googleAdsConfigured = Boolean(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim());
  const googleAdsLeadConversionConfigured = Boolean(
    process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LEAD?.trim(),
  );
  const googleAdsWhatsAppConversionConfigured = Boolean(
    process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_WHATSAPP?.trim(),
  );
  const posthogConfigured = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim());
  const databaseUsesPooler = Env.DATABASE_URL.includes('-pooler');
  const dashboardSessionConfigured = Boolean(
    (Env.DASHBOARD_SESSION_SECRET ?? process.env.DASHBOARD_SESSION_SECRET)?.length,
  );

  const redirectStats = legacyRedirectStats();

  return NextResponse.json({
    ok:
      database === 'ok' &&
      dashboardUsersTable === 'ok' &&
      dashboardPasswordColumn === 'ok' &&
      dashboardSessionConfigured,
    vercelEnv: Env.VERCEL_ENV ?? 'unknown',
    auth: {
      mode: 'dashboard_password',
      sessionSecretConfigured: dashboardSessionConfigured,
    },
    legacyRedirects: {
      exactCount: redirectStats.exact,
      prefixCount: redirectStats.prefix,
      generatedAt: redirectStats.generatedAt,
    },
    database,
    databaseUsesPooler,
    dashboardUsersTable,
    dashboardPasswordColumn,
    resendConfigured,
    googleClientIdConfigured,
    googleOneTap: {
      clientIdConfigured: googleClientIdConfigured,
      requiresAnalyticsConsentBeforePrompt: true,
      leadEndpoint: 'POST /api/leads/cookie-consent',
      promptTelemetryEndpoint: 'POST /api/analytics/one-tap',
      checklistDoc: 'docs/GOOGLE-ONE-TAP.md',
      authorizedOriginsHint: Array.from(
        new Set([getBaseUrl(), brand.officialSiteUrl, 'http://localhost:3000']),
      ),
    },
    ga4Configured,
    googleAdsConfigured,
    googleAdsLeadConversionConfigured,
    googleAdsWhatsAppConversionConfigured,
    posthogConfigured,
    chatproWebhookConfigured: Boolean(Env.CHATPRO_WEBHOOK_SECRET?.trim()),
    chatproWebhookPath: 'POST /api/webhooks/chatpro?token=…',
    googleAdsApiConfigured: Boolean(
      Env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim()
      && Env.GOOGLE_ADS_CUSTOMER_ID?.trim()
      && Env.GOOGLE_ADS_CLIENT_ID?.trim()
      && Env.GOOGLE_ADS_CLIENT_SECRET?.trim()
      && Env.GOOGLE_ADS_REFRESH_TOKEN?.trim(),
    ),
    googleAdsRoiDoc: 'docs/GOOGLE-ADS-ROI-API.md',
    leadTracking: {
      cookieConsentLeadRequiresGoogleOneTap: true,
      dashboardLoginDoesNotCreateLead: true,
      analyticsAcceptRecordsEvent: 'POST /api/analytics/consent',
    },
    leadsRateLimit: 'POST /api/leads — 8 req / 15 min per IP (Neon bucket)',
    aiDiscovery: {
      llmsTxt: '/llms.txt',
      publicCatalog: '/catalog.json',
      doc: 'docs/GEO-AI-SEARCH.md',
      aiCrawlersAllowed: [
        'GPTBot',
        'OAI-SearchBot',
        'ClaudeBot',
        'PerplexityBot',
        'Google-Extended',
      ],
    },
  });
}
