import 'server-only';

import type { InferSelectModel } from 'drizzle-orm';
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { clientSortKey, tokenizeClientSearchQuery } from '@/lib/client-identity';
import { ensureClientsBackfilled } from '@/lib/clients';
import { normalizeLeadPhone } from '@/lib/lead-contact';
import { db } from '@/libs/DB';
import { clientsSchema, leadsSchema } from '@/models/Schema';
import type { ClientListFilters } from '@/types/client-admin';

export type { ClientListFilters, ClientListItem, ClientRecord } from '@/types/client-admin';

export type ClientLeadRecord = InferSelectModel<typeof leadsSchema>;

const DEFAULT_PAGE_SIZE = 30;
const leadActivityOrder = sql`coalesce(${leadsSchema.lastActivityAt}, ${leadsSchema.createdAt})`;

function buildClientSearchWhere(query: string | undefined) {
  if (!query?.trim()) {
    return undefined;
  }

  const trimmed = query.trim();
  const tokens = tokenizeClientSearchQuery(trimmed);
  const phoneDigits = normalizeLeadPhone(trimmed);

  const tokenConditions = tokens.map((token) =>
    or(
      ilike(clientsSchema.displayName, `%${token}%`),
      ilike(clientsSchema.email, `%${token}%`),
      ilike(clientsSchema.phone, `%${token}%`),
      ilike(clientsSchema.company, `%${token}%`),
    ),
  );

  const directMatches = [
    ilike(clientsSchema.displayName, `%${trimmed}%`),
    ilike(clientsSchema.email, `%${trimmed}%`),
    ilike(clientsSchema.phone, `%${trimmed}%`),
    ilike(clientsSchema.company, `%${trimmed}%`),
  ];

  if (phoneDigits) {
    directMatches.push(eq(clientsSchema.phoneNormalized, phoneDigits));
  }

  if (trimmed.includes('@')) {
    directMatches.push(ilike(clientsSchema.email, `%${trimmed.toLowerCase()}%`));
  }

  const clauses = [...directMatches];
  if (tokenConditions.length > 0) {
    clauses.push(and(...tokenConditions)!);
  }

  return or(...clauses);
}

type ClientLeadCounts = {
  leadCount: number;
  quoteCount: number;
  cookieConsentCount: number;
};

/** Aggregates lead counts per client (avoids broken correlated subqueries in Drizzle). */
async function fetchLeadCountsByClientIds(clientIds: number[]) {
  const empty = new Map<number, ClientLeadCounts>();
  if (clientIds.length === 0) {
    return empty;
  }

  const rows = await db
    .select({
      clientId: leadsSchema.clientId,
      leadCount: count(),
      quoteCount: sql<number>`count(*) filter (where ${leadsSchema.leadKind} = 'quote')`,
      cookieConsentCount: sql<number>`count(*) filter (where ${leadsSchema.leadKind} = 'cookie_consent')`,
    })
    .from(leadsSchema)
    .where(inArray(leadsSchema.clientId, clientIds))
    .groupBy(leadsSchema.clientId);

  for (const id of clientIds) {
    empty.set(id, { leadCount: 0, quoteCount: 0, cookieConsentCount: 0 });
  }

  for (const row of rows) {
    if (row.clientId === null || row.clientId === undefined) {
      continue;
    }
    empty.set(row.clientId, {
      leadCount: Number(row.leadCount),
      quoteCount: Number(row.quoteCount),
      cookieConsentCount: Number(row.cookieConsentCount),
    });
  }

  return empty;
}

export async function listClients(filters: ClientListFilters = {}) {
  await ensureClientsBackfilled();

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const where = buildClientSearchWhere(filters.q);

  const baseQuery = db
    .select({
      id: clientsSchema.id,
      displayName: clientsSchema.displayName,
      email: clientsSchema.email,
      phone: clientsSchema.phone,
      phoneNormalized: clientsSchema.phoneNormalized,
      googleSub: clientsSchema.googleSub,
      company: clientsSchema.company,
      firstSeenAt: clientsSchema.firstSeenAt,
      lastActivityAt: clientsSchema.lastActivityAt,
      createdAt: clientsSchema.createdAt,
      updatedAt: clientsSchema.updatedAt,
    })
    .from(clientsSchema)
    .$dynamic();

  const filteredQuery = where ? baseQuery.where(where) : baseQuery;

  const rows = await filteredQuery
    .orderBy(asc(sql`lower(${clientsSchema.displayName})`))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const countsByClient = await fetchLeadCountsByClientIds(rows.map((row) => row.id));

  const clients = rows
    .map((row) => {
      const counts = countsByClient.get(row.id) ?? {
        leadCount: 0,
        quoteCount: 0,
        cookieConsentCount: 0,
      };
      return {
        ...row,
        ...counts,
      };
    })
    .sort((a, b) => clientSortKey(a.displayName).localeCompare(clientSortKey(b.displayName), 'pt-BR'));

  const countQuery = where
    ? db.select({ total: count() }).from(clientsSchema).where(where)
    : db.select({ total: count() }).from(clientsSchema);

  const countRows = await countQuery;
  const total = countRows[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    clients,
    total,
    page,
    totalPages,
  };
}

export async function getClientById(clientId: number) {
  await ensureClientsBackfilled();

  const [client] = await db.select().from(clientsSchema).where(eq(clientsSchema.id, clientId)).limit(1);
  if (!client) {
    return null;
  }

  const leads = await db
    .select()
    .from(leadsSchema)
    .where(eq(leadsSchema.clientId, clientId))
    .orderBy(desc(leadActivityOrder));

  return { client, leads };
}

export function buildClientsFilterQuery(filters: ClientListFilters) {
  const params = new URLSearchParams();
  if (filters.q?.trim()) {
    params.set('q', filters.q.trim());
  }
  if (filters.page && filters.page > 1) {
    params.set('page', String(filters.page));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}
