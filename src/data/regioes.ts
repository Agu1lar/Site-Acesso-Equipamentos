import { EQUIPMENT_CATEGORY_ORDER, type EquipmentCategory } from '@/types/equipment';

export type RegiaoFocus = 'metropole' | 'industria' | 'mineracao';

export type RegiaoFaq = {
  question: string;
  answer: string;
};

export type RegiaoContent = {
  slug: string;
  name: string;
  focus: RegiaoFocus;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  tagline: string;
  intro: string[];
  highlights: string[];
  faqs: RegiaoFaq[];
  featuredCategorySlugs: EquipmentCategory[];
  nearbySlugs: string[];
  /** Public path under /regioes/… */
  heroImage: string;
  heroAlt: string;
};

/** BH, Contagem, Betim e Nova Lima — todas as categorias no bloco “mais pedidos”. */
const FEATURED_CATEGORIES_CORE_CITIES: EquipmentCategory[] = [...EQUIPMENT_CATEGORY_ORDER];

/** Demais cidades — sem ferramentas elétricas nem à combustão. */
const FEATURED_CATEGORIES_WITHOUT_TOOLS: EquipmentCategory[] = EQUIPMENT_CATEGORY_ORDER.filter(
  (category) => category !== 'ferramentas-eletricas' && category !== 'ferramentas-combustao',
);

const REGIOES: RegiaoContent[] = [
  {
    slug: 'belo-horizonte',
    name: 'Belo Horizonte',
    focus: 'metropole',
    h1: 'Locação de equipamentos em Belo Horizonte',
    metaTitle: 'Locação de equipamentos em Belo Horizonte | Acesso',
    metaDescription:
      'Aluguel de plataformas, andaimes e ferramentas em Belo Horizonte. Atendimento rápido em toda a capital pela Acesso Equipamentos, desde 2013.',
    tagline: 'Frota completa e entrega ágil para obras, indústrias e eventos na capital mineira.',
    intro: [
      'Belo Horizonte concentra a maior parte da nossa operação e é o ponto de partida da logística da Acesso Equipamentos para toda a região metropolitana. Desde 2013, atendemos construtoras, empreiteiras, indústrias e produtores de eventos na capital com frota diversificada e manutenção própria.',
      'Da região Centro-Sul aos bairros da Pampulha, Barreiro, Venda Nova e Nordeste, entregamos plataformas elevatórias, andaimes e ferramentas com agilidade. A equipe técnica orienta a escolha do equipamento certo para cada obra, ajudando a evitar paradas e retrabalho.',
    ],
    highlights: [
      'Frota ampla de plataformas, andaimes e ferramentas para obras urbanas e prediais',
      'Entrega ágil em muitos bairros a partir da base local',
      'Equipe técnica orienta a escolha do equipamento certo para cada aplicação',
    ],
    faqs: [
      {
        question: 'A Acesso Equipamentos tem sede em Belo Horizonte?',
        answer:
          'Sim. Nossa operação está sediada em Belo Horizonte desde 2013, atendendo toda a capital e a região metropolitana.',
      },
      {
        question: 'Como funciona a entrega dos equipamentos em BH?',
        answer:
          'Combinamos data e horário com o cliente, considerando o cronograma da obra. Em muitas regiões da capital conseguimos prazos curtos.',
      },
      {
        question: 'Vocês atendem obras em condomínios e áreas residenciais?',
        answer:
          'Sim. Atendemos obras prediais, reformas em condomínios, pintura de fachadas e instalações comerciais, com equipamentos compatíveis com cada tipo de acesso.',
      },
      {
        question: 'É possível alugar equipamentos por um único dia em Belo Horizonte?',
        answer:
          'Sim. Trabalhamos com locações diárias, semanais e mensais. O prazo mínimo depende do equipamento e é confirmado no orçamento.',
      },
    ],
    featuredCategorySlugs: FEATURED_CATEGORIES_CORE_CITIES,
    nearbySlugs: ['contagem', 'nova-lima', 'sabara', 'ribeirao-das-neves'],
    heroImage: '/regioes/belo-horizonte-hero.webp',
    heroAlt: 'Plataforma elevatória em obra urbana em Belo Horizonte',
  },
  {
    slug: 'contagem',
    name: 'Contagem',
    focus: 'industria',
    h1: 'Locação de equipamentos em Contagem',
    metaTitle: 'Locação de equipamentos em Contagem | Acesso',
    metaDescription:
      'Aluguel de plataformas elevatórias, manipuladores e ferramentas em Contagem. Suporte técnico da Acesso Equipamentos para o polo industrial da RMBH.',
    tagline: 'Frota preparada para o polo industrial e logístico vizinho a Belo Horizonte.',
    intro: [
      'Contagem é um dos principais polos industriais e logísticos de Minas Gerais, com forte demanda por locação de equipamentos para manutenção fabril, galpões e novas construções. A Acesso Equipamentos atende a cidade a partir da base em Belo Horizonte, com entrega para as principais avenidas industriais.',
      'Trabalhamos com clientes de metalurgia, alimentos, logística e construção civil, oferecendo plataformas elevatórias, manipuladores telescópicos e ferramentas. O suporte técnico ajuda a definir o modelo ideal para cada aplicação e altura de trabalho.',
    ],
    highlights: [
      'Equipamentos para manutenção fabril, galpões logísticos e obras industriais',
      'Logística curta a partir de BH, com entrega ágil no eixo industrial',
      'Suporte técnico para definir alcance, capacidade e modelo ideal',
    ],
    faqs: [
      {
        question: 'Vocês entregam equipamentos em Contagem?',
        answer:
          'Sim. Contagem é uma das cidades que mais atendemos, com entrega a partir da base em Belo Horizonte para todas as regiões da cidade.',
      },
      {
        question: 'Locam equipamentos para paradas industriais em Contagem?',
        answer:
          'Sim. Atendemos manutenções programadas e paradas em indústrias com frota disponível e prazos alinhados ao cronograma da parada.',
      },
      {
        question: 'Qual a diferença entre plataforma tesoura e articulada para uso em galpões?',
        answer:
          'A tesoura sobe na vertical e é indicada para áreas amplas. A articulada tem lança flexível e alcança pontos com obstáculos. Nossa equipe ajuda a definir a melhor opção.',
      },
      {
        question: 'É necessário treinamento para operar plataformas elevatórias?',
        answer:
          'Sim. A NR-18 exige capacitação para operação de plataformas. A locação inclui a documentação técnica dos equipamentos para apoiar o cumprimento da norma.',
      },
    ],
    featuredCategorySlugs: FEATURED_CATEGORIES_CORE_CITIES,
    nearbySlugs: ['belo-horizonte', 'betim', 'ibirite', 'ribeirao-das-neves'],
    heroImage: '/regioes/contagem-hero.webp',
    heroAlt: 'Plataforma articulada em área industrial de Contagem',
  },
  {
    slug: 'betim',
    name: 'Betim',
    focus: 'industria',
    h1: 'Locação de equipamentos em Betim',
    metaTitle: 'Locação de equipamentos em Betim | Acesso',
    metaDescription:
      'Aluguel de plataformas elevatórias, manipuladores telescópicos e ferramentas em Betim. Atendimento industrial pela Acesso Equipamentos, base em BH.',
    tagline: 'Apoio para paradas técnicas e manutenções em um dos maiores parques industriais do país.',
    intro: [
      'Betim reúne um dos parques industriais mais relevantes do país, com destaque para os setores automotivo, petroquímico e de autopeças. A Acesso Equipamentos abastece essa demanda com frota preparada para manutenções programadas, paradas técnicas e novas instalações, partindo da sede em Belo Horizonte.',
      'Atendemos indústrias, empreiteiras e prestadores de serviço com plataformas elevatórias, manipuladores telescópicos e ferramentas a combustão para áreas onde o uso elétrico é limitado. A logística curta com BH ajuda a cumprir prazos apertados.',
    ],
    highlights: [
      'Frota preparada para paradas programadas e manutenções industriais',
      'Entrega organizada para os principais parques industriais da cidade',
      'Manutenção própria dos equipamentos, reduzindo risco de parada em obra',
    ],
    faqs: [
      {
        question: 'A Acesso atende obras industriais em Betim?',
        answer:
          'Sim. Betim faz parte da nossa rota de atendimento a partir de Belo Horizonte, com frota preparada para o parque industrial da cidade.',
      },
      {
        question: 'Vocês têm equipamentos disponíveis para paradas programadas?',
        answer:
          'Sim. Recomendamos alinhar a demanda com antecedência para reservar a frota necessária ao período da parada.',
      },
      {
        question: 'Trabalham com manipulador telescópico em Betim?',
        answer:
          'Sim. Manipuladores telescópicos são muito utilizados em obras industriais e logísticas. Indicamos o modelo conforme capacidade e altura.',
      },
      {
        question: 'Como é feita a manutenção dos equipamentos locados?',
        answer:
          'Toda a frota passa por manutenção própria e inspeções periódicas. Em caso de falha, coordenamos a substituição a partir de BH.',
      },
    ],
    featuredCategorySlugs: FEATURED_CATEGORIES_CORE_CITIES,
    nearbySlugs: ['contagem', 'ibirite', 'sarzedo', 'belo-horizonte'],
    heroImage: '/regioes/betim-hero.webp',
    heroAlt: 'Plataforma tesoura em planta industrial de Betim',
  },
  {
    slug: 'nova-lima',
    name: 'Nova Lima',
    focus: 'mineracao',
    h1: 'Locação de equipamentos em Nova Lima',
    metaTitle: 'Locação de equipamentos em Nova Lima | Acesso',
    metaDescription:
      'Aluguel de guindastes, manipuladores e ferramentas para mineração e obras em Nova Lima. Suporte da Acesso Equipamentos, com base em Belo Horizonte.',
    tagline: 'Equipamentos pesados para mineração e obras verticais no vetor sul da RMBH.',
    intro: [
      'Nova Lima é referência em mineração dentro da região metropolitana de Belo Horizonte, com operações de grande porte e um mercado imobiliário aquecido no vetor sul. A Acesso Equipamentos atende a cidade com equipamentos preparados para trabalho pesado e para obras em condomínios e empresas.',
      'Fornecemos guindastes industriais, manipuladores telescópicos e ferramentas a combustão para frentes em terrenos acidentados e áreas sem energia disponível. A proximidade com a base em BH facilita a reposição rápida quando a obra exige troca de equipamento.',
    ],
    highlights: [
      'Equipamentos para mineração, obras verticais e condomínios de alto padrão',
      'Frota preparada para terrenos acidentados e áreas sem energia',
      'Entrega direta a partir da base em Belo Horizonte',
    ],
    faqs: [
      {
        question: 'Vocês atendem operações de mineração em Nova Lima?',
        answer:
          'Sim. Fornecemos guindastes industriais, manipuladores telescópicos e ferramentas a combustão para operações que exigem carga pesada e trabalho em áreas remotas.',
      },
      {
        question: 'Locam equipamentos para condomínios do vetor sul?',
        answer:
          'Sim. Atendemos obras residenciais, reformas em condomínios e áreas comerciais de Nova Lima, com equipamentos adequados a cada tipo de acesso.',
      },
      {
        question: 'Como é feita a entrega em regiões afastadas do centro da cidade?',
        answer:
          'Organizamos a logística conforme o local e o horário definido pelo cliente. A base em BH facilita a coordenação de entregas em pontos afastados.',
      },
      {
        question: 'É possível locar ferramentas para uso em áreas sem energia?',
        answer:
          'Sim. Trabalhamos com ferramentas a combustão que operam de forma autônoma, ideais para frentes sem acesso à rede elétrica.',
      },
    ],
    featuredCategorySlugs: FEATURED_CATEGORIES_CORE_CITIES,
    nearbySlugs: ['belo-horizonte', 'brumadinho', 'sabara', 'sarzedo'],
    heroImage: '/regioes/nova-lima-hero.webp',
    heroAlt: 'Equipamento de acesso em área de mineração em Nova Lima',
  },
  {
    slug: 'ibirite',
    name: 'Ibirité',
    focus: 'industria',
    h1: 'Locação de equipamentos em Ibirité',
    metaTitle: 'Locação de equipamentos em Ibirité | Acesso',
    metaDescription:
      'Aluguel de plataformas, manipuladores e ferramentas em Ibirité. Atendimento industrial pela Acesso Equipamentos, com base em Belo Horizonte.',
    tagline: 'Frota preparada para paradas técnicas e obras no eixo industrial da RMBH.',
    intro: [
      'Ibirité integra o eixo industrial da região metropolitana de Belo Horizonte, com presença marcante do setor petroquímico e de logística. A Acesso Equipamentos apoia obras, manutenções e paradas técnicas na cidade com equipamentos que atendem exigências específicas de segurança e desempenho.',
      'Oferecemos plataformas elevatórias, manipuladores telescópicos e ferramentas a combustão para áreas industriais e canteiros. A partir da operação em BH, coordenamos entregas em janelas curtas de paradas programadas.',
    ],
    highlights: [
      'Suporte para paradas técnicas, manutenções e obras industriais',
      'Frota compatível com exigências de segurança do setor petroquímico',
      'Logística curta a partir de BH e retirada sem burocracia',
    ],
    faqs: [
      {
        question: 'A Acesso atende Ibirité?',
        answer:
          'Sim. Ibirité é atendida pela operação em Belo Horizonte, com entrega ágil para indústrias, obras e prestadores de serviço na cidade.',
      },
      {
        question: 'Vocês têm equipamentos para paradas em indústrias petroquímicas?',
        answer:
          'Sim. A frota inclui plataformas elevatórias e manipuladores telescópicos com manutenção própria, compatíveis com demandas de paradas técnicas.',
      },
      {
        question: 'Qual o prazo mínimo de locação em Ibirité?',
        answer:
          'Trabalhamos com locações diárias, semanais e mensais. O prazo mínimo depende do equipamento e é confirmado no orçamento.',
      },
      {
        question: 'É possível estender a locação após o prazo inicial?',
        answer:
          'Sim. A prorrogação pode ser combinada com antecedência, sujeita à disponibilidade da frota no período solicitado.',
      },
    ],
    featuredCategorySlugs: FEATURED_CATEGORIES_WITHOUT_TOOLS,
    nearbySlugs: ['betim', 'sarzedo', 'contagem', 'belo-horizonte'],
    heroImage: '/regioes/ibirite-hero.webp',
    heroAlt: 'Equipamentos de acesso em obra industrial em Ibirité',
  },
  {
    slug: 'santa-luzia',
    name: 'Santa Luzia',
    focus: 'industria',
    h1: 'Locação de equipamentos em Santa Luzia',
    metaTitle: 'Locação de equipamentos em Santa Luzia | Acesso',
    metaDescription:
      'Aluguel de plataformas, manipuladores telescópicos e ferramentas em Santa Luzia. Entrega ágil pela Acesso Equipamentos a partir de BH.',
    tagline: 'Frota versátil para indústrias, galpões e obras no vetor nordeste da RMBH.',
    intro: [
      'Santa Luzia combina áreas industriais consolidadas com expansão residencial e de logística no vetor nordeste da região metropolitana de Belo Horizonte. A Acesso Equipamentos atende construtoras, empresas de manutenção predial e indústrias locais com frota versátil e suporte técnico próximo.',
      'Da fabricação de estruturas metálicas à reforma de galpões, disponibilizamos plataformas elevatórias, manipuladores telescópicos e ferramentas em geral. A logística direta a partir de BH garante entrega rápida e retirada sem burocracia ao fim da locação.',
    ],
    highlights: [
      'Equipamentos para reforma de galpões, obras prediais e manutenção industrial',
      'Entrega rápida a partir da base em Belo Horizonte',
      'Frota com manutenção própria e suporte técnico próximo',
    ],
    faqs: [
      {
        question: 'Vocês entregam equipamentos em Santa Luzia?',
        answer:
          'Sim. Santa Luzia é atendida a partir da base em Belo Horizonte, com entrega alinhada ao cronograma da obra ou manutenção.',
      },
      {
        question: 'Locam equipamentos para reforma de galpões?',
        answer:
          'Sim. Plataformas elevatórias e manipuladores telescópicos são muito usados em reforma de galpões, coberturas e estruturas metálicas.',
      },
      {
        question: 'Quais documentos são necessários para locação?',
        answer:
          'Solicitamos documentos básicos da empresa ou pessoa física responsável pela locação. A lista é enviada junto com o orçamento.',
      },
      {
        question: 'É possível trocar o equipamento durante a locação?',
        answer:
          'Sim, sujeito à disponibilidade da frota. Caso a obra exija um modelo diferente, avaliamos a troca antes de reprogramar a entrega.',
      },
    ],
    featuredCategorySlugs: FEATURED_CATEGORIES_WITHOUT_TOOLS,
    nearbySlugs: ['belo-horizonte', 'sabara', 'ribeirao-das-neves', 'contagem'],
    heroImage: '/regioes/santa-luzia-hero.webp',
    heroAlt: 'Plataforma elevatória em galpão industrial em Santa Luzia',
  },
  {
    slug: 'brumadinho',
    name: 'Brumadinho',
    focus: 'mineracao',
    h1: 'Locação de equipamentos em Brumadinho',
    metaTitle: 'Locação de equipamentos em Brumadinho | Acesso',
    metaDescription:
      'Aluguel de guindastes, manipuladores e ferramentas para mineração e obras em Brumadinho. Frota da Acesso Equipamentos com base em BH.',
    tagline: 'Equipamentos robustos para mineração, infraestrutura e frentes de serviço em áreas remotas.',
    intro: [
      'Brumadinho concentra atividades de mineração e obras de infraestrutura no entorno de Belo Horizonte. A Acesso Equipamentos atende essas frentes com equipamentos robustos e preparados para operar em terrenos exigentes.',
      'Disponibilizamos guindastes industriais, manipuladores telescópicos e ferramentas a combustão para áreas remotas do canteiro. A proximidade rodoviária com a base em BH permite reposição ágil e acompanhamento técnico durante a locação.',
    ],
    highlights: [
      'Guindastes e manipuladores para mineração e obras de infraestrutura',
      'Equipamentos preparados para terrenos exigentes e áreas remotas',
      'Reposição ágil a partir da base em Belo Horizonte',
    ],
    faqs: [
      {
        question: 'A Acesso atende operações em Brumadinho?',
        answer:
          'Sim. Atendemos frentes de mineração, obras de infraestrutura e serviços na cidade, com equipamentos preparados para terrenos exigentes.',
      },
      {
        question: 'Trabalham com guindastes industriais para Brumadinho?',
        answer:
          'Sim. Guindastes industriais são utilizados em içamento de cargas pesadas e montagem de estruturas. Definimos o modelo conforme carga e raio de trabalho.',
      },
      {
        question: 'Vocês têm equipamentos que funcionam em áreas sem energia elétrica?',
        answer:
          'Sim. A linha de ferramentas a combustão permite operação em locais sem rede elétrica, com autonomia para frentes remotas.',
      },
      {
        question: 'Como é feito o acompanhamento técnico durante a locação?',
        answer:
          'A equipe fica disponível durante o período de locação. Em caso de dúvidas ou suporte, o atendimento é coordenado a partir de BH.',
      },
    ],
    featuredCategorySlugs: FEATURED_CATEGORIES_WITHOUT_TOOLS,
    nearbySlugs: ['nova-lima', 'sarzedo', 'betim', 'belo-horizonte'],
    heroImage: '/regioes/brumadinho-hero.webp',
    heroAlt: 'Equipamento de acesso em operação de suporte em Brumadinho',
  },
  {
    slug: 'sabara',
    name: 'Sabará',
    focus: 'mineracao',
    h1: 'Locação de equipamentos em Sabará',
    metaTitle: 'Locação de equipamentos em Sabará | Acesso',
    metaDescription:
      'Aluguel de guindastes, manipuladores telescópicos e ferramentas em Sabará. Apoio da Acesso Equipamentos para mineração e obras na cidade.',
    tagline: 'Frota adequada ao relevo local e aos acessos do centro histórico.',
    intro: [
      'Sabará une o legado histórico da mineração em Minas Gerais a uma indústria ativa no eixo leste da região metropolitana de Belo Horizonte. A Acesso Equipamentos apoia obras, reformas e operações industriais na cidade com equipamentos adequados ao relevo local e aos acessos estreitos do centro histórico.',
      'Oferecemos guindastes industriais, manipuladores telescópicos e ferramentas a combustão, com entrega direta a partir de BH. A equipe orienta a escolha considerando altura de trabalho, capacidade de carga e condições do terreno.',
    ],
    highlights: [
      'Frota adequada ao relevo local e aos acessos do centro histórico',
      'Guindastes e manipuladores para mineração e obras de médio porte',
      'Entrega organizada a partir de Belo Horizonte com suporte técnico',
    ],
    faqs: [
      {
        question: 'Vocês atendem obras no centro histórico de Sabará?',
        answer:
          'Sim. Consideramos as restrições de acesso e o relevo local na hora de definir o equipamento ideal para cada obra na cidade.',
      },
      {
        question: 'A Acesso atende operações de mineração em Sabará?',
        answer:
          'Sim. Guindastes industriais, manipuladores telescópicos e ferramentas a combustão compõem a frota para frentes de mineração e obras pesadas.',
      },
      {
        question: 'É possível locar equipamentos por curto prazo?',
        answer:
          'Sim. Trabalhamos com locações diárias, semanais e mensais, com prazo mínimo definido conforme o equipamento escolhido.',
      },
      {
        question: 'Como funciona a entrega em Sabará a partir de Belo Horizonte?',
        answer:
          'A entrega é combinada previamente com o cliente. A proximidade com BH permite prazos curtos e reposição ágil quando necessário.',
      },
    ],
    featuredCategorySlugs: FEATURED_CATEGORIES_WITHOUT_TOOLS,
    nearbySlugs: ['belo-horizonte', 'santa-luzia', 'nova-lima', 'ribeirao-das-neves'],
    heroImage: '/regioes/sabara-hero.webp',
    heroAlt: 'Plataforma elevatória em obra em Sabará',
  },
  {
    slug: 'ribeirao-das-neves',
    name: 'Ribeirão das Neves',
    focus: 'metropole',
    h1: 'Locação de equipamentos em Ribeirão das Neves',
    metaTitle: 'Equipamentos em Ribeirão das Neves | Acesso',
    metaDescription:
      'Aluguel de plataformas, andaimes e ferramentas em Ribeirão das Neves. Entrega rápida da Acesso Equipamentos para toda a RMBH.',
    tagline: 'Frota para obras urbanas, reformas e instalações na região metropolitana.',
    intro: [
      'Ribeirão das Neves é uma das cidades mais populosas da região metropolitana de Belo Horizonte, com forte expansão residencial, comercial e de infraestrutura pública. A Acesso Equipamentos atende construtoras e prestadores de serviço na cidade com frota focada em obras urbanas.',
      'Trabalhamos com plataformas elevatórias, andaimes e ferramentas elétricas para reforma predial, fachadas, pintura e instalações. A partir da base em BH, coordenamos entregas para os principais bairros com prazos ajustados ao cronograma da obra.',
    ],
    highlights: [
      'Plataformas, andaimes e ferramentas para obras urbanas e reformas',
      'Entrega para os principais bairros a partir da base em BH',
      'Suporte técnico da Acesso Equipamentos com atendimento próximo',
    ],
    faqs: [
      {
        question: 'A Acesso entrega equipamentos em Ribeirão das Neves?',
        answer:
          'Sim. Atendemos toda a cidade a partir da base em Belo Horizonte, com foco em obras urbanas, reformas prediais e instalações comerciais.',
      },
      {
        question: 'Locam andaimes para reformas em Ribeirão das Neves?',
        answer:
          'Sim. Andaimes são bastante utilizados em pintura, fachadas e reformas prediais. Enviamos o material com a documentação técnica de identificação.',
      },
      {
        question: 'Vocês têm ferramentas elétricas para locação?',
        answer:
          'Sim. Trabalhamos com uma linha ampla de ferramentas elétricas para elétrica, hidráulica, gesso e acabamento em geral.',
      },
      {
        question: 'Como pedir um orçamento para minha obra?',
        answer:
          'Basta entrar em contato informando o tipo de serviço, altura de trabalho e prazo estimado. A partir disso, enviamos a proposta com os equipamentos indicados.',
      },
    ],
    featuredCategorySlugs: FEATURED_CATEGORIES_WITHOUT_TOOLS,
    nearbySlugs: ['belo-horizonte', 'contagem', 'santa-luzia', 'betim'],
    heroImage: '/regioes/ribeirao-das-neves-hero.webp',
    heroAlt: 'Obra urbana com plataforma elevatória em Ribeirão das Neves',
  },
  {
    slug: 'sarzedo',
    name: 'Sarzedo',
    focus: 'industria',
    h1: 'Locação de equipamentos em Sarzedo',
    metaTitle: 'Locação de equipamentos em Sarzedo | Acesso',
    metaDescription:
      'Aluguel de plataformas, manipuladores e ferramentas em Sarzedo. Atendimento industrial pela Acesso Equipamentos, com logística de BH.',
    tagline: 'Frota diversificada para indústrias, mineração leve e obras no vetor sudoeste da RMBH.',
    intro: [
      'Sarzedo faz parte do vetor sudoeste da região metropolitana de Belo Horizonte, com atividades industriais, mineração de pequeno porte e logística. A Acesso Equipamentos atende empresas e construtoras da cidade a partir da base em BH, com entrega organizada e frota diversificada.',
      'Fornecemos plataformas elevatórias, manipuladores telescópicos e ferramentas a combustão para obras, manutenções e frentes sem energia disponível. O time técnico auxilia na escolha do equipamento certo para cada aplicação e prazo.',
    ],
    highlights: [
      'Equipamentos para obras industriais, mineração leve e manutenções',
      'Logística direta a partir da base em Belo Horizonte',
      'Ferramentas a combustão para áreas sem energia disponível',
    ],
    faqs: [
      {
        question: 'A Acesso atende Sarzedo?',
        answer:
          'Sim. Sarzedo é atendida pela base em Belo Horizonte, com entrega organizada para indústrias, mineradoras e prestadores de serviço da cidade.',
      },
      {
        question: 'Locam manipuladores telescópicos para obras em Sarzedo?',
        answer:
          'Sim. Manipuladores telescópicos são muito usados em obras industriais e frentes de mineração leve, com diferentes capacidades e alcances.',
      },
      {
        question: 'Trabalham com ferramentas a combustão?',
        answer:
          'Sim. Ferramentas a combustão são ideais para áreas sem energia disponível, com autonomia para operações em campo.',
      },
      {
        question: 'Como é definido o prazo de entrega?',
        answer:
          'O prazo é combinado com o cliente após o fechamento do orçamento, considerando o local da obra e a disponibilidade da frota.',
      },
    ],
    featuredCategorySlugs: FEATURED_CATEGORIES_WITHOUT_TOOLS,
    nearbySlugs: ['ibirite', 'betim', 'brumadinho', 'nova-lima'],
    heroImage: '/regioes/sarzedo-hero.webp',
    heroAlt: 'Pátio industrial com manipulador telescópico em Sarzedo',
  },
];

const bySlug = new Map(REGIOES.map((regiao) => [regiao.slug, regiao]));

/** Display name → SEO slug for cities that have a dedicated page. */
export const CITY_NAME_TO_REGIAO_SLUG: Record<string, string> = Object.fromEntries(
  REGIOES.map((regiao) => [regiao.name, regiao.slug]),
);

/** Category → preferred region slugs for interlinks (BH first). */
const CATEGORY_REGION_PRESETS: Partial<Record<EquipmentCategory, string[]>> = {
  'plataformas-elevatorias': ['belo-horizonte', 'contagem', 'betim', 'ibirite'],
  'guindaste-industrial': ['belo-horizonte', 'nova-lima', 'brumadinho', 'sabara'],
  'manipuladores-telescopicos': ['belo-horizonte', 'betim', 'contagem', 'sarzedo'],
  andaimes: ['belo-horizonte', 'ribeirao-das-neves', 'santa-luzia', 'contagem'],
  'ferramentas-eletricas': ['belo-horizonte', 'ribeirao-das-neves', 'santa-luzia', 'contagem'],
  'ferramentas-combustao': ['belo-horizonte', 'nova-lima', 'brumadinho', 'sarzedo'],
};

export const ALL_REGIAO_SLUGS = REGIOES.map((regiao) => regiao.slug);

export function getAllRegioes() {
  return REGIOES;
}

export function getRegiaoBySlug(slug: string) {
  return bySlug.get(slug) ?? null;
}

export function isRegiaoSlug(slug: string): slug is string {
  return bySlug.has(slug);
}

/**
 * Returns up to `limit` region pages for interlinking from a category or equipment page.
 * @param category Equipment category slug used to pick preferred cities.
 * @param limit Maximum number of region pages to return.
 * @returns Region content entries for internal links.
 */
export function getRegioesForCategory(category: EquipmentCategory, limit = 4) {
  const preferred = CATEGORY_REGION_PRESETS[category] ?? ['belo-horizonte', 'contagem', 'betim', 'nova-lima'];
  return preferred
    .slice(0, limit)
    .map((slug) => bySlug.get(slug))
    .filter((regiao): regiao is RegiaoContent => Boolean(regiao));
}

export function getNearbyRegioes(slug: string) {
  const current = bySlug.get(slug);
  if (!current) {
    return [];
  }
  return current.nearbySlugs
    .map((nearby) => bySlug.get(nearby))
    .filter((regiao): regiao is RegiaoContent => Boolean(regiao));
}

export function focusLabel(focus: RegiaoFocus) {
  if (focus === 'industria') {
    return 'Indústria';
  }
  if (focus === 'mineracao') {
    return 'Mineração';
  }
  return 'Região metropolitana';
}
