import type {
  RegiaoCategoriaContent,
  RegiaoCategoriaEnrichment,
  RegiaoCategoriaFaq,
  RegiaoCategoriaCategorySlug,
  RegiaoCategoriaCitySlug,
} from '@/data/regiao-categoria';
import type { RegiaoContent } from '@/data/regioes';

const GUINDASTE_CITIES = new Set<RegiaoCategoriaCitySlug>([
  'contagem',
  'betim',
  'ibirite',
  'brumadinho',
  'nova-lima',
  'vespasiano',
]);

const MANIPULADOR_CITIES = new Set<RegiaoCategoriaCitySlug>([
  'contagem',
  'betim',
  'ibirite',
  'brumadinho',
  'nova-lima',
  'santa-luzia',
]);

const ANDAIMES_CITIES = new Set<RegiaoCategoriaCitySlug>([
  'belo-horizonte',
  'contagem',
  'betim',
  'ibirite',
  'ribeirao-das-neves',
  'santa-luzia',
]);

function clipMetaDescription(value: string) {
  if (value.length <= 160) {
    return value;
  }
  return `${value.slice(0, 157).trimEnd()}…`;
}

function miningContext(regiao: RegiaoContent) {
  if (regiao.focus === 'mineracao') {
    return 'paradas de planta, beneficiamento e frentes de mineração';
  }
  if (regiao.focus === 'industria') {
    return 'manutenção fabril, montagens e galpões logísticos';
  }
  return 'obras prediais, reformas e serviços urbanos';
}

function buildGuindasteEnrichment(regiao: RegiaoContent): RegiaoCategoriaEnrichment {
  const city = regiao.name;
  return {
    typesTitle: `Guindastes industriais para ${city}`,
    types: [
      {
        title: `Guindaste articulado em ${city}`,
        body:
          'Indicado para içamento com raio e manobrabilidade em pátios, docas e áreas industriais. Em frentes com espaço limitado, o articulado posiciona carga com precisão.',
      },
      {
        title: `Guindaste para manutenção industrial`,
        body:
          `Atende montagem de linhas, troca de motores e redutores e movimentação de componentes em ${miningContext(regiao)}.`,
      },
      {
        title: `Içamento programado e paradas`,
        body:
          'Em janelas curtas de parada, alinhamos reserva e logística a partir de BH para não perder o pico de manutenção.',
      },
      {
        title: 'Orientação de capacidade e alcance',
        body:
          'Informe peso aproximado, raio de trabalho e acesso ao ponto de içamento — indicamos o modelo do catálogo com capacidade compatível.',
      },
    ],
    propulsionTitle: `Cenários comuns de guindaste em ${city}`,
    propulsion: [
      {
        title: 'Manutenção em planta e galpão',
        body:
          'Movimentação de equipamentos, estruturas leves e componentes em áreas cobertas ou semiabertas.',
      },
      {
        title: 'Montagem industrial',
        body:
          'Apoio à ereção de estruturas metálicas, passarelas e utilidades em novas frentes ou ampliações.',
      },
    ],
    heightsTitle: 'Capacidade e logística',
    heights: [
      {
        title: 'Cargas leves a médias',
        body:
          'Grande parte das demandas em planta envolve componentes que cabem em faixas de capacidade do catálogo — confirmamos no briefing.',
      },
      {
        title: 'Acesso e estabilização',
        body:
          `Em ${city}, avaliamos via de acesso, inclinação do piso e área para estabilizadores antes de reservar o guindaste.`,
      },
      {
        title: 'Reserva antecipada',
        body:
          'Paradas programadas e montagens fechadas pedem reserva com antecedência para garantir disponibilidade.',
      },
    ],
    whyTitle: `Por que locar guindaste com a Acesso em ${city}`,
    why: [
      `Base em Belo Horizonte com entrega para ${city} e entorno da RMBH`,
      'Orientação técnica de capacidade, raio e condições do local',
      'Frota revisada e documentação usual de locação',
      'Diária, semanal ou mensal — valores sob consulta',
    ],
  };
}

function buildManipuladorEnrichment(regiao: RegiaoContent): RegiaoCategoriaEnrichment {
  const city = regiao.name;
  return {
    typesTitle: `Manipuladores telescópicos para ${city}`,
    types: [
      {
        title: `Manipulador para galpão e pátio`,
        body:
          `Alcance horizontal e vertical para movimentar cargas em ${miningContext(regiao)} — útil quando o guindaste não é necessário.`,
      },
      {
        title: 'Carga paletizada e estruturas leves',
        body:
          'Posicionamento de materiais em racks, mezaninos e áreas de estoque com boa manobrabilidade.',
      },
      {
        title: 'Apoio a montagem',
        body:
          'Elevação controlada de peças metálicas, equipamentos e componentes em frentes de montagem industrial.',
      },
      {
        title: 'Terreno e acesso',
        body:
          `Em ${city}, informe se o serviço é interno, externo ou misto — isso define tração, capacidade e modelo.`,
      },
    ],
    propulsionTitle: `Onde o manipulador entra em ${city}`,
    propulsion: [
      {
        title: 'Manutenção e paradas',
        body:
          'Movimentação rápida de componentes durante janelas curtas de manutenção programada.',
      },
      {
        title: 'Logística interna',
        body:
          'Apoio em centros de distribuição, pátios e áreas de carga e descarga com necessidade de alcance.',
      },
    ],
    heightsTitle: 'Alcance e capacidade',
    heights: [
      {
        title: 'Altura e alcance horizontal',
        body:
          'No orçamento, informe altura a alcançar e distância horizontal — o manipulador é escolhido pelo envelope de trabalho.',
      },
      {
        title: 'Peso da carga',
        body:
          'Capacidade nominal depende do raio de trabalho. Dados aproximados no primeiro contato aceleram a proposta.',
      },
      {
        title: 'Entrega a partir de BH',
        body:
          `Logística combinada para ${city} conforme disponibilidade da frota e cronograma da obra.`,
      },
    ],
    whyTitle: `Por que locar manipulador com a Acesso em ${city}`,
    why: [
      'Frota de manipuladores telescópicos revisada entre locações',
      'Suporte para definir modelo conforme carga, alcance e piso',
      `Atendimento frequente a ${city} e cidades industriais da RMBH`,
      'Orçamento sob consulta — diária, semanal ou mensal',
    ],
  };
}

function buildAndaimesEnrichment(regiao: RegiaoContent): RegiaoCategoriaEnrichment {
  const city = regiao.name;
  const urban =
    regiao.focus === 'metropole'
      ? 'reformas prediais, fachadas e obras em condomínios'
      : 'obras residenciais, comerciais e ampliações';
  return {
    typesTitle: `Andaimes para obras em ${city}`,
    types: [
      {
        title: `Andaime de fachada em ${city}`,
        body:
          `Estrutura para pintura, revestimento e manutenção de fachadas — demanda recorrente em ${urban}.`,
      },
      {
        title: 'Andaime tubular e multidirecional',
        body:
          'Montagens modulares para acesso em altura em obras com geometria variável ou vãos irregulares.',
      },
      {
        title: 'Andaime para serviços internos',
        body:
          'Apoio a instalações, gesso, elétrica e acabamentos em edificações com pé-direito elevado.',
      },
      {
        title: 'Planejamento de montagem',
        body:
          'Informe altura, perímetro e carga prevista — orientamos quantidade de módulos e tipo de sistema.',
      },
    ],
    propulsionTitle: `Aplicações frequentes em ${city}`,
    propulsion: [
      {
        title: 'Reforma e manutenção predial',
        body:
          'Acesso seguro para equipes em prédios, condomínios e edificações comerciais na região.',
      },
      {
        title: 'Obras novas e ampliações',
        body:
          'Suporte a alvenaria, estrutura e acabamento em frentes de construção civil.',
      },
    ],
    heightsTitle: 'Segurança e prazo',
    heights: [
      {
        title: 'NR-18 e montagem',
        body:
          'Andaimes exigem montagem por equipe qualificada e projeto conforme a norma. A locação inclui orientação sobre documentação usual do equipamento.',
      },
      {
        title: 'Prazo de locação',
        body:
          'Informe duração estimada da obra em dias ou semanas — a proposta considera quantidade de material e logística.',
      },
      {
        title: `Entrega em ${city}`,
        body:
          'Combinamos entrega e retirada a partir da base em Belo Horizonte conforme cronograma da obra.',
      },
    ],
    whyTitle: `Por que locar andaimes com a Acesso em ${city}`,
    why: [
      `Entrega para ${city} e região metropolitana`,
      'Orientação sobre tipo de sistema e quantidade de módulos',
      'Frota revisada e condições sob consulta no orçamento',
      'Atendimento comercial em horário útil',
    ],
  };
}

function buildGuindasteFaqs(regiao: RegiaoContent): RegiaoCategoriaFaq[] {
  const city = regiao.name;
  return [
    {
      question: `Vocês locam guindaste industrial em ${city}?`,
      answer: `Sim. Atendemos ${city} com guindastes do catálogo, conforme disponibilidade e condições de acesso ao local.`,
    },
    {
      question: 'Preciso informar peso e raio de trabalho?',
      answer:
        'Sim. Capacidade efetiva depende do raio de içamento. Quanto mais precisos os dados, mais assertiva a indicação do modelo.',
    },
    {
      question: `Atendem paradas industriais em ${city}?`,
      answer:
        'Sim. Recomendamos reserva antecipada quando a demanda coincide com parada programada ou montagem fechada.',
    },
    {
      question: 'Guindaste inclui operador?',
      answer:
        'A operação e habilitação são de responsabilidade do contratante, salvo disposição contratual específica. Orientamos requisitos usuais no orçamento.',
    },
    {
      question: `Como pedir orçamento de guindaste em ${city}?`,
      answer:
        'Pelo WhatsApp ou formulário: informe endereço, peso aproximado, raio, prazo e tipo de serviço.',
    },
  ];
}

function buildManipuladorFaqs(regiao: RegiaoContent): RegiaoCategoriaFaq[] {
  const city = regiao.name;
  return [
    {
      question: `Vocês locam manipulador telescópico em ${city}?`,
      answer: `Sim. Locamos manipuladores para ${city} e entorno, com entrega a partir de Belo Horizonte.`,
    },
    {
      question: 'Qual a diferença entre manipulador e guindaste?',
      answer:
        'O manipulador telescópico combina alcance e movimentação de carga com boa manobrabilidade; o guindaste foca içamento com maior capacidade em raio fixo. Indicamos conforme o serviço.',
    },
    {
      question: 'Manipulador serve para área interna?',
      answer:
        'Depende do modelo, emissão e dimensões. Informe se o serviço é interno ou externo para orientarmos a frota.',
    },
    {
      question: `Como pedir orçamento em ${city}?`,
      answer:
        'Informe carga aproximada, altura/alcance, endereço e prazo pelo WhatsApp ou formulário de orçamento.',
    },
  ];
}

function buildAndaimesFaqs(regiao: RegiaoContent): RegiaoCategoriaFaq[] {
  const city = regiao.name;
  return [
    {
      question: `Vocês locam andaimes em ${city}?`,
      answer: `Sim. Atendemos obras em ${city} com sistemas de andaime conforme catálogo e disponibilidade.`,
    },
    {
      question: 'Quem monta o andaime?',
      answer:
        'A montagem deve ser feita por equipe qualificada, conforme NR-18. A locação cobre o material; a responsabilidade pela montagem segue o contrato da obra.',
    },
    {
      question: 'Andaime de fachada ou tubular — qual usar?',
      answer:
        'Fachada costuma ser mais rápida para pintura e revestimento contínuo. Tubular/multidirecional adapta-se melhor a geometrias complexas. Descreva a obra no orçamento.',
    },
    {
      question: `Qual o prazo de entrega em ${city}?`,
      answer:
        'Combinamos data conforme cronograma da obra e logística a partir de BH. Prazos curtos dependem de disponibilidade.',
    },
    {
      question: 'Como solicitar orçamento de andaimes?',
      answer:
        'Informe altura, tipo de serviço (fachada, interno, estrutura), endereço em ' + city + ' e duração estimada.',
    },
  ];
}

function applyEnrichedOverride(
  base: RegiaoCategoriaContent,
  regiao: RegiaoContent,
  phrase: string,
  categoryLabel: string,
  enrichment: RegiaoCategoriaEnrichment,
  faqs: RegiaoCategoriaFaq[],
  introExtra: string,
) {
  return {
    ...base,
    metaTitle: `Locação de ${phrase} em ${regiao.name}`,
    metaDescription: clipMetaDescription(
      `Aluguel de ${phrase} em ${regiao.name}. Entrega a partir de BH, frota revisada e orçamento sob consulta pela Acesso Equipamentos.`,
    ),
    tagline: `${categoryLabel} para ${miningContext(regiao)} em ${regiao.name} — logística a partir de Belo Horizonte.`,
    intro: [
      `A Acesso Equipamentos loca ${phrase} em ${regiao.name}, com foco em ${miningContext(regiao)}. ${introExtra}`,
      `Nesta página você encontra o recorte local de ${categoryLabel.toLowerCase()}: tipos de aplicação, orientação técnica e acesso ao catálogo. Valores sob consulta conforme período, entrega e condições do local.`,
      `Para orçamento em ${regiao.name}, informe endereço, prazo e descrição do serviço. Trabalhamos com diárias, semanais e mensais conforme disponibilidade da frota.`,
    ],
    faqs,
    enrichment,
  };
}

/**
 * Applies long-form enrichment for guindaste, manipulador and andaimes in priority cities.
 */
export function applyIndustrialCategoryEnrichment(
  base: RegiaoCategoriaContent,
  regiao: RegiaoContent,
): RegiaoCategoriaContent {
  const city = base.citySlug;
  const category = base.categorySlug;

  if (category === 'guindaste-industrial' && GUINDASTE_CITIES.has(city)) {
    return applyEnrichedOverride(
      base,
      regiao,
      'guindaste industrial',
      base.categoryLabel,
      buildGuindasteEnrichment(regiao),
      buildGuindasteFaqs(regiao),
      'Atendemos içamento em plantas, pátios e frentes de montagem com orientação de capacidade e raio.',
    );
  }

  if (category === 'manipuladores-telescopicos' && MANIPULADOR_CITIES.has(city)) {
    return applyEnrichedOverride(
      base,
      regiao,
      'manipuladores telescópicos',
      base.categoryLabel,
      buildManipuladorEnrichment(regiao),
      buildManipuladorFaqs(regiao),
      'Manipuladores telescópicos apoiam movimentação de carga com alcance horizontal e vertical em galpões e pátios.',
    );
  }

  if (category === 'andaimes' && ANDAIMES_CITIES.has(city)) {
    return applyEnrichedOverride(
      base,
      regiao,
      'andaimes',
      base.categoryLabel,
      buildAndaimesEnrichment(regiao),
      buildAndaimesFaqs(regiao),
      'Sistemas de andaime para fachadas, reformas e obras com montagem planejada conforme NR-18.',
    );
  }

  return base;
}

export function isIndustrialEnrichedCombo(
  citySlug: RegiaoCategoriaCitySlug,
  categorySlug: RegiaoCategoriaCategorySlug,
) {
  if (categorySlug === 'guindaste-industrial') {
    return GUINDASTE_CITIES.has(citySlug);
  }
  if (categorySlug === 'manipuladores-telescopicos') {
    return MANIPULADOR_CITIES.has(citySlug);
  }
  if (categorySlug === 'andaimes') {
    return ANDAIMES_CITIES.has(citySlug);
  }
  return false;
}
