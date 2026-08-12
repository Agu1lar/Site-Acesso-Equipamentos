import { boolean, date, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import type { EquipmentSpec } from '@/types/equipment';

// This file defines the structure of your database tables using the Drizzle ORM.

// To modify the database schema:
// 1. Update this file with your desired changes.
// 2. Generate a new migration by running: `npm run db:generate`

// The generated migration file will reflect your schema changes.
// It automatically run the command `db-server:file`, which apply the migration before Next.js starts in development mode,
// Alternatively, if your database is running, you can run `npm run db:migrate` and there is no need to restart the server.

// Need a database for production? Check out https://get.neon.com/BMFYNtx
// Tested and compatible with Next.js Boilerplate

export const counterSchema = pgTable('counter', {
  id: serial('id').primaryKey(),
  count: integer('count').default(0),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

/** Leads de orçamento e contato — Sprint 5 */
export const leadsSchema = pgTable('leads', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  email: varchar('email', { length: 320 }).notNull(),
  phone: varchar('phone', { length: 40 }),
  company: varchar('company', { length: 200 }),
  equipmentSlug: varchar('equipment_slug', { length: 120 }),
  equipmentName: varchar('equipment_name', { length: 300 }),
  rentalPeriod: varchar('rental_period', { length: 80 }),
  city: varchar('city', { length: 120 }),
  message: text('message'),
  itemsJson: text('items_json'),
  origin: varchar('origin', { length: 80 }).notNull().default('site'),
  leadKind: varchar('lead_kind', { length: 40 }).notNull().default('quote'),
  googleSub: varchar('google_sub', { length: 255 }),
  status: varchar('status', { length: 40 }).notNull().default('new'),
  utmSource: varchar('utm_source', { length: 120 }),
  utmMedium: varchar('utm_medium', { length: 120 }),
  utmCampaign: varchar('utm_campaign', { length: 200 }),
  utmContent: varchar('utm_content', { length: 200 }),
  utmTerm: varchar('utm_term', { length: 200 }),
  gclid: varchar('gclid', { length: 255 }),
  gbraid: varchar('gbraid', { length: 255 }),
  wbraid: varchar('wbraid', { length: 255 }),
  referrer: varchar('referrer', { length: 500 }),
  landingPage: varchar('landing_page', { length: 500 }),
  geoCity: varchar('geo_city', { length: 120 }),
  geoRegion: varchar('geo_region', { length: 120 }),
  internalNotes: text('internal_notes'),
  whatsappOpened: boolean('whatsapp_opened'),
  /** Set when ChatPro reports an inbound WhatsApp message from this phone. */
  whatsappRepliedAt: timestamp('whatsapp_replied_at', { mode: 'date' }),
  lastActivityAt: timestamp('last_activity_at', { mode: 'date' }),
  clientId: integer('client_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

/** Inbound/outbound ChatPro WhatsApp events — captured by webhook for ROI worker. */
export const chatproMessagesSchema = pgTable(
  'chatpro_messages',
  {
    id: serial('id').primaryKey(),
    leadId: integer('lead_id'),
    phoneKey: varchar('phone_key', { length: 20 }).notNull(),
    chatproEvent: varchar('chatpro_event', { length: 80 }).notNull(),
    fromMe: boolean('from_me').notNull().default(false),
    messageText: text('message_text'),
    mediaType: varchar('media_type', { length: 40 }),
    mediaUrl: text('media_url'),
    mediaFilename: varchar('media_filename', { length: 255 }),
    mediaMimetype: varchar('media_mimetype', { length: 120 }),
    externalId: varchar('external_id', { length: 120 }),
    rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>(),
    eventAt: timestamp('event_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('chatpro_messages_external_id_uidx').on(table.externalId)],
);

/** Claude ROI evaluations for campaign-attributed leads (local worker, not dashboard UI). */
export const chatproLeadEvaluationsSchema = pgTable('chatpro_lead_evaluations', {
  id: serial('id').primaryKey(),
  leadId: integer('lead_id').notNull(),
  evaluatedAt: timestamp('evaluated_at', { mode: 'date' }).defaultNow().notNull(),
  messageCount: integer('message_count').notNull().default(0),
  lastMessageId: integer('last_message_id'),
  model: varchar('model', { length: 80 }).notNull(),
  trigger: varchar('trigger', { length: 40 }).notNull().default('daily_worker'),
  result: jsonb('result').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

/** Outbox for pull-based delivery to the local ChatPro ROI consumer. */
export const chatproOutboxSchema = pgTable(
  'chatpro_outbox',
  {
    id: serial('id').primaryKey(),
    messageId: integer('message_id').notNull(),
    externalId: varchar('external_id', { length: 120 }).notNull(),
    leadId: integer('lead_id'),
    phoneKey: varchar('phone_key', { length: 20 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    deliveredAt: timestamp('delivered_at', { mode: 'date' }),
  },
  (table) => [uniqueIndex('chatpro_outbox_external_id_uidx').on(table.externalId)],
);

/** Unique contacts (deduplicated by e-mail, phone or Google account). */
export const clientsSchema = pgTable('clients', {
  id: serial('id').primaryKey(),
  displayName: varchar('display_name', { length: 200 }).notNull(),
  email: varchar('email', { length: 320 }),
  phone: varchar('phone', { length: 40 }),
  phoneNormalized: varchar('phone_normalized', { length: 20 }),
  googleSub: varchar('google_sub', { length: 255 }),
  company: varchar('company', { length: 200 }),
  firstSeenAt: timestamp('first_seen_at', { mode: 'date' }).defaultNow().notNull(),
  lastActivityAt: timestamp('last_activity_at', { mode: 'date' }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/** Secondary identifiers after manual client merge (e-mail, phone, Google). */
export const clientAliasesSchema = pgTable(
  'client_aliases',
  {
    id: serial('id').primaryKey(),
    clientId: integer('client_id').notNull(),
    kind: varchar('kind', { length: 20 }).notNull(),
    value: varchar('value', { length: 320 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('client_aliases_kind_value_uidx').on(table.kind, table.value)],
);

/** Conversion events for admin dashboard — Sprint 11.5 */
export const analyticsEventsSchema = pgTable('analytics_events', {
  id: serial('id').primaryKey(),
  eventType: varchar('event_type', { length: 40 }).notNull(),
  origin: varchar('origin', { length: 80 }),
  equipmentSlug: varchar('equipment_slug', { length: 120 }),
  equipmentName: varchar('equipment_name', { length: 300 }),
  pathname: varchar('pathname', { length: 500 }),
  device: varchar('device', { length: 20 }),
  utmSource: varchar('utm_source', { length: 120 }),
  utmMedium: varchar('utm_medium', { length: 120 }),
  utmCampaign: varchar('utm_campaign', { length: 200 }),
  utmContent: varchar('utm_content', { length: 200 }),
  utmTerm: varchar('utm_term', { length: 200 }),
  gclid: varchar('gclid', { length: 255 }),
  gbraid: varchar('gbraid', { length: 255 }),
  wbraid: varchar('wbraid', { length: 255 }),
  referrer: varchar('referrer', { length: 500 }),
  landingPage: varchar('landing_page', { length: 500 }),
  geoCity: varchar('geo_city', { length: 120 }),
  geoRegion: varchar('geo_region', { length: 120 }),
  /** True when cookie consent was analytics at event time (Ads-eligible). */
  analyticsConsent: boolean('analytics_consent'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

/** Tempo ativo por página (aba visível + interação recente) — painel operacional */
export const pageEngagementEventsSchema = pgTable('page_engagement_events', {
  id: serial('id').primaryKey(),
  pathname: varchar('pathname', { length: 500 }).notNull(),
  activeSeconds: integer('active_seconds').notNull(),
  device: varchar('device', { length: 20 }),
  sessionId: varchar('session_id', { length: 64 }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

/** Catálogo de equipamentos — Sprint 11.2 */
export const equipmentSchema = pgTable('equipment', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  name: varchar('name', { length: 300 }).notNull(),
  category: varchar('category', { length: 80 }).notNull(),
  shortDescription: text('short_description').notNull(),
  longDescription: text('long_description').notNull().default(''),
  specs: jsonb('specs').$type<EquipmentSpec[]>().notNull().default([]),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  featured: boolean('featured').notNull().default(false),
  available: boolean('available').notNull().default(true),
  published: boolean('published').notNull().default(true),
  laudoUrl: varchar('laudo_url', { length: 500 }),
  laudoLabel: varchar('laudo_label', { length: 200 }),
  deletedAt: timestamp('deleted_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  updatedBy: varchar('updated_by', { length: 120 }),
});

export const equipmentImagesSchema = pgTable('equipment_images', {
  id: serial('id').primaryKey(),
  equipmentId: integer('equipment_id')
    .notNull()
    .references(() => equipmentSchema.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 500 }).notNull(),
  alt: varchar('alt', { length: 300 }),
  sortOrder: integer('sort_order').notNull().default(0),
  isPrimary: boolean('is_primary').notNull().default(false),
});

/** Redirects permanentes quando o slug de um equipamento muda no painel */
export const equipmentSlugRedirectsSchema = pgTable('equipment_slug_redirects', {
  id: serial('id').primaryKey(),
  fromSlug: varchar('from_slug', { length: 120 }).notNull().unique(),
  toSlug: varchar('to_slug', { length: 120 }).notNull(),
  equipmentId: integer('equipment_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

/** Auditoria de alterações no admin — Sprint 11.7 */
export const adminActivitySchema = pgTable('admin_activity', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 120 }).notNull(),
  action: varchar('action', { length: 80 }).notNull(),
  entityType: varchar('entity_type', { length: 40 }).notNull(),
  entitySlug: varchar('entity_slug', { length: 120 }),
  details: text('details'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

/** E-mails e credenciais do painel — gerenciado em /dashboard/acesso */
export const dashboardAllowlistSchema = pgTable('dashboard_allowlist', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  role: varchar('role', { length: 40 }).notNull().default('comercial'),
  passwordHash: varchar('password_hash', { length: 255 }),
  addedByEmail: varchar('added_by_email', { length: 320 }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

/** Códigos temporários de redefinição de senha do painel */
export const dashboardPasswordResetSchema = pgTable('dashboard_password_reset', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 320 }).notNull(),
  codeHash: varchar('code_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
  attemptCount: integer('attempt_count').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

/** Agregados diários para o painel — Sprint 11.6 */
export const analyticsDailySchema = pgTable('analytics_daily', {
  date: date('date').primaryKey(),
  pageViews: integer('page_views').notNull().default(0),
  uniqueSessions: integer('unique_sessions').notNull().default(0),
  whatsappClicks: integer('whatsapp_clicks').notNull().default(0),
  quoteSubmits: integer('quote_submits').notNull().default(0),
  topSources: jsonb('top_sources').$type<Record<string, number>>().notNull().default({}),
});

export type BlogRelatedLink = {
  label: string;
  href: string;
};

/** Artigos do blog /dicas — CMS marketing */
export const blogArticlesSchema = pgTable('blog_articles', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 120 }).notNull().unique(),
  title: text('title').notNull(),
  excerpt: text('excerpt').notNull(),
  metaTitle: varchar('meta_title', { length: 200 }).notNull(),
  metaDescription: varchar('meta_description', { length: 320 }).notNull(),
  coverImageUrl: text('cover_image_url'),
  content: jsonb('content').$type<Record<string, unknown>>().notNull().default({}),
  relatedLinks: jsonb('related_links').$type<BlogRelatedLink[]>().notNull().default([]),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  publishedAt: timestamp('published_at', { mode: 'date' }),
  readingMinutes: integer('reading_minutes').notNull().default(1),
  deletedAt: timestamp('deleted_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  updatedBy: varchar('updated_by', { length: 320 }),
});

/** Redirects permanentes quando o slug de um artigo publicado muda */
export const blogSlugRedirectsSchema = pgTable('blog_slug_redirects', {
  id: serial('id').primaryKey(),
  fromSlug: varchar('from_slug', { length: 120 }).notNull().unique(),
  toSlug: varchar('to_slug', { length: 120 }).notNull(),
  articleId: integer('article_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

/** Fixed-window rate limit counters (e.g. POST /api/leads per IP). */
export const rateLimitBucketsSchema = pgTable('rate_limit_buckets', {
  id: serial('id').primaryKey(),
  bucketKey: varchar('bucket_key', { length: 200 }).notNull().unique(),
  windowStart: timestamp('window_start', { mode: 'date' }).notNull(),
  requestCount: integer('request_count').notNull().default(1),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
