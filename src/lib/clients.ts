import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import {
  collectClientAliasInserts,
  hasClientIdentityKey,
  mergeClientFields,
  normalizeClientIdentity,
  pickClientDisplayName,
  type ClientIdentityInput,
} from '@/lib/client-identity';
import { db } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { clientAliasesSchema, clientsSchema, leadsSchema } from '@/models/Schema';

export type ClientRecord = InferSelectModel<typeof clientsSchema>;

const BACKFILL_BATCH = 250;
const MAX_MANUAL_MERGE = 20;
const MAX_BULK_DELETE = 20;

function buildClientMatchConditions(identity: ReturnType<typeof normalizeClientIdentity>) {
  const conditions = [];

  if (identity.googleSub) {
    conditions.push(eq(clientsSchema.googleSub, identity.googleSub));
  }
  if (identity.email) {
    conditions.push(eq(clientsSchema.email, identity.email));
  }
  if (identity.phoneNormalized) {
    conditions.push(eq(clientsSchema.phoneNormalized, identity.phoneNormalized));
  }

  return conditions;
}

async function findClientsByIdentity(identity: ReturnType<typeof normalizeClientIdentity>) {
  const directConditions = buildClientMatchConditions(identity);
  const directMatches =
    directConditions.length > 0
      ? await db.select().from(clientsSchema).where(or(...directConditions))
      : [];

  const aliasConditions = [];
  if (identity.googleSub) {
    aliasConditions.push(
      and(eq(clientAliasesSchema.kind, 'google_sub'), eq(clientAliasesSchema.value, identity.googleSub))!,
    );
  }
  if (identity.email) {
    aliasConditions.push(
      and(eq(clientAliasesSchema.kind, 'email'), eq(clientAliasesSchema.value, identity.email))!,
    );
  }
  if (identity.phoneNormalized) {
    aliasConditions.push(
      and(eq(clientAliasesSchema.kind, 'phone'), eq(clientAliasesSchema.value, identity.phoneNormalized))!,
    );
  }

  const aliasMatches =
    aliasConditions.length > 0
      ? await db
          .select({ client: clientsSchema })
          .from(clientAliasesSchema)
          .innerJoin(clientsSchema, eq(clientAliasesSchema.clientId, clientsSchema.id))
          .where(or(...aliasConditions))
      : [];

  const byId = new Map<number, ClientRecord>();
  for (const row of directMatches) {
    byId.set(row.id, row);
  }
  for (const row of aliasMatches) {
    byId.set(row.client.id, row.client);
  }

  return [...byId.values()];
}

async function mergeDuplicateClients(matches: ClientRecord[]) {
  if (matches.length <= 1) {
    return matches[0] ?? null;
  }

  const ids = matches.map((row) => row.id);
  const result = await mergeClientsByIds(ids);
  return result.client;
}

/**
 * Manually merges 2–20 client rows into the oldest id (admin action).
 */
export async function mergeClientsByIds(clientIds: number[]) {
  const uniqueIds = [...new Set(clientIds)].sort((a, b) => a - b);
  if (uniqueIds.length < 2) {
    throw new Error('Selecione pelo menos dois clientes para mesclar.');
  }
  if (uniqueIds.length > MAX_MANUAL_MERGE) {
    throw new Error(`É possível mesclar no máximo ${MAX_MANUAL_MERGE} clientes por vez.`);
  }

  const records = await db.select().from(clientsSchema).where(inArray(clientsSchema.id, uniqueIds));
  if (records.length !== uniqueIds.length) {
    throw new Error('Um ou mais clientes selecionados não foram encontrados.');
  }

  const primaryId = uniqueIds[0]!;
  const duplicateIds = uniqueIds.slice(1);
  const merged = mergeClientFields(records);
  const aliasRows = collectClientAliasInserts(merged, records, primaryId);

  const existingAliases = await db
    .select()
    .from(clientAliasesSchema)
    .where(inArray(clientAliasesSchema.clientId, uniqueIds));

  const aliasKeys = new Set(aliasRows.map((row) => `${row.kind}:${row.value}`));
  for (const row of existingAliases) {
    const key = `${row.kind}:${row.value}`;
    if (aliasKeys.has(key)) {
      continue;
    }
    aliasKeys.add(key);
    aliasRows.push({ clientId: primaryId, kind: row.kind as 'email' | 'phone' | 'google_sub', value: row.value });
  }

  await db.transaction(async (tx) => {
    for (const duplicateId of duplicateIds) {
      await tx
        .update(leadsSchema)
        .set({ clientId: primaryId })
        .where(eq(leadsSchema.clientId, duplicateId));
    }

    await tx.delete(clientAliasesSchema).where(inArray(clientAliasesSchema.clientId, uniqueIds));

    // Remove duplicates before updating unique fields on the primary row.
    await tx.delete(clientsSchema).where(inArray(clientsSchema.id, duplicateIds));

    await tx
      .update(clientsSchema)
      .set({
        displayName: merged.displayName,
        email: merged.email,
        phone: merged.phone,
        phoneNormalized: merged.phoneNormalized,
        googleSub: merged.googleSub,
        company: merged.company,
        firstSeenAt: merged.firstSeenAt,
        lastActivityAt: merged.lastActivityAt,
      })
      .where(eq(clientsSchema.id, primaryId));

    if (aliasRows.length > 0) {
      await tx
        .insert(clientAliasesSchema)
        .values(aliasRows)
        .onConflictDoNothing({ target: [clientAliasesSchema.kind, clientAliasesSchema.value] });
    }
  });

  logger.info(
    `Manually merged ${duplicateIds.length} client(s) into #${primaryId} (${merged.email ?? merged.phoneNormalized ?? merged.googleSub ?? 'unknown'})`,
  );

  const [client] = await db.select().from(clientsSchema).where(eq(clientsSchema.id, primaryId)).limit(1);
  if (!client) {
    throw new Error('Falha ao carregar o cliente após mesclagem.');
  }

  await relinkLeadsForClient(primaryId);

  return {
    client,
    primaryClientId: primaryId,
    mergedCount: duplicateIds.length,
  };
}

/**
 * Deletes client rows (admin). Leads keep their data; client_id is cleared via FK.
 */
export async function deleteClientsByIds(clientIds: number[]) {
  const uniqueIds = [...new Set(clientIds)].sort((a, b) => a - b);
  if (uniqueIds.length === 0) {
    throw new Error('Selecione pelo menos um cliente para excluir.');
  }
  if (uniqueIds.length > MAX_BULK_DELETE) {
    throw new Error(`É possível excluir no máximo ${MAX_BULK_DELETE} clientes por vez.`);
  }

  const records = await db.select().from(clientsSchema).where(inArray(clientsSchema.id, uniqueIds));
  if (records.length !== uniqueIds.length) {
    throw new Error('Um ou mais clientes selecionados não foram encontrados.');
  }

  await db.transaction(async (tx) => {
    await tx.update(leadsSchema).set({ clientId: null }).where(inArray(leadsSchema.clientId, uniqueIds));
    await tx.delete(clientAliasesSchema).where(inArray(clientAliasesSchema.clientId, uniqueIds));
    await tx.delete(clientsSchema).where(inArray(clientsSchema.id, uniqueIds));
  });

  logger.info(`Deleted ${uniqueIds.length} client(s): #${uniqueIds.join(', #')}`);

  return { deletedCount: uniqueIds.length };
}

/**
 * Finds or creates a deduplicated client row for a lead / Google sign-in.
 */
export async function resolveOrCreateClient(
  input: ClientIdentityInput,
  activityAt = new Date(),
): Promise<ClientRecord | null> {
  const identity = normalizeClientIdentity(input);
  if (!hasClientIdentityKey(identity)) {
    return null;
  }

  const matches = await findClientsByIdentity(identity);

  const primary = await mergeDuplicateClients(matches);
  const now = activityAt;

  if (!primary) {
    const [created] = await db
      .insert(clientsSchema)
      .values({
        displayName: identity.displayName,
        email: identity.email,
        phone: identity.phone,
        phoneNormalized: identity.phoneNormalized,
        googleSub: identity.googleSub,
        company: identity.company,
        firstSeenAt: now,
        lastActivityAt: now,
      })
      .returning();

    return created ?? null;
  }

  const [updated] = await db
    .update(clientsSchema)
    .set({
      displayName: pickClientDisplayName(primary.displayName, identity.displayName),
      email: primary.email ?? identity.email,
      phone: primary.phone ?? identity.phone,
      phoneNormalized: primary.phoneNormalized ?? identity.phoneNormalized,
      googleSub: primary.googleSub ?? identity.googleSub,
      company: primary.company ?? identity.company,
      lastActivityAt: now,
    })
    .where(eq(clientsSchema.id, primary.id))
    .returning();

  return updated ?? primary;
}

/** Associates a lead row with its deduplicated client record. */
export async function linkLeadToClient(
  leadId: number,
  input: ClientIdentityInput,
  activityAt?: Date,
) {
  const client = await resolveOrCreateClient(input, activityAt);
  if (!client) {
    return null;
  }

  await db.update(leadsSchema).set({ clientId: client.id }).where(eq(leadsSchema.id, leadId));
  await relinkLeadsForClient(client.id);
  return client;
}

/** Links legacy leads that predate the clients table (runs in small batches). */
export async function backfillUnlinkedLeads(limit = BACKFILL_BATCH) {
  const unlinked = await db
    .select()
    .from(leadsSchema)
    .where(isNull(leadsSchema.clientId))
    .orderBy(leadsSchema.createdAt)
    .limit(limit);

  for (const lead of unlinked) {
    await linkLeadToClient(
      lead.id,
      {
        displayName: lead.name,
        email: lead.email,
        phone: lead.phone,
        googleSub: lead.googleSub,
        company: lead.company,
      },
      lead.lastActivityAt ?? lead.createdAt,
    );
  }

  return unlinked.length;
}

/** Ensures all leads are linked before admin client queries. */
export async function ensureClientsBackfilled() {
  for (let pass = 0; pass < 20; pass += 1) {
    const processed = await backfillUnlinkedLeads();
    if (processed === 0) {
      return;
    }
  }
}

async function loadClientAliasValues(clientId: number) {
  const rows = await db
    .select()
    .from(clientAliasesSchema)
    .where(eq(clientAliasesSchema.clientId, clientId));

  const emails: string[] = [];
  const phones: string[] = [];
  const googleSubs: string[] = [];

  for (const row of rows) {
    if (row.kind === 'email') {
      emails.push(row.value);
    } else if (row.kind === 'phone') {
      phones.push(row.value);
    } else if (row.kind === 'google_sub') {
      googleSubs.push(row.value);
    }
  }

  return { emails, phones, googleSubs };
}

/** Re-links leads that share contact data but were attached to different clients. */
export async function relinkLeadsForClient(clientId: number) {
  const [client] = await db.select().from(clientsSchema).where(eq(clientsSchema.id, clientId)).limit(1);
  if (!client) {
    return;
  }

  const aliases = await loadClientAliasValues(clientId);
  const conditions = [];

  if (client.email) {
    conditions.push(sql`lower(trim(${leadsSchema.email})) = ${client.email}`);
  }
  for (const email of aliases.emails) {
    conditions.push(sql`lower(trim(${leadsSchema.email})) = ${email}`);
  }

  if (client.phoneNormalized) {
    conditions.push(
      sql`regexp_replace(${leadsSchema.phone}, '\\D', '', 'g') = ${client.phoneNormalized}`,
    );
  }
  for (const phone of aliases.phones) {
    conditions.push(sql`regexp_replace(${leadsSchema.phone}, '\\D', '', 'g') = ${phone}`);
  }

  if (client.googleSub) {
    conditions.push(eq(leadsSchema.googleSub, client.googleSub));
  }
  for (const googleSub of aliases.googleSubs) {
    conditions.push(eq(leadsSchema.googleSub, googleSub));
  }

  if (conditions.length === 0) {
    return;
  }

  await db.update(leadsSchema).set({ clientId }).where(or(...conditions));
}
