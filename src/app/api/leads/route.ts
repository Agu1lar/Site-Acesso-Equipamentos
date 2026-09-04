import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import * as z from 'zod';
import { notifyLeadByEmail } from '@/lib/email';
import { createLead } from '@/lib/leads';
import {
  enrichQuoteCartItemsWithSpecs,
  resolveEquipmentSpecsSummary,
} from '@/lib/quote-equipment-specs';
import { buildQuoteWhatsAppMessage, buildQuoteWhatsAppUrl } from '@/lib/quote-whatsapp';
import { allowQuoteLeadRequest } from '@/lib/quote-lead-rate-limit';
import { logger } from '@/libs/Logger';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { leadsSchema } from '@/models/Schema';
import { normalizeQuotePayload, QuoteFormSchema } from '@/validations/quote';

export const POST = async (request: Request) => {
  try {
    const allowed = await allowQuoteLeadRequest(request);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde alguns minutos ou fale pelo WhatsApp.' },
        { status: 429 },
      );
    }

    const json = await request.json();
    const parsed = QuoteFormSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: z.treeifyError(parsed.error) },
        { status: 422 },
      );
    }

    if (parsed.data.website) {
      return NextResponse.json({ ok: true, id: 0 });
    }

    const { website: _honeypot } = parsed.data;
    const cartItems = parsed.data.cartItems?.length
      ? await enrichQuoteCartItemsWithSpecs(parsed.data.cartItems)
      : undefined;
    const normalized = normalizeQuotePayload({
      ...parsed.data,
      cartItems,
    });
    const lead = await createLead(normalized);

    const equipmentSpecsSummary =
      !cartItems?.length && normalized.equipmentSlug
        ? await resolveEquipmentSpecsSummary(normalized.equipmentSlug.split(',')[0])
        : undefined;

    const whatsappPayload = {
      name: normalized.name,
      email: normalized.email,
      phone: normalized.phone,
      company: normalized.company,
      city: normalized.city,
      rentalPeriod: normalized.rentalPeriod,
      message: normalized.message,
      cartItems,
      equipmentName: normalized.equipmentName,
      equipmentSpecsSummary,
      origin: normalized.origin,
    };
    const whatsappUrl = buildQuoteWhatsAppUrl(whatsappPayload);

    if (lead) {
      try {
        await notifyLeadByEmail(lead);
      } catch (emailError) {
        logger.error('Lead salvo, mas e-mail não enviado', {
          leadId: lead.id,
          message: emailError instanceof Error ? emailError.message : String(emailError),
        });
      }
    }

    // Integração whatsappOS (server-side): não depende de widget no front.
    // Se falhar, não bloqueia o lead no Neon nem o fluxo do WhatsApp do cliente.
    try {
      const apiUrl = Env.WHATSAPPOS_API_URL?.trim().replace(/\/$/, '');
      const widgetKey = Env.WHATSAPPOS_WIDGET_KEY?.trim();

      if (apiUrl && widgetKey) {
        const message = buildQuoteWhatsAppMessage(whatsappPayload);

        const phoneDigits = normalized.phone.replace(/\D/g, '');
        const phoneWithCountry =
          phoneDigits.startsWith('55') && phoneDigits.length >= 12 ? phoneDigits : `55${phoneDigits}`;

        await fetch(`${apiUrl}/widgets/${widgetKey}/capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(4_000),
          body: JSON.stringify({
            phone: phoneWithCountry,
            name: normalized.name,
            email: normalized.email,
            message,
            cartItems: cartItems ?? [],
            pageUrl: normalized.landingPage ? `${Env.NEXT_PUBLIC_APP_URL ?? ''}${normalized.landingPage}` : undefined,
            utmSource: normalized.utmSource,
            utmMedium: normalized.utmMedium,
            utmCampaign: normalized.utmCampaign,
            tags: ['acesso', 'orcamento'],
          }),
        });
      }
    } catch (crmError) {
      logger.warn('whatsappOS capture falhou (ignorado)', {
        message: crmError instanceof Error ? crmError.message : String(crmError),
      });
    }

    return NextResponse.json({ ok: true, id: lead?.id, whatsappUrl });
  } catch (error) {
    logger.error('Falha ao salvar lead', {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Não foi possível enviar agora. Tente o WhatsApp ou telefone.' },
      { status: 500 },
    );
  }
};

const WhatsAppOpenedPatchSchema = z.object({
  leadId: z.number().int().positive(),
  whatsappOpened: z.boolean(),
});

export const PATCH = async (request: Request) => {
  try {
    const allowed = await allowQuoteLeadRequest(request);
    if (!allowed) {
      return NextResponse.json({ error: 'Muitas tentativas.' }, { status: 429 });
    }

    const json = await request.json();
    const parsed = WhatsAppOpenedPatchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 422 });
    }

    await db
      .update(leadsSchema)
      .set({ whatsappOpened: parsed.data.whatsappOpened })
      .where(eq(leadsSchema.id, parsed.data.leadId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error('Falha ao atualizar WhatsApp do lead', {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Não foi possível atualizar.' }, { status: 500 });
  }
};
