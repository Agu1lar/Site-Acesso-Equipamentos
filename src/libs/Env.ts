import { createEnv } from '@t3-oss/env-nextjs';
import * as z from 'zod';

export const Env = createEnv({
  emptyStringAsUndefined: true,
  server: {
    /** Comma-separated public IPs allowed to access dashboard authentication. */
    DASHBOARD_ALLOWED_IPS: z.string().min(1).optional(),
    DASHBOARD_SESSION_SECRET: z.string().min(32).optional(),
    DATABASE_URL: z.string().min(1),
    RESEND_API_KEY: z.string().startsWith('re_').optional(),
    RESEND_FROM_EMAIL: z.string().min(3).optional(),
    /** Um e-mail ou vários separados por vírgula (ex.: comercial@…,tech@…). */
    LEADS_NOTIFY_EMAIL: z.string().min(3).optional(),
    BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
    BLOB_STORE_ID: z.string().min(1).optional(),
    BLOB_ACCESS: z.enum(['public', 'private']).default('public'),
    VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),
    VERCEL: z.string().optional(),
    VERCEL_OIDC_TOKEN: z.string().min(1).optional(),
    WHATSAPPOS_API_URL: z.url().optional(),
    WHATSAPPOS_WIDGET_KEY: z.string().min(1).optional(),
    /** Shared secret for ChatPro → /api/webhooks/chatpro (?token= or header). */
    CHATPRO_WEBHOOK_SECRET: z.string().min(16).optional(),
    /** Comma-separated extra host suffixes allowed for ChatPro PDF fetch (SSRF guard). */
    CHATPRO_PDF_URL_ALLOWLIST: z.string().optional(),
    /** Bearer token for server-to-server internal APIs. */
    INTERNAL_API_SECRET: z.string().min(24).optional(),
    ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-').optional(),
    ANTHROPIC_MODEL: z.string().min(1).default('claude-haiku-4-5-20251001'),
    /** OpenAI Whisper — transcrição de áudios ChatPro sem alt_message. */
    OPENAI_API_KEY: z.string().startsWith('sk-').optional(),
    /** Google Ads API — campaign spend for ROI report (server-only). */
    GOOGLE_ADS_DEVELOPER_TOKEN: z.string().min(1).optional(),
    GOOGLE_ADS_CUSTOMER_ID: z.string().min(1).optional(),
    GOOGLE_ADS_LOGIN_CUSTOMER_ID: z.string().min(1).optional(),
    GOOGLE_ADS_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_ADS_CLIENT_SECRET: z.string().min(1).optional(),
    GOOGLE_ADS_REFRESH_TOKEN: z.string().min(1).optional(),
    GOOGLE_ADS_OFFLINE_CONVERSION_ACTION_ID: z.string().min(1).optional(),
    GOOGLE_ADS_OFFLINE_CONVERSION_ACTION_RESOURCE_NAME: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().optional(),
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    NEXT_PUBLIC_LOGGING_LEVEL: z
      .enum(['error', 'info', 'debug', 'warning', 'trace', 'fatal'])
      .default('info'),
    NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN: z.string().optional(),
    NEXT_PUBLIC_BETTER_STACK_INGESTING_HOST: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
  },
  shared: {
    NODE_ENV: z.enum(['test', 'development', 'production']).optional(),
  },
  runtimeEnv: {
    DASHBOARD_ALLOWED_IPS: process.env.DASHBOARD_ALLOWED_IPS,
    DASHBOARD_SESSION_SECRET: process.env.DASHBOARD_SESSION_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    LEADS_NOTIFY_EMAIL: process.env.LEADS_NOTIFY_EMAIL,
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN ?? process.env.Blob_READ_WRITE_TOKEN,
    BLOB_STORE_ID: process.env.BLOB_STORE_ID ?? process.env.Blob_STORE_ID,
    BLOB_ACCESS: process.env.BLOB_ACCESS,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL: process.env.VERCEL,
    VERCEL_OIDC_TOKEN: process.env.VERCEL_OIDC_TOKEN,
    WHATSAPPOS_API_URL: process.env.WHATSAPPOS_API_URL,
    WHATSAPPOS_WIDGET_KEY: process.env.WHATSAPPOS_WIDGET_KEY,
    CHATPRO_WEBHOOK_SECRET: process.env.CHATPRO_WEBHOOK_SECRET,
    CHATPRO_PDF_URL_ALLOWLIST: process.env.CHATPRO_PDF_URL_ALLOWLIST,
    INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GOOGLE_ADS_DEVELOPER_TOKEN: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    GOOGLE_ADS_CUSTOMER_ID: process.env.GOOGLE_ADS_CUSTOMER_ID,
    GOOGLE_ADS_LOGIN_CUSTOMER_ID: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
    GOOGLE_ADS_CLIENT_ID: process.env.GOOGLE_ADS_CLIENT_ID,
    GOOGLE_ADS_CLIENT_SECRET: process.env.GOOGLE_ADS_CLIENT_SECRET,
    GOOGLE_ADS_REFRESH_TOKEN: process.env.GOOGLE_ADS_REFRESH_TOKEN,
    GOOGLE_ADS_OFFLINE_CONVERSION_ACTION_ID: process.env.GOOGLE_ADS_OFFLINE_CONVERSION_ACTION_ID,
    GOOGLE_ADS_OFFLINE_CONVERSION_ACTION_RESOURCE_NAME:
      process.env.GOOGLE_ADS_OFFLINE_CONVERSION_ACTION_RESOURCE_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    NEXT_PUBLIC_LOGGING_LEVEL: process.env.NEXT_PUBLIC_LOGGING_LEVEL,
    NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN: process.env.NEXT_PUBLIC_BETTER_STACK_SOURCE_TOKEN,
    NEXT_PUBLIC_BETTER_STACK_INGESTING_HOST: process.env.NEXT_PUBLIC_BETTER_STACK_INGESTING_HOST,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NODE_ENV: process.env.NODE_ENV,
  },
});

/**
 * Reads Blob store id at request time (Vercel injects storage env on the server).
 */
export function getBlobStoreId() {
  return (
    process.env.BLOB_STORE_ID ??
    process.env.Blob_STORE_ID ??
    Env.BLOB_STORE_ID
  );
}

/**
 * Reads Blob read-write token at request time.
 */
export function getBlobReadWriteToken() {
  return (
    process.env.BLOB_READ_WRITE_TOKEN ??
    process.env.Blob_READ_WRITE_TOKEN ??
    Env.BLOB_READ_WRITE_TOKEN
  );
}

/**
 * Returns true when code runs on Vercel infrastructure.
 */
export function isVercelRuntime() {
  return (
    Env.VERCEL === '1' ||
    Boolean(Env.VERCEL_ENV) ||
    Boolean(process.env.VERCEL_URL)
  );
}
