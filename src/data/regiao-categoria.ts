import { getRegiaoBySlug, type RegiaoContent } from '@/data/regioes';
import { CATEGORY_LABELS, isEquipmentCategory } from '@/types/equipment';

/** Cities included in the S4 city × category matrix (v1). */
export const REGIAO_CATEGORIA_CITY_SLUGS = [
  'belo-horizonte',
  'contagem',
  'betim',
  'nova-lima',
  'ibirite',
  'ribeirao-das-neves',
] as const;

/** Categories included in the S4 matrix (v1). */
export const REGIAO_CATEGORIA_CATEGORY_SLUGS = [
  'plataformas-elevatorias',
  'guindaste-industrial',
  'manipuladores-telescopicos',
  'andaimes',
] as const;

export type RegiaoCategoriaCitySlug = (typeof REGIAO_CATEGORIA_CITY_SLUGS)[number];
export type RegiaoCategoriaCategorySlug = (typeof REGIAO_CATEGORIA_CATEGORY_SLUGS)[number];

export type RegiaoCategoriaFaq = {
  question: string;
  answer: string;
};

export type RegiaoCategoriaSectionItem = {
  title: string;
  body: string;
};

/** Optional long-form blocks for high-priority city × category landings. */
export type RegiaoCategoriaEnrichment = {
  typesTitle: string;
  types: RegiaoCategoriaSectionItem[];
  propulsionTitle: string;
  propulsion: RegiaoCategoriaSectionItem[];
  heightsTitle: string;
  heights: RegiaoCategoriaSectionItem[];
  whyTitle: string;
  why: string[];
};

export type RegiaoCategoriaContent = {
  citySlug: RegiaoCategoriaCitySlug;
  categorySlug: RegiaoCategoriaCategorySlug;
  path: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  tagline: string;
  intro: string[];
  faqs: RegiaoCategoriaFaq[];
  enrichment: RegiaoCategoriaEnrichment | null;
  regiao: RegiaoContent;
  categoryLabel: string;
};

const CITY_SET = new Set<string>(REGIAO_CATEGORIA_CITY_SLUGS);
const CATEGORY_SET = new Set<string>(REGIAO_CATEGORIA_CATEGORY_SLUGS);

function categoryPhrase(category: RegiaoCategoriaCategorySlug) {
  if (category === 'plataformas-elevatorias') {
    return 'plataformas elevatórias';
  }
  if (category === 'guindaste-industrial') {
    return 'guindaste industrial';
  }
  if (category === 'manipuladores-telescopicos') {
    return 'manipuladores telescópicos';
  }
  return 'andaimes';
}

function focusContext(regiao: RegiaoContent) {
  if (regiao.focus === 'industria') {
    return 'o polo industrial e as rotinas de manutenção de plantas e galpões';
  }
  if (regiao.focus === 'mineracao') {
    return 'operações de mineração, beneficiamento e frentes de campo';
  }
  return 'obras prediais, reformas e serviços urbanos';
}

function clipMetaDescription(value: string) {
  if (value.length <= 160) {
    return value;
  }
  return `${value.slice(0, 157).trimEnd()}…`;
}

/** Contagem × plataformas — página longa para a query “plataformas elevatórias Contagem”. */
function buildContagemPlataformasEnrichment(): RegiaoCategoriaEnrichment {
  return {
    typesTitle: 'Tipos de plataforma elevatória para Contagem',
    types: [
      {
        title: 'Plataforma tesoura em Contagem',
        body:
          'Indicada para galpões, corredores industriais e áreas com piso nivelado. Sobe na vertical com boa estabilidade — comum em manutenção de iluminação, exaustão e estruturas internas no polo de Contagem.',
      },
      {
        title: 'Plataforma articulada em Contagem',
        body:
          'Lança flexível para contornar obstáculos e alcançar fachadas, racks e pontos com interferência. Útil em plantas, docas e áreas externas onde a tesoura não chega.',
      },
      {
        title: 'Plataforma telescópica em Contagem',
        body:
          'Maior alcance vertical e horizontal para frentes altas em pátios, estruturas e manutenção industrial. Indicamos o modelo conforme altura de trabalho e espaço de estabilização.',
      },
      {
        title: 'Plataforma tipo mastro em Contagem',
        body:
          'Opção mais compacta para acessos internos e serviços em altura moderada. Avaliamos vão, piso e capacidade junto com a equipe comercial.',
      },
    ],
    propulsionTitle: 'Elétrica ou diesel — o que faz sentido em Contagem',
    propulsion: [
      {
        title: 'Plataformas elétricas',
        body:
          'Preferidas em ambientes internos, pisos acabados e áreas com restrição de emissão ou ruído — galpões, CDs e áreas de produção onde a operação precisa ser limpa e silenciosa.',
      },
      {
        title: 'Plataformas a diesel',
        body:
          'Indicadas para áreas externas, terrenos mais irregulares e frentes industriais ao ar livre. Em Contagem, são frequentes em pátios, montagens e manutenções de planta.',
      },
    ],
    heightsTitle: 'Alturas de trabalho frequentes',
    heights: [
      {
        title: 'Faixa de 8 a 16 metros',
        body:
          'Atende boa parte das manutenções prediais e industriais em Contagem: iluminação, tubulação, pintura e acesso a mezzaninos.',
      },
      {
        title: 'Faixa de 16 a 26 metros',
        body:
          'Comum em galpões altos, estruturas e serviços externos. No orçamento, confirme altura de trabalho (não só altura da plataforma) e obstáculo no entorno.',
      },
      {
        title: 'Acima de 26 metros',
        body:
          'Para frentes mais altas, a frota inclui lanças de maior alcance. Reservamos com antecedência quando a demanda coincide com paradas programadas.',
      },
    ],
    whyTitle: 'Por que locar com a Acesso em Contagem',
    why: [
      'Base em Belo Horizonte com entrega frequente no eixo industrial de Contagem',
      'Orientação técnica para escolher tesoura, articulada ou telescópica conforme o serviço',
      'Frota revisada e documentação usual de locação para apoiar a obra',
      'Diária, semanal ou mensal — valores sob consulta conforme modelo e logística',
    ],
  };
}

function applyContagemPlataformasOverride(base: RegiaoCategoriaContent): RegiaoCategoriaContent {
  return {
    ...base,
    metaTitle: 'Locação de plataformas elevatórias em Contagem',
    metaDescription: clipMetaDescription(
      'Aluguel de plataforma elevatória em Contagem: tesoura, articulada e telescópica. Entrega a partir de BH, frota revisada e orçamento sob consulta pela Acesso Equipamentos.',
    ),
    tagline:
      'Tesoura, articulada e telescópica para o polo industrial de Contagem — entrega a partir de Belo Horizonte.',
    intro: [
      'A Acesso Equipamentos loca plataformas elevatórias em Contagem com foco no polo industrial e logístico da cidade: galpões, plantas, docas e frentes de manutenção. A operação parte da base em Belo Horizonte, com logística curta para as principais avenidas e distritos industriais.',
      'Nesta página você encontra o recorte local de plataformas elevatórias em Contagem — tipos (tesoura, articulada, telescópica e mastro), propulsão elétrica ou diesel, faixas de altura e acesso ao catálogo. O comercial indica o modelo conforme altura de trabalho, piso, alcance e prazo da obra.',
      'Contagem concentra demanda de paradas programadas, manutenção fabril e montagens. Informe endereço da obra, período (diária, semanal ou mensal) e o tipo de serviço para receber orçamento sob consulta com disponibilidade da frota.',
      'Trabalhamos com marcas e linhas do catálogo publicado no site. Valores não são tabelados online: a proposta considera equipamento, deslocamento e condições do local em Contagem ou no entorno da RMBH.',
    ],
    faqs: [
      {
        question: 'Vocês locam plataformas elevatórias em Contagem?',
        answer:
          'Sim. Atendemos Contagem e o entorno industrial com entrega a partir de Belo Horizonte, conforme disponibilidade da frota e endereço da obra.',
      },
      {
        question: 'Qual a diferença entre plataforma tesoura e articulada para Contagem?',
        answer:
          'A tesoura sobe na vertical e funciona bem em áreas amplas e niveladas (galpões). A articulada contorna obstáculos e alcança pontos laterais — útil em fachadas, racks e plantas com interferências. Indicamos o modelo no orçamento.',
      },
      {
        question: 'Plataforma elétrica ou diesel em Contagem — qual escolher?',
        answer:
          'Elétrica costuma ser melhor em áreas internas e com restrição de emissão. Diesel atende frentes externas e terrenos mais exigentes. Informe se o serviço é interno ou externo para orientar a escolha.',
      },
      {
        question: 'Vocês atendem paradas industriais em Contagem?',
        answer:
          'Sim. Em paradas programadas, recomendamos antecipar a reserva para garantir altura e quantidade de equipamentos no período crítico.',
      },
      {
        question: 'Preciso de treinamento para operar a plataforma?',
        answer:
          'A operação de plataformas exige capacitação alinhada às normas aplicáveis (como NR-18). A locação inclui a documentação técnica usual do equipamento; o comercial orienta sobre o que a obra precisa organizar.',
      },
      {
        question: 'Como pedir orçamento de plataforma elevatória em Contagem?',
        answer:
          'Pelo WhatsApp ou formulário: informe altura aproximada, interno/externo, endereço em Contagem e prazo. Retornamos com disponibilidade e condições sob consulta.',
      },
    ],
    enrichment: buildContagemPlataformasEnrichment(),
  };
}

/**
 * Builds unique long-tail copy for a city × category landing.
 */
export function buildRegiaoCategoriaContent(
  citySlug: string,
  categorySlug: string,
): RegiaoCategoriaContent | null {
  if (!CITY_SET.has(citySlug) || !CATEGORY_SET.has(categorySlug)) {
    return null;
  }
  const regiao = getRegiaoBySlug(citySlug);
  if (!regiao) {
    return null;
  }

  const typedCity = citySlug as RegiaoCategoriaCitySlug;
  const typedCategory = categorySlug as RegiaoCategoriaCategorySlug;
  const categoryLabel = CATEGORY_LABELS[typedCategory];
  const phrase = categoryPhrase(typedCategory);
  const path = `/regioes/${typedCity}/${typedCategory}`;
  const h1 = `Locação de ${phrase} em ${regiao.name}`;
  const metaTitle = `${categoryLabel} em ${regiao.name} | Acesso`;
  const metaDescription = `Aluguel de ${phrase} em ${regiao.name}. Entrega a partir de BH pela Acesso Equipamentos, com frota revisada e orçamento sob consulta.`;
  const tagline = `Frota revisada e logística a partir de Belo Horizonte para ${phrase} em ${regiao.name}.`;

  const intro = [
    `A Acesso Equipamentos atende ${regiao.name} com locação de ${phrase}, com entrega e retirada alinhadas ao cronograma da obra ou da planta. A operação parte da base em Belo Horizonte e cobre ${focusContext(regiao)} na região.`,
    `Use esta página para o recorte local de ${categoryLabel.toLowerCase()}: logística para ${regiao.name}, orientação técnica na escolha do modelo e acesso rápido ao catálogo da linha. Valores são sob consulta conforme período, entrega e condições do local.`,
    `Para orçamento em ${regiao.name}, informe endereço, prazo e tipo de serviço. Trabalhamos com diárias, semanais e mensais conforme o equipamento e a disponibilidade da frota.`,
  ];

  const faqs: RegiaoCategoriaFaq[] = [
    {
      question: `Vocês locam ${phrase} em ${regiao.name}?`,
      answer: `Sim. Atendemos ${regiao.name} e o entorno com entrega a partir da base em Belo Horizonte, conforme disponibilidade da frota.`,
    },
    {
      question: `Qual o prazo de entrega em ${regiao.name}?`,
      answer:
        'Combinamos data e horário com o cliente. Em muitas frentes da RMBH conseguimos prazos curtos; confirme no orçamento com o endereço da obra.',
    },
    {
      question: `Como escolher o modelo certo de ${phrase}?`,
      answer: `Informe altura ou carga, tipo de piso/acesso e o serviço. Nossa equipe indica o item do catálogo de ${categoryLabel.toLowerCase()} mais adequado.`,
    },
    {
      question: 'Posso ver outros equipamentos da mesma linha?',
      answer: `Sim. Acesse a categoria ${categoryLabel.toLowerCase()} no catálogo ou fale com o comercial para montar a proposta com mais de um item.`,
    },
  ];

  const base: RegiaoCategoriaContent = {
    citySlug: typedCity,
    categorySlug: typedCategory,
    path,
    h1,
    metaTitle: metaTitle.length > 60 ? `${phrase} em ${regiao.name} | Acesso` : metaTitle,
    metaDescription: clipMetaDescription(metaDescription),
    tagline,
    intro,
    faqs,
    enrichment: null,
    regiao,
    categoryLabel,
  };

  if (typedCity === 'contagem' && typedCategory === 'plataformas-elevatorias') {
    return applyContagemPlataformasOverride(base);
  }

  return base;
}

/** All static params for the S4 matrix (24 combos). */
export function getAllRegiaoCategoriaParams() {
  const params: { slug: RegiaoCategoriaCitySlug; categoria: RegiaoCategoriaCategorySlug }[] = [];
  for (const slug of REGIAO_CATEGORIA_CITY_SLUGS) {
    for (const categoria of REGIAO_CATEGORIA_CATEGORY_SLUGS) {
      params.push({ slug, categoria });
    }
  }
  return params;
}

export function getAllRegiaoCategoriaPaths() {
  return getAllRegiaoCategoriaParams().map(
    (item) => `/regioes/${item.slug}/${item.categoria}`,
  );
}

export function isRegiaoCategoriaCombo(citySlug: string, categorySlug: string) {
  return CITY_SET.has(citySlug) && CATEGORY_SET.has(categorySlug) && isEquipmentCategory(categorySlug);
}

/**
 * Categories from the S4 matrix available for a given city page.
 */
export function getRegiaoCategoriaLinksForCity(citySlug: string) {
  if (!CITY_SET.has(citySlug)) {
    return [];
  }
  return REGIAO_CATEGORIA_CATEGORY_SLUGS.map((categoria) => ({
    categoria,
    label: CATEGORY_LABELS[categoria],
    href: `/regioes/${citySlug}/${categoria}`,
  }));
}
