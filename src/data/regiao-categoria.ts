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

  return {
    citySlug: typedCity,
    categorySlug: typedCategory,
    path,
    h1,
    metaTitle: metaTitle.length > 60 ? `${phrase} em ${regiao.name} | Acesso` : metaTitle,
    metaDescription:
      metaDescription.length > 160
        ? metaDescription.slice(0, 157).trimEnd() + '…'
        : metaDescription,
    tagline,
    intro,
    faqs,
    regiao,
    categoryLabel,
  };
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
