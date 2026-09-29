import { NextResponse } from 'next/server';
import * as z from 'zod';
import { requireDashboardAccess } from '@/lib/auth-roles';
import { uploadGoogleAdsQualifiedLeadConversion } from '@/lib/google-ads-offline-conversions';
import { isLeadQualification } from '@/lib/lead-qualification';
import { updateLeadQualification } from '@/lib/leads-admin';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const BodySchema = z.object({
  qualification: z.string().trim().min(1).max(40),
});

/**
 * Updates manual qualification and uploads qualified campaign leads to Google Ads.
 * @param request - PATCH body with the manual qualification.
 * @param context - Route params with the lead id.
 * @returns Updated lead and offline conversion result.
 */
export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireDashboardAccess();
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? 'Não autenticado' : 'Sem permissão' },
      { status: access.status },
    );
  }

  const { id } = await context.params;
  const leadId = Number.parseInt(id, 10);
  if (Number.isNaN(leadId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const json: unknown = await request.json();
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success || !isLeadQualification(parsed.data.qualification)) {
    return NextResponse.json({ error: 'Qualificação inválida' }, { status: 422 });
  }

  const lead = await updateLeadQualification(leadId, parsed.data.qualification);
  if (!lead) {
    return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
  }

  const conversion =
    parsed.data.qualification === 'qualified'
      ? await uploadGoogleAdsQualifiedLeadConversion({
          leadId: lead.id,
          attribution: {
            gclid: lead.gclid ?? undefined,
            gbraid: lead.gbraid ?? undefined,
            wbraid: lead.wbraid ?? undefined,
          },
          conversionDate: lead.qualifiedAt ?? new Date(),
        })
      : null;

  return NextResponse.json({ ok: true, lead, conversion });
}
