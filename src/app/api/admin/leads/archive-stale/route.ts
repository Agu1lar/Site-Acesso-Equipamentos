import { NextResponse } from 'next/server';
import { requireDashboardAccess } from '@/lib/auth-roles';
import { archiveStaleCommercialLeads } from '@/lib/leads-auto-archive';

/**
 * Archives new leads with activity before the current week.
 */
export async function POST() {
  const access = await requireDashboardAccess();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? 'Não autenticado' : 'Sem permissão' },
      { status: access.status },
    );
  }

  const archivedCount = await archiveStaleCommercialLeads();

  return NextResponse.json({ ok: true, archivedCount });
}
