export type DicaSection = {
  heading?: string;
  paragraphs: string[];
};

export type DicaArticle = {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  publishedAt: string;
  readingMinutes: number;
  excerpt: string;
  sections: DicaSection[];
  relatedLinks: { label: string; href: string }[];
};

/** Artigos informacionais para SEO local (Sprint 9.4). */
export const DICAS_ARTICLES: DicaArticle[] = [
  {
    slug: 'como-escolher-plataforma-elevatoria-bh',
    title: 'Como escolher plataforma elevatória para sua obra em BH',
    metaTitle: 'Como escolher plataforma elevatória em BH | Dicas Acesso',
    metaDescription:
      'Tesoura, lança articulada ou empurrar: critérios para locar plataforma elevatória em Belo Horizonte e região metropolitana.',
    publishedAt: '2026-05-21',
    readingMinutes: 6,
    excerpt:
      'Altura de trabalho, terreno, espaço no canteiro e classificação ABNT ajudam a definir o modelo certo antes do orçamento.',
    sections: [
      {
        paragraphs: [
          'A locação de plataforma elevatória em Belo Horizonte e na região metropolitana começa pelo tipo de serviço: manutenção de fachada, instalação elétrica, montagem de estrutura metálica ou obra em galpão. Cada cenário exige altura de trabalho, raio de alcance e capacidade de carga diferentes — e escolher errado gera retrabalho, atraso ou risco desnecessário.',
          'Plataformas tipo tesoura (laje) são indicadas para trabalhos verticais em áreas planas, com boa capacidade de carga e estabilidade em pisos firmes. Já lanças articuladas permitem contornar obstáculos e atingir pontos de difícil acesso. Modelos de empurrar atendem corredores estreitos e alturas menores. A classificação ABNT (NBR 16776) — grupos 3A, 3B e 1A — orienta requisitos de estabilidade e uso; nossa equipe comercial ajuda a cruzar essa informação com o manual do fabricante.',
        ],
      },
      {
        heading: 'O que informar no orçamento',
        paragraphs: [
          'Ao solicitar orçamento, descreva altura aproximada do serviço, tipo de piso (interno/externo), voltagem disponível no canteiro, período de locação e endereço da obra. Com esses dados indicamos modelos disponíveis na frota, condições de entrega e retirada e, se necessário, treinamento em operação segura alinhado à NR-18.',
          'A Acesso Equipamentos atende construtoras, empreiteiras e indústrias em MG desde 2013. Valores sob consulta; resposta comercial em horário útil por formulário ou WhatsApp.',
        ],
      },
    ],
    relatedLinks: [
      { label: 'Aluguel de plataforma elevatória', href: '/categorias/plataformas-elevatorias' },
      { label: 'Treinamento em plataformas elevatórias', href: '/treinamento-plataformas-aereas' },
    ],
  },
  {
    slug: 'locacao-betoneira-quando-faz-sentido',
    title: 'Locação de betoneira: quando faz sentido na obra',
    metaTitle: 'Locação de betoneira em BH — quando vale a pena | Dicas Acesso',
    metaDescription:
      'Compare locação e compra de betoneira para fundações, lajes e reformas em Belo Horizonte. Prazos, logística e custo total.',
    publishedAt: '2026-05-21',
    readingMinutes: 5,
    excerpt:
      'Para obras com volume de concreto concentrado em poucos dias, alugar betoneira e vibrador costuma ser mais ágil que comprar equipamento.',
    sections: [
      {
        paragraphs: [
          'Betoneiras e vibradores de imersão são itens de alta rotatividade em fundações, contrapisos e reformas estruturais. Na região de Belo Horizonte, a locação faz sentido quando o uso é pontual — alguns dias ou semanas — ou quando a obra precisa de capacidades diferentes em fases distintas (por exemplo, 400 litros na fundação e modelo menor no acabamento).',
          'Comprar equipamento imobiliza capital e exige manutenção, armazenamento e transporte entre obras. Locar concentra custo no período produtivo e permite combinar mangotes, agulhas vibratórias e bombas de mangote na mesma proposta, simplificando a logística do canteiro.',
        ],
      },
      {
        heading: 'Checklist antes de reservar',
        paragraphs: [
          'Confirme voltagem (monofásica ou trifásica), acesso para entrega do equipamento e volume estimado de concreto por dia. Informe também se há necessidade de peças complementares. A Acesso combina entrega e retirada na região metropolitana de BH conforme disponibilidade da frota.',
        ],
      },
    ],
    relatedLinks: [
      { label: 'Ferramentas elétricas', href: '/categorias/ferramentas-eletricas' },
      { label: 'Solicitar orçamento', href: '/orcamento' },
    ],
  },
  {
    slug: 'nr-12-trabalho-em-altura-locacao',
    title: 'NR-12 e trabalho em altura na locação de equipamentos',
    metaTitle: 'NR-12 e locação de plataforma elevatória | Dicas Acesso',
    metaDescription:
      'Responsabilidades do locador e do contratante na locação de plataformas elevatórias. Treinamento, EPI e documentação em MG.',
    publishedAt: '2026-05-21',
    readingMinutes: 5,
    excerpt:
      'Locar plataforma elevatória exige operador capacitado, EPI adequado e planejamento do canteiro — além do equipamento em conformidade.',
    sections: [
      {
        paragraphs: [
          'A locação de plataforma elevatória está ligada às normas de segurança do trabalho, em especial à NR-12 (máquinas e equipamentos) e às regras de trabalho em altura. O locador deve fornecer equipamento em condições de uso, com manutenção preventiva e documentação compatível com a legislação aplicável. O contratante da obra organiza o canteiro, define procedimentos, fornece EPIs e garante que apenas pessoas autorizadas e capacitadas operem a máquina.',
        ],
      },
      {
        heading: 'Treinamento e operação segura',
        paragraphs: [
          'A Acesso Equipamentos oferece treinamento em operação de plataformas elevatórias, com conteúdo alinhado à NR-18 e boas práticas de trabalho em altura — ideal para empresas que desejam padronizar equipes antes de iniciar serviços em altura. Combine locação + capacitação na mesma obra para reduzir risco e retrabalho.',
          'Antes de mobilizar o equipamento, avalie solo, inclinação, proximidade de redes elétricas e delimitação da área. Em caso de dúvida sobre o modelo adequado à classificação ABNT do serviço, consulte nosso comercial com a descrição da atividade e do local.',
        ],
      },
    ],
    relatedLinks: [
      { label: 'Treinamento em plataformas elevatórias', href: '/treinamento-plataformas-aereas' },
      { label: 'Perguntas frequentes', href: '/faq' },
    ],
  },
  {
    slug: 'andaime-ou-plataforma-elevatoria-reforma',
    title: 'Andaime ou plataforma elevatória na reforma?',
    metaTitle: 'Andaime ou plataforma elevatória na reforma | Dicas Acesso',
    metaDescription:
      'Quando usar andaime tubular ou plataforma elevatória em reformas e manutenção em Belo Horizonte e RMBH.',
    publishedAt: '2026-05-21',
    readingMinutes: 4,
    excerpt:
      'Andaimes estruturam acesso contínuo em fachadas amplas; plataformas elevatórias ganham em mobilidade e produtividade em pontos específicos.',
    sections: [
      {
        paragraphs: [
          'Em reformas prediais e comerciais na região metropolitana de BH, andaimes tubulares continuam essenciais para fachadas longas, pintura geral e montagem de acesso fixo por vários dias. Já plataformas elevatórias — tesouras ou lanças — aceleram serviços pontuais: troca de luminárias, dutos, pequenas intervenções em altura ou manutenção industrial onde o deslocamento horizontal importa.',
          'Em muitos canteiros, a solução é combinar: andaime para frentes extensas e plataforma para frentes críticas ou internas. A Acesso loca ambas as linhas, o que reduz fornecedores e simplifica entrega na obra.',
        ],
      },
      {
        heading: 'Próximo passo',
        paragraphs: [
          'Descreva altura do serviço, duração e endereço da obra no orçamento. Indicamos quantitativos de andaime ou modelo de plataforma conforme disponibilidade e normas de montagem aplicáveis.',
        ],
      },
    ],
    relatedLinks: [
      { label: 'Andaimes', href: '/categorias/andaimes' },
      { label: 'Aluguel de plataforma elevatória', href: '/categorias/plataformas-elevatorias' },
    ],
  },
];

export function getAllDicaSlugs() {
  return DICAS_ARTICLES.map((article) => article.slug);
}

/**
 * Maps dica slug to publishedAt for sitemap lastModified.
 */
export function getDicaLastModifiedBySlug() {
  return new Map(
    DICAS_ARTICLES.map((article) => [article.slug, new Date(article.publishedAt)] as const),
  );
}

export function getDicaBySlug(slug: string) {
  return DICAS_ARTICLES.find((article) => article.slug === slug);
}
