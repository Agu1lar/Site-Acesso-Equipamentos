import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { ConversionCtas } from '@/components/marketing/ConversionCtas';
import { FaqAccordion } from '@/components/marketing/FaqAccordion';
import { JsonLd } from '@/components/seo/JsonLd';
import {
  TRAINING_AUDIENCE,
  TRAINING_BENEFITS,
  TRAINING_FAQ,
  TRAINING_TOPICS,
} from '@/data/training';
import { brand, buildWhatsAppMessage, buildWhatsAppUrl, seoTitle } from '@/lib/brand';
import { buildTrainingCourseJsonLd } from '@/lib/json-ld';
import { buildMarketingMetadata } from '@/lib/seo-metadata';
import { Link } from '@/libs/I18nNavigation';
import { resolveAppLocale } from '@/utils/locale';

type PageProps = { params: Promise<{ locale: string }> };

const trainingDescription =
  'Treinamento para operação segura de plataformas elevatórias (plataforma aérea) em Belo Horizonte. Capacitação alinhada à NR-18 e trabalho em altura. Certificado e orçamento sob consulta.';

export const metadata: Metadata = buildMarketingMetadata({
  title: seoTitle('Treinamento em plataformas elevatórias'),
  description: trainingDescription,
  path: '/treinamento-plataformas-aereas',
});

const whatsappTraining = buildWhatsAppUrl(
  buildWhatsAppMessage({
    origin: 'site-treinamento',
    topic: 'treinamento em plataformas elevatórias',
  }),
);

export default async function TreinamentoPlataformasPage(props: PageProps) {
  const locale = resolveAppLocale((await props.params)?.locale);
  setRequestLocale(locale);

  return (
    <>
      <JsonLd data={buildTrainingCourseJsonLd()} />
      <section className="border-b border-neutral-200 bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <p className="text-sm font-semibold tracking-wider text-primary uppercase">
            Capacitação · Plataformas elevatórias
          </p>
          <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            Treinamento em plataformas elevatórias
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-neutral-600">
            Além da locação de plataformas elevatórias, a {brand.name} oferece{' '}
            <strong className="font-semibold text-neutral-800">
              treinamento para operação segura
            </strong>{' '}
            de plataformas tipo tesoura, lança articulada e mastro — com foco em prevenção de
            acidentes, conformidade com a NR-18 e boas práticas de trabalho em altura na{' '}
            {brand.seoRegion}.
          </p>
          <ConversionCtas
            className="mt-8"
            quoteHref="/orcamento"
            quoteLabel="Solicitar orçamento de treinamento"
            whatsappHref={whatsappTraining}
            whatsappLabel="Falar no WhatsApp"
            whatsappOrigin="site-treinamento"
          />
        </div>
      </section>

      <section className="bg-neutral-100">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="font-heading text-2xl font-bold text-neutral-900">
            Por que capacitar sua equipe?
          </h2>
          <p className="mt-4 leading-relaxed text-neutral-600">
            A operação de plataformas elevatórias exige conhecimento técnico, atenção aos limites do
            equipamento e respeito às normas de segurança. Acidentes em trabalho em altura podem ser
            evitados com planejamento, inspeção adequada e{' '}
            <strong className="font-semibold text-neutral-800">operadores treinados</strong>. A
            locação do equipamento não substitui a capacitação: o contratante deve garantir que
            apenas profissionais habilitados operem a máquina, conforme a legislação vigente.
          </p>
          <p className="mt-4 leading-relaxed text-neutral-600">
            Nosso treinamento complementa a locação: você pode alugar a plataforma na Acesso e
            capacitar a equipe com conteúdo alinhado ao modelo utilizado na obra — com orientação de
            profissionais que conhecem a frota e o mercado de construção civil em Minas Gerais.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-center font-heading text-2xl font-bold text-neutral-900">
          O que você encontra no programa
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {TRAINING_BENEFITS.map((item) => (
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

      <section className="border-y border-neutral-200 bg-background-muted">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="font-heading text-2xl font-bold text-neutral-900">
            Conteúdo programático
          </h2>
          <p className="mt-3 text-neutral-600">
            A carga horária e o detalhamento são definidos conforme o perfil da turma e o tipo de
            plataforma. Em geral, o programa aborda:
          </p>
          <ul className="mt-8 space-y-3">
            {TRAINING_TOPICS.map((topic) => (
              <li
                className="flex gap-3 rounded-lg border border-neutral-200 bg-surface px-4 py-3 text-sm text-neutral-700"
                key={topic}
              >
                <span aria-hidden className="mt-0.5 shrink-0 text-primary">
                  ✓
                </span>
                {topic}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="font-heading text-2xl font-bold text-neutral-900">Público-alvo</h2>
        <ul className="mt-8 grid gap-2 sm:grid-cols-2">
          {TRAINING_AUDIENCE.map((item) => (
            <li
              className="rounded-lg bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800"
              key={item}
            >
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm leading-relaxed text-neutral-600">
          Também disponibilizamos{' '}
          <Link
            className="font-semibold text-primary hover:underline"
            href="/categorias/plataformas-elevatorias"
          >
            aluguel de plataforma elevatória
          </Link>{' '}
          — tesouras, articuladas e outros modelos para obras em BH e região metropolitana.
        </p>
      </section>

      <section className="bg-neutral-900 text-white">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <h2 className="font-heading text-2xl font-bold">Solicite informações e turmas</h2>
          <p className="mx-auto mt-4 max-w-2xl text-neutral-300">
            Informe quantidade de participantes, cidade e se há interesse em combinar treinamento
            com locação de equipamento. Nossa equipe comercial retorna em horário útil com valores e
            datas disponíveis.
          </p>
          <p className="mt-2 text-sm text-neutral-400">
            {brand.hours} · {brand.phoneDisplay} · {brand.email}
          </p>
          <ConversionCtas
            className="mt-8 justify-center"
            onDark
            quoteHref="/orcamento"
            quoteLabel="Solicitar orçamento"
            whatsappHref={whatsappTraining}
            whatsappLabel="WhatsApp — treinamento"
            whatsappOrigin="site-treinamento"
          />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="font-heading text-2xl font-bold text-neutral-900">Perguntas frequentes</h2>
        <div className="mt-8">
          <FaqAccordion items={[...TRAINING_FAQ]} />
        </div>
      </section>
    </>
  );
}
