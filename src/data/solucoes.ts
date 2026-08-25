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
    metaTitle: 'Locação para mineração na RMBH | Acesso',
    metaDescription:
      'Equipamentos para mineração e frentes de campo: guindastes, manipuladores e ferramentas a combustão. Atendimento da Acesso Equipamentos na RMBH.',
    tagline: 'Frota robusta para frentes de mineração, terrenos exigentes e áreas sem energia.',
    intro: [
      'Operações de mineração na região metropolitana de Belo Horizonte exigem equipamentos com capacidade de carga, autonomia e logística confiável. A Acesso Equipamentos atende frentes de serviço com guindastes industriais, manipuladores telescópicos e ferramentas a combustão, a partir da base em BH.',
      'Orientamos a escolha conforme o tipo de içamento, o alcance necessário e as condições do terreno — com manutenção própria da frota e prazos alinhados ao cronograma da operação.',
    ],
    challenges: [
      'Terrenos irregulares e acessos remotos',
      'Içamento e movimentação de cargas pesadas',
      'Operação em áreas sem rede elétrica estável',
    ],
    applications: [
      'Içamento e remoção de estruturas e equipamentos',
      'Movimentação de materiais em pátio e frente de serviço',
      'Manutenção de instalações e infraestrutura',
      'Apoio a frentes com ferramentas a combustão',
    ],
    highlights: [
      'Guindastes e manipuladores para carga e alcance',
      'Ferramentas a combustão para autonomia em campo',
      'Logística a partir de BH para Nova Lima, Brumadinho e Sabará',
    ],
    faqs: [
      {
        question: 'A Acesso atende operações de mineração?',
        answer:
          'Sim. Atendemos frentes de mineração e serviços correlatos na RMBH com frota preparada para carga, alcance e áreas remotas.',
      },
      {
        question: 'Vocês locam guindaste industrial para mineração?',
        answer:
          'Sim. O guindaste industrial é indicado para içamento e remoção técnica. O modelo e a capacidade são definidos no orçamento conforme a carga e o raio de trabalho.',
      },
      {
        question: 'É possível operar sem energia elétrica na frente?',
        answer:
          'Sim. Trabalhamos com ferramentas a combustão para locais sem rede elétrica, com autonomia para operações em campo.',
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
    h1: 'Soluções para indústria',
    metaTitle: 'Locação para indústria na RMBH | Acesso',
    metaDescription:
      'Plataformas, manipuladores e ferramentas para paradas e manutenção industrial. Acesso Equipamentos atende Contagem, Betim e região.',
    tagline: 'Apoio a paradas programadas, manutenção fabril e obras industriais.',
    intro: [
      'Indústrias da RMBH dependem de equipamentos disponíveis no prazo da parada e compatíveis com galpões, linhas de produção e áreas de manutenção. A Acesso Equipamentos fornece plataformas elevatórias, manipuladores telescópicos e ferramentas para essas operações.',
      'Atendemos polos como Contagem, Betim e Ibirité com entrega organizada e orientação técnica para altura de trabalho, alcance e capacidade de carga.',
    ],
    challenges: [
      'Janelas curtas de parada programada',
      'Acesso em altura em galpões e estruturas',
      'Movimentação de peças e componentes no pátio',
    ],
    applications: [
      'Manutenção de cobertura, estrutura e utilidades',
      'Instalação e troca de equipamentos industriais',
      'Pintura, inspeção e limpeza em altura',
      'Movimentação com manipulador telescópico',
    ],
    highlights: [
      'Plataformas tesoura e articuladas para galpões',
      'Manipuladores para carga e alcance no pátio',
      'Atendimento ágil no eixo industrial da RMBH',
    ],
    faqs: [
      {
        question: 'Vocês atendem paradas industriais?',
        answer:
          'Sim. Recomendamos alinhar a demanda com antecedência para reservar a frota no período da parada e evitar imprevistos no cronograma.',
      },
      {
        question: 'Qual plataforma usar em galpão industrial?',
        answer:
          'Tesouras são indicadas para áreas amplas e subida vertical. Articuladas alcançam pontos com obstáculos. Nossa equipe ajuda a definir o modelo.',
      },
      {
        question: 'A Acesso entrega em Contagem e Betim?',
        answer:
          'Sim. Contagem e Betim fazem parte da nossa rota diária a partir da base em Belo Horizonte.',
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
    metaTitle: 'Locação para siderurgia | Acesso',
    metaDescription:
      'Guindastes, plataformas e manipuladores para manutenção e montagens em ambientes siderúrgicos. Frota da Acesso Equipamentos na RMBH.',
    tagline: 'Equipamentos para manutenção pesada, montagens e içamento em siderurgia.',
    intro: [
      'Ambientes siderúrgicos exigem equipamentos robustos, documentação técnica e logística precisa. A Acesso Equipamentos apoia manutenções e montagens com guindastes industriais, plataformas elevatórias e manipuladores telescópicos.',
      'Definimos juntos capacidade de içamento, altura de trabalho e condições de acesso, com frota revisada e suporte durante a locação.',
    ],
    challenges: [
      'Içamento de cargas com exigências de segurança',
      'Acesso em altura em estruturas industriais',
      'Coordenação logística em áreas restritas',
    ],
    applications: [
      'Remoção e instalação de equipamentos pesados',
      'Manutenção de estruturas e utilidades',
      'Trabalho em altura com plataformas',
      'Movimentação de materiais com manipulador',
    ],
    highlights: [
      'Guindaste industrial para içamento técnico',
      'Plataformas para acesso seguro em altura',
      'Suporte técnico próximo durante a locação',
    ],
    faqs: [
      {
        question: 'A Acesso atende plantas siderúrgicas?',
        answer:
          'Sim. Atendemos operações siderúrgicas e industriais pesadas na RMBH com frota adequada a içamento e trabalho em altura.',
      },
      {
        question: 'Como é definida a capacidade do guindaste?',
        answer:
          'Avaliamos carga, raio, altura e condições do local. A proposta indica o equipamento compatível com esses parâmetros.',
      },
      {
        question: 'Há documentação técnica dos equipamentos?',
        answer:
          'Sim. A frota passa por manutenção própria e acompanha documentação técnica para apoiar os requisitos da operação.',
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
    metaTitle: 'Locação para construção civil em BH | Acesso',
    metaDescription:
      'Plataformas, andaimes e ferramentas para obras e reformas na RMBH. Locação com entrega na obra pela Acesso Equipamentos.',
    tagline: 'Frota para obras, fachadas, reformas e acabamento na região metropolitana.',
    intro: [
      'Construtoras e empreiteiras na RMBH precisam de acesso em altura, andaimes e ferramentas no ritmo do canteiro. A Acesso Equipamentos oferece plataformas elevatórias, andaimes e ferramentas elétricas com entrega e retirada na obra.',
      'Atendemos obras residenciais, comerciais e prediais em Belo Horizonte, Ribeirão das Neves, Santa Luzia e demais cidades da região.',
    ],
    challenges: [
      'Acesso seguro em fachadas e pavimentos',
      'Montagem de andaimes conforme a etapa da obra',
      'Ferramentas disponíveis no prazo do acabamento',
    ],
    applications: [
      'Pintura e manutenção de fachadas',
      'Instalações elétricas e hidráulicas em altura',
      'Montagem de andaimes e escoramentos',
      'Acabamento com ferramentas elétricas',
    ],
    highlights: [
      'Plataformas e andaimes para obra urbana',
      'Ferramentas elétricas para o canteiro',
      'Entrega e retirada alinhadas ao cronograma',
    ],
    faqs: [
      {
        question: 'Vocês entregam equipamento na obra?',
        answer:
          'Sim. Realizamos entrega e retirada na obra na RMBH, conforme o tipo de equipamento e a programação da frota.',
      },
      {
        question: 'Dá para locar andaimes e plataformas juntos?',
        answer:
          'Sim. Muitas obras combinam andaimes e plataformas. O comercial monta a proposta com os itens necessários ao período.',
      },
      {
        question: 'Há locação diária para reformas?',
        answer:
          'Sim. Trabalhamos com diárias, semanas e meses. O prazo mínimo depende do equipamento e é confirmado no orçamento.',
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
    metaTitle: 'Locação para manutenção industrial | Acesso',
    metaDescription:
      'Plataformas e ferramentas para manutenção predial e industrial na RMBH. Orçamento rápido com a Acesso Equipamentos.',
    tagline: 'Equipamentos para inspeção, reparo e intervenção rápida em plantas e prédios.',
    intro: [
      'Manutenção industrial e predial exige mobilidade, altura de trabalho adequada e ferramentas certas no momento da intervenção. A Acesso Equipamentos disponibiliza plataformas elevatórias e ferramentas elétricas ou a combustão conforme o ambiente.',
      'Atendemos equipes de manutenção em Contagem, Betim, Sarzedo e demais cidades da RMBH, com foco em agilidade e orientação técnica.',
    ],
    challenges: [
      'Intervenções com prazo curto',
      'Acesso pontual em altura sem montar estrutura fixa',
      'Ambientes internos e externos na mesma operação',
    ],
    applications: [
      'Inspeção e reparo de cobertura e estruturas',
      'Manutenção de iluminação e utilidades',
      'Troca de componentes em linha e utilidades',
      'Serviços em áreas sem energia com combustão',
    ],
    highlights: [
      'Plataformas compactas e articuladas para manutenção',
      'Ferramentas elétricas e a combustão sob demanda',
      'Resposta alinhada ao horário comercial da operação',
    ],
    faqs: [
      {
        question: 'Consigo locar plataforma só por alguns dias?',
        answer:
          'Sim. Locações curtas são comuns em manutenção. Confirmamos prazo mínimo e disponibilidade no orçamento.',
      },
      {
        question: 'Atendem manutenção predial em condomínios?',
        answer:
          'Sim. Atendemos manutenção predial e industrial com equipamentos adequados ao tipo de acesso e ao local.',
      },
      {
        question: 'Há orientação para escolher a altura certa?',
        answer:
          'Sim. Informe a altura de trabalho e o ambiente (interno/externo). Indicamos o modelo mais adequado.',
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
    metaTitle: 'Locação para logística e galpões | Acesso',
    metaDescription:
      'Manipuladores e plataformas para galpões, centros de distribuição e pátios. Atendimento da Acesso Equipamentos na RMBH.',
    tagline: 'Movimentação e acesso em galpões, CD e operações logísticas.',
    intro: [
      'Centros de distribuição e galpões precisam movimentar cargas e acessar altura com segurança e produtividade. A Acesso Equipamentos oferece manipuladores telescópicos e plataformas elevatórias para essas operações.',
      'Atendemos o eixo logístico da RMBH — Contagem, Betim e entorno — com frota revisada e suporte para definir alcance, capacidade e tipo de plataforma.',
    ],
    challenges: [
      'Movimentação de pallets e materiais em pátio',
      'Acesso a prateleiras e estruturas elevadas',
      'Operação contínua com pouca folga no cronograma',
    ],
    applications: [
      'Movimentação com manipulador telescópico',
      'Inventário e organização em altura',
      'Manutenção de cobertura e sistemas do galpão',
      'Apoio a montagem de estruturas leves',
    ],
    highlights: [
      'Manipulador telescópico para carga e alcance',
      'Plataformas para inventário e manutenção',
      'Logística próxima aos polos de Contagem e Betim',
    ],
    faqs: [
      {
        question: 'O manipulador telescópico serve para galpão?',
        answer:
          'Sim. É muito usado em pátios e operações logísticas para movimentar cargas com alcance. Confirmamos capacidade e acessórios no orçamento.',
      },
      {
        question: 'Vocês atendem centros de distribuição?',
        answer:
          'Sim. Atendemos CDs e galpões na RMBH com entrega programada conforme a operação.',
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
    metaTitle: 'Locação para montagens industriais | Acesso',
    metaDescription:
      'Guindastes, plataformas e manipuladores para montagem de estruturas e equipamentos. Acesso Equipamentos na RMBH.',
    tagline: 'Içamento, acesso em altura e movimentação para montagens industriais.',
    intro: [
      'Montagens industriais reúnem içamento, posicionamento de peças e trabalho em altura no mesmo projeto. A Acesso Equipamentos combina guindastes industriais, plataformas elevatórias e manipuladores telescópicos para essas frentes.',
      'Apoiamos empreiteiras e prestadores em Contagem, Betim, Ibirité e demais cidades da RMBH, com orientação para capacidade, alcance e sequência logística.',
    ],
    challenges: [
      'Içamento preciso de estruturas e equipamentos',
      'Acesso simultâneo de equipes em altura',
      'Coordenação de vários equipamentos no canteiro',
    ],
    applications: [
      'Montagem de estruturas metálicas',
      'Instalação de máquinas e módulos',
      'Trabalho em altura com plataformas',
      'Movimentação auxiliar com manipulador',
    ],
    highlights: [
      'Guindaste para içamento técnico',
      'Plataformas e manipuladores no mesmo projeto',
      'Equipe técnica para dimensionar a frota',
    ],
    faqs: [
      {
        question: 'Dá para locar guindaste e plataforma juntos?',
        answer:
          'Sim. Montagens costumam exigir mais de um tipo de equipamento. O comercial organiza a proposta unificada.',
      },
      {
        question: 'Como antecipar a reserva da frota?',
        answer:
          'Envie o cronograma, cargas estimadas e alturas de trabalho. Assim reservamos os equipamentos com maior previsibilidade.',
      },
      {
        question: 'Atendem montagens em áreas industriais da RMBH?',
        answer:
          'Sim. Atendemos montagens industriais a partir da base em Belo Horizonte, com foco no eixo Contagem–Betim–Ibirité.',
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
 */
export function getSolucoesForCategory(category: EquipmentCategory, limit = 3) {
  return SOLUCOES.filter((solucao) => solucao.featuredCategorySlugs.includes(category)).slice(
    0,
    limit,
  );
}
