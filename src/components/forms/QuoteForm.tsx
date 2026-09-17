'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type * as z from 'zod';
import { QuoteFormOptionalSection } from '@/components/forms/QuoteFormOptionalSection';
import { useQuoteCart } from '@/components/quote-cart/QuoteCartProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { readStoredAttribution } from '@/lib/attribution';
import { readStoredVisitorGeo } from '@/lib/visitor-geo';
import { brand } from '@/lib/brand';
import { captureQuoteSubmit } from '@/lib/posthog-events';
import { markQuoteSubmitted } from '@/components/analytics/QuoteAbandonTracker';
import {
  closeWhatsAppPopup,
  navigateWhatsAppPopup,
  openBlankTabForWhatsApp,
} from '@/lib/open-whatsapp-popup';
import { buildQuoteWhatsAppUrl } from '@/lib/quote-whatsapp';
import { trackWhatsAppClick } from '@/lib/track-whatsapp-click';
import { TrackedWhatsAppLink } from '@/components/analytics/TrackedWhatsAppLink';
import { TrackedPhoneLink } from '@/components/TrackedPhoneLink';
import { QuoteFormSchema, rentalPeriodOptions, summarizeCartEquipment } from '@/validations/quote';

type QuoteFormProps = {
  initialEquipment?: {
    slug: string;
    name: string;
  };
  origin?: string;
  onSuccess?: () => void;
};

const periodLabels: Record<(typeof rentalPeriodOptions)[number], string> = {
  diaria: 'Diária',
  semanal: 'Semanal',
  mensal: 'Mensal',
  ainda_nao_sei: 'Ainda não sei',
};

export function QuoteForm(props: QuoteFormProps) {
  const origin = props.origin ?? 'site-orcamento';
  const cart = useQuoteCart();
  const [submitted, setSubmitted] = useState(false);
  const [whatsappOpened, setWhatsappOpened] = useState(false);
  const [whatsappRetryUrl, setWhatsappRetryUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(QuoteFormSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      company: '',
      equipmentSlug: '',
      equipmentName: '',
      rentalPeriod: '',
      city: '',
      message: '',
      origin,
      website: '',
    },
  });

  const resolveCartItems = () => {
    if (cart.items.length > 0) {
      return cart.items;
    }
    if (props.initialEquipment) {
      return [
        {
          slug: props.initialEquipment.slug,
          name: props.initialEquipment.name,
          kind: 'equipment' as const,
          quantity: 1,
        },
      ];
    }
    return undefined;
  };

  const submitLead = async (data: z.infer<typeof QuoteFormSchema>) => {
    setServerError(null);
    setIsSubmitting(true);

    const cartItems = resolveCartItems();

    if (!cartItems?.length && !data.equipmentName?.trim()) {
      setServerError('Adicione itens ao orçamento no catálogo ou informe um equipamento.');
      setIsSubmitting(false);
      return;
    }

    // Open blank tab in the same user-gesture stack (before await), so browsers
    // do not treat WhatsApp as a blocked popup after the lead API returns.
    const whatsappPopup = openBlankTabForWhatsApp();

    const attribution = readStoredAttribution();
    const visitorGeo = readStoredVisitorGeo();

    let response: Response;
    try {
      response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({
          ...data,
          cartItems,
          attribution: attribution ?? undefined,
          visitorGeo: visitorGeo ?? undefined,
        }),
      });
    } catch {
      closeWhatsAppPopup(whatsappPopup);
      setServerError('Falha de conexão. Tente novamente.');
      setIsSubmitting(false);
      return;
    }

    const body = (await response.json()) as {
      error?: string;
      ok?: boolean;
      id?: number;
      whatsappUrl?: string;
    };

    if (!response.ok) {
      closeWhatsAppPopup(whatsappPopup);
      setServerError(body.error ?? 'Não foi possível registrar. Tente novamente.');
      setIsSubmitting(false);
      return;
    }

    const equipmentSummary = summarizeCartEquipment(cartItems);

    captureQuoteSubmit({
      origin,
      leadId: body.id,
      cartLineCount: cartItems?.length ?? 0,
      equipmentSlug: equipmentSummary.equipmentSlug ?? data.equipmentSlug,
      equipmentName: equipmentSummary.equipmentName ?? data.equipmentName,
    });

    const whatsappUrl =
      body.whatsappUrl ??
      buildQuoteWhatsAppUrl({
        name: data.name.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        company: data.company?.trim() ?? undefined,
        city: data.city.trim(),
        rentalPeriod: data.rentalPeriod?.trim() ?? undefined,
        message: data.message?.trim() ?? undefined,
        cartItems,
        equipmentName: equipmentSummary.equipmentName ?? data.equipmentName?.trim(),
        origin,
      });

    const opened = navigateWhatsAppPopup(whatsappPopup, whatsappUrl);
    setWhatsappOpened(opened);

    if (opened) {
      trackWhatsAppClick({
        origin: 'site-orcamento-envio',
        equipmentSlug: equipmentSummary.equipmentSlug ?? data.equipmentSlug,
        equipmentName: equipmentSummary.equipmentName ?? data.equipmentName,
      });
    }

    if (body.id) {
      void fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: body.id, whatsappOpened: opened }),
      }).catch(() => undefined);
    }

    setWhatsappRetryUrl(whatsappUrl);

    cart.clearCart();
    markQuoteSubmitted();
    setSubmitted(true);
    setIsSubmitting(false);
    props.onSuccess?.();
  };

  if (submitted) {
    return (
      <div
        className="rounded-[var(--radius-card)] border border-green-200 bg-green-50 p-6"
        role="status"
      >
        <p className="font-heading text-lg font-semibold text-neutral-900">
          {whatsappOpened ? 'Quase pronto!' : 'Solicitação registrada'}
        </p>
        <p className="mt-2 text-sm text-neutral-600">
          {whatsappOpened ? (
            <>
              O WhatsApp comercial deve ter aberto com sua mensagem em seu nome. Toque em{' '}
              <strong>Enviar</strong> no WhatsApp para concluir — a equipe recebe pelo atendimento
              automático do canal.
            </>
          ) : (
            <>
              Registramos sua solicitação. O navegador bloqueou a abertura automática do WhatsApp —
              use o link abaixo para enviar a mensagem.
            </>
          )}
        </p>
        <p className="mt-2 text-sm text-neutral-600">
          Também registramos sua solicitação internamente para controle da {brand.name}. Retorno em
          horário útil ({brand.hours}).
        </p>
        {whatsappRetryUrl ? (
          <p className="mt-4 text-sm text-neutral-600">
            {whatsappOpened ? 'WhatsApp não apareceu?' : 'Abrir WhatsApp agora:'}{' '}
            <TrackedWhatsAppLink
              className="font-medium text-primary hover:underline"
              href={whatsappRetryUrl}
              origin="site-orcamento-envio-retry"
            >
              Abrir WhatsApp com sua mensagem
            </TrackedWhatsAppLink>{' '}
            · Urgente:{' '}
            <TrackedPhoneLink
              className="font-medium text-primary hover:underline"
              href={`tel:+${brand.phone}`}
              origin="site-orcamento-ligar"
            >
              {brand.phoneDisplay}
            </TrackedPhoneLink>
          </p>
        ) : null}
      </div>
    );
  }

  const showManualEquipment = cart.lineCount === 0 && !props.initialEquipment;

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={handleSubmit(submitLead)}
      // WebMCP declarative API (Chrome agentic browsing) — ignored by unsupported browsers.
      {...({
        toolname: 'requestEquipmentQuote',
        tooldescription:
          'Solicita orçamento de locação de equipamentos (plataformas, guindaste, andaimes, ferramentas) na Acesso Equipamentos. Preenche o formulário; o usuário confirma o envio pelo WhatsApp.',
      } as Record<string, string>)}
    >
      <Input
        autoComplete="name"
        error={errors.name?.message}
        label="Nome completo *"
        required
        {...register('name')}
        {...({
          toolparamdescription: 'Nome completo do solicitante',
        } as Record<string, string>)}
      />
      <Input
        autoComplete="tel"
        error={errors.phone?.message}
        inputMode="tel"
        label="Telefone / WhatsApp *"
        placeholder="(31) 99999-9999"
        required
        type="tel"
        {...register('phone')}
        {...({
          toolparamdescription: 'Telefone ou WhatsApp com DDD (Brasil)',
        } as Record<string, string>)}
      />
      <Input
        error={errors.city?.message}
        label="Cidade da obra *"
        placeholder="Ex.: Belo Horizonte, Contagem…"
        required
        {...register('city')}
        {...({
          toolparamdescription: 'Cidade onde o equipamento será usado',
        } as Record<string, string>)}
      />
      <Input
        autoComplete="email"
        error={errors.email?.message}
        label="E-mail *"
        required
        type="email"
        {...register('email')}
        {...({
          toolparamdescription: 'E-mail de contato comercial',
        } as Record<string, string>)}
      />

      {props.initialEquipment && cart.lineCount === 0 ? (
        <div className="rounded-lg bg-primary-light px-4 py-3 text-sm text-neutral-800">
          Equipamento desta página: <strong>{props.initialEquipment.name}</strong> (será incluído se
          você não montar uma lista no carrinho).
        </div>
      ) : null}

      <QuoteFormOptionalSection summary="Empresa, período e observações (opcional)">
        <Input
          autoComplete="organization"
          error={errors.company?.message}
          label="Empresa (opcional)"
          {...register('company')}
          {...({
            toolparamdescription: 'Nome da empresa (opcional)',
          } as Record<string, string>)}
        />

        {showManualEquipment ? (
          <Input
            error={errors.equipmentName?.message}
            label="Equipamento de interesse (se não usou o carrinho)"
            placeholder="Ex.: plataforma elevatória, betoneira…"
            {...register('equipmentName')}
            {...({
              toolparamdescription:
                'Equipamento desejado quando o carrinho estiver vazio (ex.: plataforma elevatória)',
            } as Record<string, string>)}
          />
        ) : null}

        <Select
          error={errors.rentalPeriod?.message}
          label="Período de locação"
          {...register('rentalPeriod')}
          {...({
            toolparamdescription: 'Período: diaria, semanal, mensal ou ainda_nao_sei',
          } as Record<string, string>)}
        >
          <option value="">Selecione…</option>
          {rentalPeriodOptions.map((value) => (
            <option key={value} value={value}>
              {periodLabels[value]}
            </option>
          ))}
        </Select>

        <Textarea
          error={errors.message?.message}
          label="Mensagem (opcional)"
          placeholder="Detalhes da obra, altura necessária, prazo…"
          {...register('message')}
          {...({
            toolparamdescription: 'Detalhes da obra, altura, prazo ou observações',
          } as Record<string, string>)}
        />
      </QuoteFormOptionalSection>

      <input
        aria-hidden
        autoComplete="off"
        className="hidden"
        tabIndex={-1}
        type="text"
        {...register('website')}
        {...({
          toolparamdescription: 'Deixe em branco (campo anti-spam)',
        } as Record<string, string>)}
      />
      <input type="hidden" {...register('origin')} />

      {serverError ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {serverError}
        </p>
      ) : null}

      <p className="text-xs text-muted">
        Ao continuar, sua solicitação é registrada para a equipe (e-mail interno) e você envia o
        orçamento pelo WhatsApp em seu nome. Dados tratados conforme LGPD.
      </p>

      <Button className="w-full sm:w-auto" disabled={isSubmitting} type="submit" variant="whatsapp">
        {isSubmitting ? 'Registrando…' : 'Enviar orçamento pelo WhatsApp'}
      </Button>
    </form>
  );
}
