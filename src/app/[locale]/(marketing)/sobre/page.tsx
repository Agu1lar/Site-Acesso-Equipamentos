import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TrackedPhoneLink } from '@/components/TrackedPhoneLink';
import { TrackedWhatsAppLink } from '@/components/analytics/TrackedWhatsAppLink';
import { ConversionCtas } from '@/components/marketing/ConversionCtas';
import { ServiceAreaSection } from '@/components/marketing/ServiceAreaSection';
import { TestimonialsSection } from '@/components/marketing/TestimonialsSection';
import {
  companyCompliance,
  companyHighlights,
  companySegments,
  companyServices,
} from '@/data/company';
import { brand, buildWhatsAppMessage, buildWhatsAppUrl, seoTitle } from '@/lib/brand';
import { getAllEquipment } from '@/lib/equipment';
import { buildMarketingMetadata } from '@/lib/seo-metadata';
import { Link } from '@/libs/I18nNavigation';
import { resolveAppLocale } from '@/utils/locale';

type PageProps = { params: Promise<{ locale: string }> };

export const metadata: Metadata = buildMarketingMetadata({
  title: seoTitle('Sobre a empresa'),
  description: `${brand.legalName} — locação de plataformas elevatórias, andaimes e máquinas em Belo Horizonte desde ${brand.foundedYear}. Equipe com mais de 20 anos de experiência.`,
  path: '/sobre',
});

const stats = [
  { label: 'Fundação', value: String(brand.foundedYear) },
  { label: 'Experiência da equipe', value: '20+ anos' },
  { label: 'Equipamentos no catálogo', value: '110+' },
  { label: 'Área de atuação', value: 'RMBH' },
] as const;

export default async function SobrePage(props: PageProps) {
  const locale = resolveAppLocale((await props.params)?.locale);
  setRequestLocale(locale);
  const tServiceArea = await getTranslations({
    locale,
    namespace: 'ServiceArea',
  });

  const equipmentCount = (await getAllEquipment()).length;
  const whatsappSobre = buildWhatsAppUrl(buildWhatsAppMessage({ origin: 'site-sobre' }));

  return (
    <>
      <section className="border-b border-neutral-200 bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <p className="text-sm font-semibold tracking-wider text-primary uppercase">
            {brand.legalName}
          </p>
          <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            Soluções em equipamentos para sua obra
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-neutral-600">
            Fundada em {brand.foundedYear}, a {brand.name} é referência em locação de plataformas
            elevatórias, andaimes, máquinas e ferramentas na {brand.seoRegion}. Nossa equipe soma
            mais de 20 anos de experiência no setor — com atendimento comercial ágil, frota
            diversificada e compromisso com segurança e conformidade normativa.
          </p>
          <ConversionCtas
            className="mt-8"
            quoteLabel="Solicitar orçamento"
            whatsappHref={whatsappSobre}
            whatsappLabel="Falar no WhatsApp"
            whatsappOrigin="site-sobre"
          />
        </div>
      </section>

      <section className="bg-neutral-100">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 px-4 py-12 sm:grid-cols-4 sm:px-6 lg:px-8">
          {stats.map((stat) => (
            <div
              className="rounded-[var(--radius-card)] border border-neutral-200 bg-surface p-5 text-center"
              key={stat.label}
            >
              <p className="font-heading text-2xl font-bold text-primary">
                {stat.label === 'Equipamentos no catálogo' ? `${equipmentCount}+` : stat.value}
              </p>
              <p className="mt-1 text-sm text-neutral-600">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <ServiceAreaSection
        eyebrow={tServiceArea('eyebrow')}
        hubLinkLabel={tServiceArea('hub_link')}
        moreLabel={tServiceArea('more_label')}
        primaryLabel={tServiceArea('primary_label')}
        title={tServiceArea('title')}
      />

      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="font-heading text-2xl font-bold text-neutral-900">Nossa história</h2>
        <div className="mt-6 space-y-4 leading-relaxed text-neutral-600">
          <p>
            A {brand.name} nasceu em Belo Horizonte com o objetivo de oferecer locação de
            equipamentos com qualidade, preço justo e proximidade com o cliente. Ao longo de mais de
            uma década de operação, ampliamos a frota e os serviços — de plataformas elevatórias a
            andaimes, ferramentas elétricas e soluções de içamento.
          </p>
          <p>
            Atendemos obras de pequeno, médio e grande porte, indústrias, comércios e condomínios na{' '}
            {brand.seoRegion}, com entrega e retirada no local conforme o equipamento contratado.
            Cases recentes incluem manutenção de fachadas com andaimes multidirecionais, uso de
            plataformas em mineradoras e siderúrgicas, reformas em shoppings e galpões logísticos em
            BH.
          </p>
          <p>
            Mantemos o padrão divulgado em nosso canal oficial: equipamentos em conformidade com a
            NR-12, andaimes alinhados à NR-18, equipe organizada e reputação construída com
            avaliações positivas no Google Meu Negócio.
          </p>
        </div>
      </section>

      <section className="border-y border-neutral-200 bg-background-muted">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="font-heading text-2xl font-bold text-neutral-900">O que oferecemos</h2>
          <p className="mt-3 text-neutral-600">
            Catálogo completo com mais de {equipmentCount} itens para locação — consulte também a
            página de{' '}
            <Link className="font-semibold text-primary hover:underline" href="/equipamentos">
              equipamentos
            </Link>
            .
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {companyServices.map((service) => (
              <li
                className="flex gap-3 rounded-lg border border-neutral-200 bg-surface px-4 py-3 text-sm text-neutral-700"
                key={service}
              >
                <span aria-hidden className="mt-0.5 text-primary">
                  ✓
                </span>
                {service}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-center font-heading text-2xl font-bold text-neutral-900">
          Por que escolher a {brand.name}?
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {companyHighlights.map((item) => (
            <article
              className="rounded-[var(--radius-card)] border border-neutral-200 bg-surface p-6"
              key={item.title}
            >
              <h3 className="font-heading text-lg font-semibold text-neutral-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-neutral-900 text-white">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="font-heading text-2xl font-bold">Segurança e conformidade</h2>
          <ul className="mt-6 space-y-3">
            {companyCompliance.map((item) => (
              <li className="flex gap-3 text-neutral-300" key={item}>
                <span aria-hidden className="text-primary">
                  ●
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="font-heading text-2xl font-bold text-neutral-900">Onde atuamos</h2>
        <p className="mt-4 leading-relaxed text-neutral-600">
          Base em {brand.address.neighborhood}, {brand.address.city} — {brand.address.state}, com
          atendimento à {brand.seoRegion} e cidades vizinhas. Realizamos entregas conforme logística
          e tipo de equipamento acordado no orçamento.
        </p>
        <ul className="mt-8 grid gap-2 sm:grid-cols-2">
          {companySegments.map((segment) => (
            <li
              className="rounded-lg bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800"
              key={segment}
            >
              {segment}
            </li>
          ))}
        </ul>
      </section>

      <TestimonialsSection
        subtitle="Avaliações reais de clientes no Google Meu Negócio."
        title="O que dizem sobre nós"
        viewAllLabel="Ver todas no Google"
      />

      <section className="border-t border-neutral-200 bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <h2 className="font-heading text-2xl font-bold text-neutral-900">Fale conosco</h2>
          <ul className="mx-auto mt-6 max-w-md space-y-2 text-left text-neutral-700 sm:text-center">
            <li>
              <strong>Telefone:</strong>{' '}
              <TrackedPhoneLink
                className="text-primary hover:underline"
                href={`tel:+55${brand.phone}`}
                origin="site-sobre-ligar"
              >
                {brand.phoneDisplay}
              </TrackedPhoneLink>
            </li>
            <li>
              <strong>WhatsApp:</strong>{' '}
              <TrackedWhatsAppLink
                className="text-primary hover:underline"
                href={buildWhatsAppUrl(buildWhatsAppMessage({ origin: 'site-sobre' }))}
                origin="site-sobre"
                rel="noopener noreferrer"
                target="_blank"
              >
                {brand.whatsappDisplay}
              </TrackedWhatsAppLink>
            </li>
            <li>
              <strong>E-mail:</strong>{' '}
              <a className="text-primary hover:underline" href={`mailto:${brand.email}`}>
                {brand.email}
              </a>
            </li>
            <li>
              <strong>Endereço:</strong> {brand.address.full}
            </li>
            <li>
              <strong>Horário:</strong> {brand.hours}
            </li>
          </ul>
          <ConversionCtas
            className="mt-8 justify-center"
            quoteLabel="Solicitar orçamento"
            whatsappHref={whatsappSobre}
            whatsappLabel="Falar no WhatsApp"
            whatsappOrigin="site-sobre"
          />
          <p className="mt-6 text-sm text-muted">
            <Link className="text-primary hover:underline" href="/contato">
              Página de contato completa →
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
