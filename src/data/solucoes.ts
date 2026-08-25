import type { EquipmentCategory } from '@/types/equipment';

export type SolucaoFaq = {
  question: string;
  answer: string;
};

export type SolucaoContent = {
  slug: string;
  name: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  tagline: string;
  intro: string[];
  challenges: string[];
  applications: string[];
  highlights: string[];
  faqs: SolucaoFaq[];
  featuredCategorySlugs: EquipmentCategory[];
  /** Only curated featured catalog slugs — keep empty rather than wrong. */
  featuredEquipmentSlugs: string[];
  nearbyRegiaoSlugs: string[];
};

const SOLUCOES: SolucaoContent[] = [
  {
    slug: 'mineracao',
    name: 'Mineração',
    h1: 'Soluções para mineração',
    metaTitle: 'Equipamentos para mineração | Acesso',
    metaDescription:
      'Locação de guindaste, manipuladores e ferramentas para mineração no Quadrilátero Ferrífero. Suporte técnico da Acesso Equipamentos para paradas e manutenções na RMBH.',
    tagline: 'Frota preparada para paradas, manutenções e obras nas mineradoras do Quadrilátero Ferrífero.',
    intro: [
      'A mineração em Minas Gerais impõe rotinas exigentes de manutenção, montagem e movimentação em plantas de beneficiamento, correias transportadoras, galpões de britagem e áreas de estocagem. A Acesso Equipamentos apoia mineradoras e empreiteiras da RMBH com locação de guindaste industrial, manipuladores telescópicos e ferramentas a combustão preparadas para operação em campo.',
      'Atendemos o Quadrilátero Ferrífero e o entorno de Belo Horizonte com foco em prazos curtos e acompanhamento técnico durante o uso. Trabalhamos com contratos por diária, semana ou mês, ajustados ao cronograma da parada, do projeto de manutenção ou da frente de serviço.',
    ],
    challenges: [
      'Acessos irregulares, poeira e áreas sem cobertura elétrica exigem equipamentos robustos e opções a combustão.',
      'Paradas programadas concentram atividades de altura e içamento em janelas curtas de operação.',
      'Requisitos de segurança e permissões de trabalho pedem equipamentos revisados e documentação em dia.',
    ],
    applications: [
      'Manutenção de correias transportadoras, chutes e peneiras em plantas de beneficiamento.',
      'Movimentação e reposicionamento de motores, redutores e componentes pesados durante paradas.',
      'Trocas de luminárias, limpeza estrutural e inspeções em galpões de estocagem e oficinas.',
      'Apoio à montagem de estruturas metálicas e instalação de tubulações em novas frentes.',
    ],
    highlights: [
      'Frota adequada a áreas de mina, com opções a combustão para pontos sem energia.',
      'Guindaste industrial e manipuladores telescópicos para içamentos e cargas médias.',
      'Manutenção própria com revisão entre locações e suporte durante o contrato.',
    ],
    faqs: [
      {
        question: 'Vocês atendem mineradoras no Quadrilátero Ferrífero?',
        answer:
          'Sim. Atendemos operações e empreiteiras em Nova Lima, Brumadinho, Sabará e demais cidades do Quadrilátero, com entrega a partir da base em Belo Horizonte.',
      },
      {
        question: 'Os equipamentos atendem exigências de segurança de mineradoras?',
        answer:
          'A frota passa por revisão entre locações e é entregue com a documentação técnica correspondente à categoria. Requisitos específicos do cliente são conferidos no orçamento.',
      },
      {
        question: 'É possível locar por curto prazo durante paradas de manutenção?',
        answer:
          'Sim. Trabalhamos com diárias, semanais e mensais e ajustamos o contrato ao cronograma da parada, com entrega e retirada combinadas com antecedência.',
      },
      {
        question: 'Vocês têm equipamentos a combustão para áreas sem energia?',
        answer:
          'Sim. Oferecemos ferramentas a combustão adequadas a frentes de trabalho em áreas remotas ou sem cobertura elétrica.',
      },
    ],
    featuredCategorySlugs: [
      'guindaste-industrial',
      'manipuladores-telescopicos',
      'ferramentas-combustao',
    ],
    featuredEquipmentSlugs: ['franna-fr17', 'manipulador-telescopico-mxt840'],
    nearbyRegiaoSlugs: ['nova-lima', 'brumadinho', 'sabara', 'belo-horizonte'],
  },
  {
    slug: 'industria',
    name: 'Indústria',
    h1: 'Soluções para a indústria',
    metaTitle: 'Equipamentos para indústria | Acesso',
    metaDescription:
      'Aluguel de plataformas, manipuladores e ferramentas para a indústria em Contagem, Betim e RMBH. Suporte técnico da Acesso Equipamentos para o dia a dia fabril.',
    tagline: 'Equipamentos calibrados para o dia a dia produtivo da indústria mineira.',
    intro: [
      'A indústria na região metropolitana de Belo Horizonte reúne segmentos como metalurgia, alimentos, químico, autopeças e bens de capital, com forte concentração em Contagem, Betim e Ibirité. A Acesso Equipamentos apoia fábricas e empreiteiras com locação de plataformas elevatórias, manipuladores telescópicos e ferramentas a combustão.',
      'Do turnaround de linhas de produção à manutenção rotineira de galpões e utilidades, oferecemos equipamentos para trabalhos em altura, movimentação de cargas e apoio em campo. A entrega parte de Belo Horizonte e chega ao eixo industrial da RMBH.',
    ],
    challenges: [
      'Janelas de manutenção curtas exigem equipamentos disponíveis com prazo reduzido de mobilização.',
      'Pé-direito elevado e obstáculos internos pedem plataformas com alcance e articulação adequados.',
      'Convivência com produção ativa demanda equipamentos revisados e operados com atenção.',
    ],
    applications: [
      'Manutenção de iluminação, exaustão e telhado em galpões produtivos e centros de utilidades.',
      'Movimentação de componentes e materiais no pátio e no piso fabril.',
      'Inspeção e manutenção de dutos e estruturas em altura.',
      'Apoio a paradas programadas e retrofit de linhas de produção.',
    ],
    highlights: [
      'Plataformas elétricas e a diesel para operar dentro e fora dos galpões.',
      'Manipuladores telescópicos com capacidade e alcance para o pátio industrial.',
      'Logística curta a partir de BH no polo industrial da RMBH.',
    ],
    faqs: [
      {
        question: 'Vocês atendem plantas industriais em Contagem e Betim?',
        answer:
          'Sim. O eixo Contagem–Betim é uma das áreas que mais atendemos, com entrega a partir da base em Belo Horizonte.',
      },
      {
        question: 'Como funciona o contrato para uso contínuo em fábrica?',
        answer:
          'Oferecemos contratos mensais e recorrentes, com revisão programada e substituição em caso de indisponibilidade prevista em contrato.',
      },
      {
        question: 'É possível ajustar o modelo do equipamento ao longo do contrato?',
        answer:
          'Sim. Se a aplicação mudar durante o uso, avaliamos a substituição por outro modelo da frota conforme disponibilidade e condições contratuais.',
      },
    ],
    featuredCategorySlugs: [
      'plataformas-elevatorias',
      'manipuladores-telescopicos',
      'ferramentas-combustao',
    ],
    featuredEquipmentSlugs: ['plataforma-elevatoria-gs4655', 'manipulador-telescopico-mxt840'],
    nearbyRegiaoSlugs: ['contagem', 'betim', 'ibirite', 'sarzedo'],
  },
  {
    slug: 'siderurgia',
    name: 'Siderurgia',
    h1: 'Soluções para siderurgia',
    metaTitle: 'Equipamentos para siderurgia | Acesso',
    metaDescription:
      'Locação de guindaste, plataformas e manipuladores para siderurgia na RMBH. Apoio a paradas e manutenções pela Acesso Equipamentos, com base em Belo Horizonte.',
    tagline: 'Frota alinhada ao ritmo de paradas e manutenções em usinas siderúrgicas.',
    intro: [
      'A siderurgia mineira concentra usinas e unidades de laminação que operam em regime contínuo e demandam suporte durante paradas programadas e manutenções preventivas. A Acesso Equipamentos apoia contratadas e empreiteiras com guindaste industrial, plataformas elevatórias e manipuladores telescópicos.',
      'Nosso foco é reduzir o tempo de indisponibilidade e apoiar frentes simultâneas, com equipamentos revisados e prazos alinhados ao cronograma. Atendemos o eixo Contagem–Betim e demais cidades da RMBH a partir de Belo Horizonte.',
    ],
    challenges: [
      'Paradas concentram frentes de altura e içamento em janelas curtas.',
      'Ambientes com pó e resíduos siderúrgicos exigem equipamentos robustos e bem revisados.',
      'Movimentação de motores, redutores e componentes pesados requer içamento seguro em espaços restritos.',
    ],
    applications: [
      'Manutenção de estruturas metálicas e sistemas de exaustão.',
      'Içamento de motores, bombas e redutores durante paradas.',
      'Acesso a passarelas e estruturas para inspeção e reparo.',
      'Apoio a montagem de tubulações e retrofit de linhas.',
    ],
    highlights: [
      'Guindaste industrial com boa mobilidade em pátios industriais.',
      'Plataformas e manipuladores para altura e cargas médias.',
      'Suporte alinhado a cronogramas fechados de manutenção.',
    ],
    faqs: [
      {
        question: 'Vocês atendem paradas em siderúrgicas na RMBH?',
        answer:
          'Sim. Atendemos empreiteiras e contratadas no eixo Contagem–Betim, com equipamentos alinhados ao cronograma da parada.',
      },
      {
        question: 'É possível locar guindaste por curto período?',
        answer:
          'Sim. Trabalhamos com diárias, semanais e mensais conforme disponibilidade da frota.',
      },
      {
        question: 'Como conciliar o cronograma da parada com a locação?',
        answer:
          'Combinamos data e horário de entrega com o cliente e mantemos suporte durante o contrato para ajustes de escopo.',
      },
    ],
    featuredCategorySlugs: [
      'guindaste-industrial',
      'plataformas-elevatorias',
      'manipuladores-telescopicos',
    ],
    featuredEquipmentSlugs: ['franna-fr17'],
    nearbyRegiaoSlugs: ['contagem', 'betim', 'belo-horizonte', 'ibirite'],
  },
  {
    slug: 'construcao-civil',
    name: 'Construção civil',
    h1: 'Soluções para construção civil',
    metaTitle: 'Equipamentos para construção civil | Acesso',
    metaDescription:
      'Aluguel de plataformas, andaimes e ferramentas para construção civil em BH e região. Frota da Acesso Equipamentos para obras prediais e reformas.',
    tagline: 'Frota completa para obras prediais, reformas e serviços de fachada em BH e região.',
    intro: [
      'A construção civil na RMBH engloba obras residenciais, comerciais, prediais e reformas em condomínios que exigem acesso seguro em altura e ferramentas confiáveis no canteiro. Desde 2013, a Acesso Equipamentos atende construtoras e empreiteiras com plataformas elevatórias, andaimes e ferramentas elétricas.',
      'Da fundação ao acabamento, oferecemos equipamentos para pintura de fachada, montagem de forros, instalação elétrica e hidráulica e coberturas. A logística parte da base em BH e chega a Ribeirão das Neves, Santa Luzia e demais cidades do entorno.',
    ],
    challenges: [
      'Prazos apertados pedem equipamentos disponíveis e entrega rápida em várias frentes.',
      'Fachadas, pé-direito duplo e áreas técnicas exigem plataformas e andaimes adequados a cada acesso.',
      'Reformas em condomínios e áreas ocupadas demandam equipamentos adequados ao local.',
    ],
    applications: [
      'Pintura, revestimento e manutenção de fachadas em prédios e condomínios.',
      'Instalação de forros, luminárias e sistemas em salões, lojas e galpões.',
      'Montagem de andaimes para alvenaria e acabamento em obras prediais.',
      'Serviços de acabamento, corte e furação com ferramentas elétricas.',
    ],
    highlights: [
      'Plataformas tesoura, articuladas e telescópicas para diferentes alturas.',
      'Andaimes e componentes para montagens no canteiro.',
      'Ferramentas elétricas revisadas e prontas para uso.',
    ],
    faqs: [
      {
        question: 'Vocês locam plataformas para reforma em condomínio?',
        answer:
          'Sim. Locação de plataformas para pintura de fachada, manutenção e instalações é um dos serviços mais recorrentes na capital.',
      },
      {
        question: 'Como funciona a locação de andaimes por obra?',
        answer:
          'Locamos por conjunto e por prazo, ajustando ao cronograma. A montagem é de responsabilidade do cliente ou de empresa parceira da obra.',
      },
      {
        question: 'Qual o prazo mínimo de locação em obras residenciais?',
        answer:
          'Trabalhamos com diárias, semanais e mensais. O prazo mínimo varia por equipamento e é confirmado no orçamento.',
      },
      {
        question: 'Vocês entregam em obras dentro de Belo Horizonte?',
        answer:
          'Sim. Entregamos em muitos bairros da capital e nas principais cidades da região metropolitana.',
      },
    ],
    featuredCategorySlugs: ['plataformas-elevatorias', 'andaimes', 'ferramentas-eletricas'],
    featuredEquipmentSlugs: ['plataforma-elevatoria-gs4655'],
    nearbyRegiaoSlugs: ['belo-horizonte', 'ribeirao-das-neves', 'santa-luzia', 'contagem'],
  },
  {
    slug: 'manutencao-industrial',
    name: 'Manutenção industrial',
    h1: 'Soluções para manutenção industrial',
    metaTitle: 'Equipamentos para manutenção industrial | Acesso',
    metaDescription:
      'Locação de plataformas, ferramentas elétricas e a combustão para manutenção industrial na RMBH. Suporte da Acesso Equipamentos em Contagem e Betim.',
    tagline: 'Equipamentos revisados e disponíveis para preventivas, corretivas e paradas programadas.',
    intro: [
      'Manutenção industrial reúne rotinas preventivas, corretivas e paradas programadas em fábricas, centros logísticos e utilidades da RMBH. A Acesso Equipamentos apoia equipes internas e prestadoras com plataformas elevatórias, ferramentas elétricas e ferramentas a combustão.',
      'Nosso foco é reduzir tempo parado e apoiar várias frentes no mesmo cronograma. Entregamos a partir de BH, com atendimento no eixo Contagem, Betim, Sarzedo e demais cidades da região.',
    ],
    challenges: [
      'Janelas de manutenção fechadas concentram alta demanda por altura e ferramentas em pouco tempo.',
      'Ambientes com pouca cobertura elétrica exigem equipamentos a combustão confiáveis.',
      'Frentes simultâneas dentro da planta demandam disponibilidade previsível de itens.',
    ],
    applications: [
      'Inspeção e manutenção de telhados, exaustores e coifas em galpões.',
      'Troca de luminárias, limpeza estrutural e pintura em áreas produtivas.',
      'Retrofit e manutenção de tubulações, dutos e passarelas em altura.',
      'Cortes, furações e reparos com ferramentas elétricas ou a combustão.',
    ],
    highlights: [
      'Plataformas elétricas e a diesel para operar dentro e fora dos galpões.',
      'Ferramentas elétricas e a combustão revisadas para trabalho em campo.',
      'Contratos flexíveis ajustados a cronogramas de parada.',
    ],
    faqs: [
      {
        question: 'Vocês atendem paradas de manutenção com prazo curto?',
        answer:
          'Sim. Ajustamos entrega e devolução ao cronograma da parada e mantemos suporte técnico durante o contrato.',
      },
      {
        question: 'Locam ferramentas para uso em áreas sem energia elétrica?',
        answer:
          'Sim. Oferecemos ferramentas a combustão para frentes de trabalho sem cobertura elétrica.',
      },
      {
        question: 'É possível estender ou reduzir o prazo da locação?',
        answer:
          'Sim. Prorrogações e antecipações de devolução podem ser combinadas com o comercial, conforme disponibilidade do equipamento.',
      },
    ],
    featuredCategorySlugs: [
      'plataformas-elevatorias',
      'ferramentas-eletricas',
      'ferramentas-combustao',
    ],
    featuredEquipmentSlugs: ['plataforma-elevatoria-gs4655'],
    nearbyRegiaoSlugs: ['contagem', 'betim', 'sarzedo', 'belo-horizonte'],
  },
  {
    slug: 'logistica',
    name: 'Logística',
    h1: 'Soluções para logística',
    metaTitle: 'Equipamentos para logística | Acesso',
    metaDescription:
      'Aluguel de manipuladores telescópicos e plataformas para logística e centros de distribuição em Contagem, Betim e RMBH pela Acesso Equipamentos.',
    tagline: 'Movimentação de carga e manutenção de galpões nos principais centros logísticos da RMBH.',
    intro: [
      'Centros de distribuição, transportadoras e operadores logísticos da RMBH demandam equipamentos ágeis para movimentar carga, manter estruturas e organizar o pátio. A Acesso Equipamentos apoia essas operações com manipuladores telescópicos e plataformas elevatórias.',
      'Atuamos com foco no eixo Contagem–Betim, entregando equipamentos revisados e com suporte durante o contrato. Contratos por diária, semana ou mês acompanham picos sazonais e projetos específicos.',
    ],
    challenges: [
      'Volumes sazonais aumentam a demanda por movimentação de carga em curto prazo.',
      'Portas altas, prateleiras e estruturas metálicas exigem alcance e capacidade adequados.',
      'Convivência com fluxo de caminhões e empilhadeiras pede equipamentos seguros no pátio.',
    ],
    applications: [
      'Carga e descarga de volumes pesados no pátio do galpão.',
      'Movimentação e reposicionamento de materiais em altura.',
      'Manutenção de docas, portões e sistemas de exaustão em CDs.',
      'Instalação e revisão de iluminação em galpões logísticos.',
    ],
    highlights: [
      'Manipuladores telescópicos para operação em galpão e pátio.',
      'Plataformas elevatórias para manutenção interna.',
      'Base em BH próxima ao eixo Contagem–Betim.',
    ],
    faqs: [
      {
        question: 'Vocês atendem centros de distribuição em Contagem e Betim?',
        answer:
          'Sim. Contagem e Betim concentram grande parte das entregas para operações logísticas, a partir da base em Belo Horizonte.',
      },
      {
        question: 'É possível locar manipulador telescópico por temporada?',
        answer:
          'Sim. Contratos mensais são comuns em picos sazonais e podem ser renovados enquanto durar a demanda.',
      },
      {
        question: 'Posso combinar plataforma e manipulador?',
        answer:
          'Sim. Muitas operações usam os dois. Montamos a proposta com os equipamentos necessários ao período.',
      },
    ],
    featuredCategorySlugs: ['manipuladores-telescopicos', 'plataformas-elevatorias'],
    featuredEquipmentSlugs: ['manipulador-telescopico-mxt840'],
    nearbyRegiaoSlugs: ['contagem', 'betim', 'belo-horizonte', 'ibirite'],
  },
  {
    slug: 'montagens-industriais',
    name: 'Montagens industriais',
    h1: 'Soluções para montagens industriais',
    metaTitle: 'Equipamentos para montagens industriais | Acesso',
    metaDescription:
      'Locação de guindaste, plataformas e manipuladores para montagens industriais na RMBH. Apoio da Acesso Equipamentos a cronogramas em Contagem e Betim.',
    tagline: 'Guindaste, plataformas e manipuladores alinhados ao cronograma da montagem.',
    intro: [
      'Montagens industriais envolvem instalação de estruturas metálicas, tubulações, equipamentos e utilidades em novas plantas, ampliações e retrofits. A Acesso Equipamentos apoia montadoras e empreiteiras com guindaste industrial, plataformas elevatórias e manipuladores telescópicos.',
      'Trabalhamos com cronogramas fechados, alinhando entrega, uso e devolução ao avanço da montagem. Atendemos com regularidade o eixo Contagem, Betim, Ibirité e demais cidades industriais da RMBH.',
    ],
    challenges: [
      'Cronogramas fechados exigem previsibilidade de disponibilidade e mobilização de várias frentes.',
      'Estruturas metálicas em altura pedem plataformas e alcance adequados.',
      'Movimentação de peças pesadas e volumosas requer içamento planejado e seguro.',
    ],
    applications: [
      'Montagem de estruturas metálicas, mezaninos e passarelas.',
      'Instalação e alinhamento de equipamentos e tubulações.',
      'Acesso em altura para soldagem, aparafusamento e acabamento.',
      'Apoio a testes e ajustes durante o comissionamento.',
    ],
    highlights: [
      'Guindaste industrial com boa mobilidade em canteiros industriais.',
      'Manipuladores e plataformas para altura e movimentação de peças.',
      'Contratos ajustados ao cronograma da montagem.',
    ],
    faqs: [
      {
        question: 'Vocês atendem montagens em novas plantas na RMBH?',
        answer:
          'Sim. Atendemos montadoras e empreiteiras nas cidades industriais próximas a BH, com foco no eixo Contagem, Betim e Ibirité.',
      },
      {
        question: 'É possível ajustar o contrato ao cronograma da montagem?',
        answer:
          'Sim. Trabalhamos com diárias, semanais e mensais e negociamos prorrogações conforme o andamento da obra.',
      },
      {
        question: 'Dá para locar guindaste e plataforma juntos?',
        answer:
          'Sim. Montagens costumam exigir mais de um tipo de equipamento. O comercial organiza a proposta unificada.',
      },
    ],
    featuredCategorySlugs: [
      'guindaste-industrial',
      'plataformas-elevatorias',
      'manipuladores-telescopicos',
    ],
    featuredEquipmentSlugs: ['franna-fr17', 'manipulador-telescopico-mxt840'],
    nearbyRegiaoSlugs: ['contagem', 'betim', 'ibirite', 'belo-horizonte'],
  },
];

const bySlug = new Map(SOLUCOES.map((solucao) => [solucao.slug, solucao]));

export const ALL_SOLUCAO_SLUGS = SOLUCOES.map((solucao) => solucao.slug);

export function getAllSolucoes() {
  return SOLUCOES;
}

export function getSolucaoBySlug(slug: string) {
  return bySlug.get(slug) ?? null;
}

export function isSolucaoSlug(slug: string) {
  return bySlug.has(slug);
}

/**
 * Returns solution pages that feature a given equipment category.
 * @param category Equipment category slug.
 * @param limit Maximum number of solutions to return.
 * @returns Solution content entries for interlinking.
 */
export function getSolucoesForCategory(category: EquipmentCategory, limit = 3) {
  return SOLUCOES.filter((solucao) => solucao.featuredCategorySlugs.includes(category)).slice(
    0,
    limit,
  );
}
