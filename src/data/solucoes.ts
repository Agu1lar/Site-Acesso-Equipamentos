import type { EquipmentCategory } from '@/types/equipment';

export type SolucaoFaq = {
  question: string;
  answer: string;
};

export type SolucaoScenario = {
  title: string;
  description: string;
};

export type SolucaoProcessStep = {
  title: string;
  description: string;
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
  /** Short application bullets for lists and schema density. */
  applications: string[];
  /** Richer application cards with context. */
  scenarios: SolucaoScenario[];
  /** How the rental engagement usually runs for this segment. */
  processSteps: SolucaoProcessStep[];
  highlights: string[];
  faqs: SolucaoFaq[];
  featuredCategorySlugs: EquipmentCategory[];
  /** Only curated featured catalog slugs — keep empty rather than wrong. */
  featuredEquipmentSlugs: string[];
  nearbyRegiaoSlugs: string[];
  /** Public path under /solucoes/… */
  heroImage: string;
  heroAlt: string;
};

const SOLUCOES: SolucaoContent[] = [
  {
    slug: 'mineracao',
    name: 'Mineração',
    h1: 'Soluções para mineração',
    metaTitle: 'Equipamentos para mineração | Acesso',
    metaDescription:
      'Locação de guindaste, manipuladores e ferramentas para mineração no Quadrilátero Ferrífero. Suporte técnico da Acesso Equipamentos para paradas e manutenções na RMBH.',
    tagline:
      'Frota preparada para paradas, manutenções e obras nas mineradoras do Quadrilátero Ferrífero.',
    intro: [
      'A mineração em Minas Gerais impõe rotinas exigentes de manutenção, montagem e movimentação em plantas de beneficiamento, correias transportadoras, galpões de britagem e áreas de estocagem. A Acesso Equipamentos apoia mineradoras e empreiteiras da RMBH com locação de guindaste industrial, manipuladores telescópicos e ferramentas a combustão preparadas para operação em campo.',
      'Atendemos o Quadrilátero Ferrífero e o entorno de Belo Horizonte com foco em prazos curtos e acompanhamento técnico durante o uso. Trabalhamos com contratos por diária, semana ou mês, ajustados ao cronograma da parada, do projeto de manutenção ou da frente de serviço.',
      'Na prática, isso significa alinhar modelo, alcance e capacidade à permissão de trabalho, ao layout da planta e à logística de acesso — reduzindo improvisos na janela crítica da parada e mantendo documentação e revisão em dia entre locações.',
    ],
    challenges: [
      'Acessos irregulares, poeira e áreas sem cobertura elétrica exigem equipamentos robustos e opções a combustão.',
      'Paradas programadas concentram atividades de altura e içamento em janelas curtas de operação.',
      'Requisitos de segurança e permissões de trabalho pedem equipamentos revisados e documentação em dia.',
      'Frentes simultâneas na planta pedem disponibilidade previsível e suporte rápido se o escopo mudar.',
    ],
    applications: [
      'Manutenção de correias, chutes e peneiras em beneficiamento.',
      'Movimentação de motores, redutores e componentes pesados.',
      'Inspeções, limpeza estrutural e troca de luminárias em galpões.',
      'Apoio a montagem de estruturas e tubulações em novas frentes.',
    ],
    scenarios: [
      {
        title: 'Parada de planta de beneficiamento',
        description:
          'Durante a janela de manutenção, equipes precisam acessar correias, chutes e estruturas em altura enquanto movem motores e redutores. Combinamos plataformas, manipuladores e, quando necessário, guindaste industrial com entrega alinhada ao start da parada.',
      },
      {
        title: 'Frente sem energia elétrica',
        description:
          'Em áreas remotas ou durante intervenções sem rede, ferramentas a combustão mantêm o ritmo de corte, fixação e apoio sem depender de extensão longa. Orientamos a combinação certa no briefing técnico.',
      },
      {
        title: 'Montagem e retrofit em mina',
        description:
          'Ampliações e trocas de estrutura metálica pedem içamento controlado e acesso seguro em altura. A frota cobre cargas médias e trabalho em altura com revisão entre locações.',
      },
      {
        title: 'Inspeção e limpeza estrutural',
        description:
          'Galpões de estocagem e oficinas exigem alcance para luminárias, limpeza e inspeções. Plataformas e manipuladores reduzem gambiarra com andaime improvisado em áreas de risco.',
      },
    ],
    processSteps: [
      {
        title: 'Briefing da frente',
        description:
          'Você informa local (Nova Lima, Brumadinho, Sabará etc.), tipo de serviço, altura/carga e janela da parada. Validamos restrições de acesso e documentação exigida.',
      },
      {
        title: 'Seleção da frota',
        description:
          'Indicamos categorias e modelos da allowlist adequada à mineração — evitando equipamento subdimensionado ou incompatível com o ambiente.',
      },
      {
        title: 'Entrega no cronograma',
        description:
          'Agendamos entrega e retirada com a empreiteira ou a mina, com suporte durante o contrato para ajustes de escopo.',
      },
    ],
    highlights: [
      'Frota adequada a áreas de mina, com opções a combustão para pontos sem energia.',
      'Guindaste industrial e manipuladores telescópicos para içamentos e cargas médias.',
      'Manutenção própria com revisão entre locações e suporte durante o contrato.',
      'Base em BH com rotina de atendimento ao Quadrilátero Ferrífero.',
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
          'A frota passa por revisão entre locações e é entregue com a documentação técnica correspondente à categoria. Requisitos específicos do cliente (checklists, laudos extras) são conferidos no orçamento.',
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
      {
        question: 'Dá para combinar guindaste e manipulador na mesma parada?',
        answer:
          'Sim. Muitas paradas usam mais de uma categoria. Montamos uma proposta única com datas alinhadas ao cronograma da frente.',
      },
    ],
    featuredCategorySlugs: [
      'guindaste-industrial',
      'manipuladores-telescopicos',
      'ferramentas-combustao',
    ],
    featuredEquipmentSlugs: ['franna-fr17', 'manipulador-telescopico-mxt840'],
    nearbyRegiaoSlugs: ['nova-lima', 'brumadinho', 'sabara', 'belo-horizonte'],
    heroImage: '/solucoes/mineracao-hero.webp',
    heroAlt:
      'Guindaste e manipulador em área de planta de beneficiamento no Quadrilátero Ferrífero',
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
      'O diferencial é combinar disponibilidade rápida com orientação técnica: o modelo certo evita perda de janela de manutenção e reduz risco em convivência com produção ativa.',
    ],
    challenges: [
      'Janelas de manutenção curtas exigem equipamentos disponíveis com prazo reduzido de mobilização.',
      'Pé-direito elevado e obstáculos internos pedem plataformas com alcance e articulação adequados.',
      'Convivência com produção ativa demanda equipamentos revisados e operados com atenção.',
      'Turnarounds concentram várias frentes — iluminação, dutos, estruturas — no mesmo cronograma.',
    ],
    applications: [
      'Manutenção de iluminação, exaustão e telhado em galpões.',
      'Movimentação de componentes no pátio e no piso fabril.',
      'Inspeção e manutenção de dutos e estruturas em altura.',
      'Apoio a paradas programadas e retrofit de linhas.',
    ],
    scenarios: [
      {
        title: 'Manutenção de galpão com produção ativa',
        description:
          'Troca de luminárias, limpeza de coifas e inspeção de telhado sem parar a planta. Plataformas elétricas ou a diesel conforme o ambiente interno ou externo.',
      },
      {
        title: 'Turnaround de linha',
        description:
          'Em poucos dias, várias frentes precisam de altura e movimentação. Montamos um pacote de categorias alinhado ao Gantt da parada.',
      },
      {
        title: 'Pátio e utilidades',
        description:
          'Manipuladores telescópicos apoiam movimentação de materiais e acesso a estruturas no pátio, complementando o trabalho interno com plataformas.',
      },
      {
        title: 'Retrofit e utilidades prediais',
        description:
          'Troca de dutos, exaustão e estruturas auxiliares em altura — com equipamentos revisados e suporte durante o contrato.',
      },
    ],
    processSteps: [
      {
        title: 'Mapeamento da aplicação',
        description:
          'Altura, piso, presença de energia, restrições de emissão e prazo da janela definem o tipo de plataforma ou manipulador.',
      },
      {
        title: 'Proposta por prazo',
        description:
          'Diária, semana ou mês — inclusive contratos recorrentes para manutenção contínua na planta.',
      },
      {
        title: 'Entrega no eixo industrial',
        description:
          'Contagem, Betim, Ibirité e entorno com logística a partir de BH e suporte se o escopo mudar no meio do serviço.',
      },
    ],
    highlights: [
      'Plataformas elétricas e a diesel para operar dentro e fora dos galpões.',
      'Manipuladores telescópicos com capacidade e alcance para o pátio industrial.',
      'Logística curta a partir de BH no polo industrial da RMBH.',
      'Orientação técnica para não subdimensionar alcance ou capacidade.',
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
      {
        question: 'Plataforma elétrica ou a diesel — como escolher?',
        answer:
          'Ambientes internos fechados costumam pedir elétrica; pátios e áreas externas podem usar diesel. Confirmamos no briefing com base no local e nas regras da planta.',
      },
    ],
    featuredCategorySlugs: [
      'plataformas-elevatorias',
      'manipuladores-telescopicos',
      'ferramentas-combustao',
    ],
    featuredEquipmentSlugs: ['plataforma-elevatoria-gs4655', 'manipulador-telescopico-mxt840'],
    nearbyRegiaoSlugs: ['contagem', 'betim', 'ibirite', 'sarzedo'],
    heroImage: '/solucoes/industria-hero.webp',
    heroAlt: 'Plataforma elevatória em galpão industrial para manutenção em altura',
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
      'Em ambiente siderúrgico, robustez e previsibilidade importam tanto quanto o alcance: a frota é selecionada para pátio industrial, estruturas metálicas e içamentos de componentes em janelas curtas.',
    ],
    challenges: [
      'Paradas concentram frentes de altura e içamento em janelas curtas.',
      'Ambientes com pó e resíduos siderúrgicos exigem equipamentos robustos e bem revisados.',
      'Movimentação de motores, redutores e componentes pesados requer içamento seguro em espaços restritos.',
      'Várias empreiteiras no mesmo site pedem logística clara de entrega e retirada.',
    ],
    applications: [
      'Manutenção de estruturas metálicas e sistemas de exaustão.',
      'Içamento de motores, bombas e redutores durante paradas.',
      'Acesso a passarelas e estruturas para inspeção e reparo.',
      'Apoio a montagem de tubulações e retrofit de linhas.',
    ],
    scenarios: [
      {
        title: 'Parada de laminação',
        description:
          'Içamento de componentes e acesso a estruturas em poucas horas. Guindaste industrial e plataformas entram alinhados ao cronograma da contratada.',
      },
      {
        title: 'Manutenção de exaustão e coifas',
        description:
          'Trabalho em altura em áreas com resíduo e calor residual — plataformas e procedimentos de segurança da planta definem o modelo.',
      },
      {
        title: 'Troca de motores e redutores',
        description:
          'Movimentação de cargas médias em espaços restritos do pátio ou da usina, com equipamento adequado à capacidade e ao raio de operação.',
      },
      {
        title: 'Retrofit de linhas auxiliares',
        description:
          'Tubulações e estruturas novas exigem altura e içamento coordenados; montamos o mix de categorias para a frente.',
      },
    ],
    processSteps: [
      {
        title: 'Alinhamento com a parada',
        description:
          'Datas, portaria, permissões e lista de frentes — o orçamento nasce do cronograma real da usina.',
      },
      {
        title: 'Mix de equipamentos',
        description:
          'Guindaste, plataformas e manipuladores conforme carga, altura e layout; sem superestimar o que a frota não cobre.',
      },
      {
        title: 'Suporte na janela',
        description:
          'Entrega pontual e suporte durante o contrato para trocas ou prorrogação se a parada se estender.',
      },
    ],
    highlights: [
      'Guindaste industrial com boa mobilidade em pátios industriais.',
      'Plataformas e manipuladores para altura e cargas médias.',
      'Suporte alinhado a cronogramas fechados de manutenção.',
      'Atendimento recorrente no eixo Contagem–Betim.',
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
      {
        question: 'Vocês oferecem manutenção durante o uso?',
        answer:
          'Sim. Contamos com equipe técnica própria e atendemos chamados de suporte ao longo da locação, conforme condições do contrato.',
      },
    ],
    featuredCategorySlugs: [
      'guindaste-industrial',
      'plataformas-elevatorias',
      'manipuladores-telescopicos',
    ],
    featuredEquipmentSlugs: ['franna-fr17'],
    nearbyRegiaoSlugs: ['contagem', 'betim', 'belo-horizonte', 'ibirite'],
    heroImage: '/solucoes/siderurgia-hero.webp',
    heroAlt: 'Guindaste industrial em pátio de usina siderúrgica durante manutenção',
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
      'Para reforma em área ocupada, a escolha do equipamento certo — tesoura, articulada ou andaime — evita atrito com moradores e acelera o cronograma sem improvisar acesso.',
    ],
    challenges: [
      'Prazos apertados pedem equipamentos disponíveis e entrega rápida em várias frentes.',
      'Fachadas, pé-direito duplo e áreas técnicas exigem plataformas e andaimes adequados a cada acesso.',
      'Reformas em condomínios e áreas ocupadas demandam equipamentos adequados ao local.',
      'Variação de solo e entrada de garagem limita o porte do equipamento em alguns sítios.',
    ],
    applications: [
      'Pintura e manutenção de fachadas em prédios e condomínios.',
      'Instalação de forros, luminárias e sistemas em salões e lojas.',
      'Montagem de andaimes para alvenaria e acabamento.',
      'Corte e furação com ferramentas elétricas de canteiro.',
    ],
    scenarios: [
      {
        title: 'Pintura e manutenção de fachada',
        description:
          'Plataformas elevatórias para condomínios e prédios comerciais, com entrega em BH e cidades vizinhas. Orientamos o modelo conforme altura e acesso ao térreo.',
      },
      {
        title: 'Acabamento interno em pé-direito alto',
        description:
          'Forros, luminárias e ar-condicionado em salões e galpões — plataformas tesoura ou articuladas conforme o layout.',
      },
      {
        title: 'Alvenaria e revestimento com andaime',
        description:
          'Conjuntos de andaime por prazo de obra, ajustados ao cronograma. Montagem fica a cargo da obra ou parceiro indicado.',
      },
      {
        title: 'Ferramentas no canteiro',
        description:
          'Ferramentas elétricas revisadas para corte, furação e acabamento — complemento frequente às plataformas e andaimes.',
      },
    ],
    processSteps: [
      {
        title: 'Visita ou briefing da obra',
        description:
          'Altura da fachada, restrição de condomínio, tipo de piso e prazo definem plataforma, andaime ou ambos.',
      },
      {
        title: 'Orçamento por fase',
        description:
          'É comum locar por etapa (estrutura, fachada, acabamento). Ajustamos prazos sem forçar frota errada.',
      },
      {
        title: 'Entrega urbana',
        description:
          'BH, Ribeirão das Neves, Santa Luzia e entorno com retirada combinada ao fim da frente.',
      },
    ],
    highlights: [
      'Plataformas tesoura, articuladas e telescópicas para diferentes alturas.',
      'Andaimes e componentes para montagens no canteiro.',
      'Ferramentas elétricas revisadas e prontas para uso.',
      'Experiência com reformas em condomínios na capital.',
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
      {
        question: 'Vocês locam guindaste para construção civil?',
        answer:
          'Para construção civil priorizamos plataformas, andaimes e ferramentas. Guindaste industrial é indicado quando há içamento específico — avaliamos caso a caso.',
      },
    ],
    featuredCategorySlugs: ['plataformas-elevatorias', 'andaimes', 'ferramentas-eletricas'],
    featuredEquipmentSlugs: ['plataforma-elevatoria-gs4655'],
    nearbyRegiaoSlugs: ['belo-horizonte', 'ribeirao-das-neves', 'santa-luzia', 'contagem'],
    heroImage: '/solucoes/construcao-civil-hero.webp',
    heroAlt: 'Plataforma elevatória em pintura de fachada de edifício residencial',
  },
  {
    slug: 'manutencao-industrial',
    name: 'Manutenção industrial',
    h1: 'Soluções para manutenção industrial',
    metaTitle: 'Equipamentos para manutenção industrial | Acesso',
    metaDescription:
      'Locação de plataformas, ferramentas elétricas e a combustão para manutenção industrial na RMBH. Suporte da Acesso Equipamentos em Contagem e Betim.',
    tagline:
      'Equipamentos revisados e disponíveis para preventivas, corretivas e paradas programadas.',
    intro: [
      'Manutenção industrial reúne rotinas preventivas, corretivas e paradas programadas em fábricas, centros logísticos e utilidades da RMBH. A Acesso Equipamentos apoia equipes internas e prestadoras com plataformas elevatórias, ferramentas elétricas e ferramentas a combustão.',
      'Nosso foco é reduzir tempo parado e apoiar várias frentes no mesmo cronograma. Entregamos a partir de BH, com atendimento no eixo Contagem, Betim, Sarzedo e demais cidades da região.',
      'Quando a corretiva não pode esperar, a combinação de frota revisada e logística curta faz diferença: o equipamento certo chega na janela e o suporte cobre falhas cobertas pelo contrato.',
    ],
    challenges: [
      'Janelas de manutenção fechadas concentram alta demanda por altura e ferramentas em pouco tempo.',
      'Ambientes com pouca cobertura elétrica exigem equipamentos a combustão confiáveis.',
      'Frentes simultâneas dentro da planta demandam disponibilidade previsível de itens.',
      'Corretivas urgentes pedem resposta comercial e logística no mesmo dia, quando possível.',
    ],
    applications: [
      'Inspeção e manutenção de telhados, exaustores e coifas.',
      'Troca de luminárias e pintura em áreas produtivas.',
      'Retrofit de tubulações, dutos e passarelas em altura.',
      'Reparos com ferramentas elétricas ou a combustão.',
    ],
    scenarios: [
      {
        title: 'Preventiva em galpão',
        description:
          'Telhado, exaustores e iluminação em ciclo programado. Plataformas elétricas ou diesel conforme o ambiente, com contrato mensal quando a rotina é contínua.',
      },
      {
        title: 'Parada programada multi-frente',
        description:
          'Altura + ferramentas elétricas + combustão no mesmo pacote, com entrega e devolução amarradas ao Gantt.',
      },
      {
        title: 'Corretiva em ponto sem energia',
        description:
          'Ferramentas a combustão para manter o reparo quando a rede está desligada ou inexistente na frente.',
      },
      {
        title: 'Retrofit de dutos e passarelas',
        description:
          'Acesso seguro em altura para solda, aparafusamento e inspeção — evitando improvisos com escada inadequada.',
      },
    ],
    processSteps: [
      {
        title: 'Prioridade da janela',
        description:
          'Informe se é preventiva, corretiva ou parada. Isso define prazo de mobilização e mix de categorias.',
      },
      {
        title: 'Kit por frente',
        description:
          'Montamos plataformas e ferramentas por frente de trabalho, evitando sobra ou falta no meio do serviço.',
      },
      {
        title: 'Suporte e substituição',
        description:
          'Durante o contrato, suporte técnico e substituição quando a falha estiver coberta e houver disponibilidade.',
      },
    ],
    highlights: [
      'Plataformas elétricas e a diesel para operar dentro e fora dos galpões.',
      'Ferramentas elétricas e a combustão revisadas para trabalho em campo.',
      'Contratos flexíveis ajustados a cronogramas de parada.',
      'Atendimento forte no eixo Contagem–Betim–Sarzedo.',
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
      {
        question: 'Vocês substituem o equipamento em caso de falha durante o uso?',
        answer:
          'Sim. Quando a falha estiver coberta pelo contrato, providenciamos substituição conforme disponibilidade da frota.',
      },
    ],
    featuredCategorySlugs: [
      'plataformas-elevatorias',
      'ferramentas-eletricas',
      'ferramentas-combustao',
    ],
    featuredEquipmentSlugs: ['plataforma-elevatoria-gs4655'],
    nearbyRegiaoSlugs: ['contagem', 'betim', 'sarzedo', 'belo-horizonte'],
    heroImage: '/solucoes/manutencao-industrial-hero.webp',
    heroAlt: 'Plataforma elevatória em manutenção industrial sob estrutura de galpão',
  },
  {
    slug: 'logistica',
    name: 'Logística',
    h1: 'Soluções para logística',
    metaTitle: 'Equipamentos para logística | Acesso',
    metaDescription:
      'Aluguel de manipuladores telescópicos e plataformas para logística e centros de distribuição em Contagem, Betim e RMBH pela Acesso Equipamentos.',
    tagline:
      'Movimentação de carga e manutenção de galpões nos principais centros logísticos da RMBH.',
    intro: [
      'Centros de distribuição, transportadoras e operadores logísticos da RMBH demandam equipamentos ágeis para movimentar carga, manter estruturas e organizar o pátio. A Acesso Equipamentos apoia essas operações com manipuladores telescópicos e plataformas elevatórias.',
      'Atuamos com foco no eixo Contagem–Betim, entregando equipamentos revisados e com suporte durante o contrato. Contratos por diária, semana ou mês acompanham picos sazonais e projetos específicos.',
      'Em CDs, o desafio costuma ser misturar fluxo de caminhões com manutenção de docas e iluminação — o equipamento certo reduz conflito de tráfego e tempo de intervenção.',
    ],
    challenges: [
      'Volumes sazonais aumentam a demanda por movimentação de carga em curto prazo.',
      'Portas altas, prateleiras e estruturas metálicas exigem alcance e capacidade adequados.',
      'Convivência com fluxo de caminhões e empilhadeiras pede equipamentos seguros no pátio.',
      'Manutenção de docas e cobertura sem interromper o giro de carga.',
    ],
    applications: [
      'Carga e descarga de volumes pesados no pátio.',
      'Movimentação de materiais em altura no galpão.',
      'Manutenção de docas, portões e exaustão.',
      'Instalação e revisão de iluminação em CDs.',
    ],
    scenarios: [
      {
        title: 'Pico sazonal no pátio',
        description:
          'Manipulador telescópico por temporada para reforçar movimentação sem comprar ativo. Contratos mensais renováveis enquanto durar a demanda.',
      },
      {
        title: 'Manutenção de docas e cobertura',
        description:
          'Plataformas para portões, exaustão e estrutura sem parar o CD por dias — intervenção curta e planejada.',
      },
      {
        title: 'Iluminação e segurança do galpão',
        description:
          'Troca de luminárias e câmeras em altura com plataforma adequada ao layout de corredores e porta-pallets.',
      },
      {
        title: 'Operação mista pátio + interno',
        description:
          'Combinação de manipulador e plataforma quando a mesma operação precisa de carga e acesso em altura.',
      },
    ],
    processSteps: [
      {
        title: 'Layout e capacidade',
        description:
          'Altura de porta, tipo de carga e restrições de pátio definem o manipulador ou a plataforma.',
      },
      {
        title: 'Contrato sazonal ou pontual',
        description:
          'Picos usam mês; manutenções pontuais usam diária ou semana. Renovação simples se o volume continuar.',
      },
      {
        title: 'Entrega no eixo logístico',
        description:
          'Contagem e Betim com logística a partir de BH e retirada combinada ao fim do pico ou da frente.',
      },
    ],
    highlights: [
      'Manipuladores telescópicos para operação em galpão e pátio.',
      'Plataformas elevatórias para manutenção interna.',
      'Base em BH próxima ao eixo Contagem–Betim.',
      'Flexibilidade para picos sazonais sem CAPEX.',
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
      {
        question: 'Quem opera o equipamento durante a locação?',
        answer:
          'A operação é de responsabilidade do cliente, com profissional habilitado. Podemos orientar requisitos de habilitação no orçamento.',
      },
    ],
    featuredCategorySlugs: ['manipuladores-telescopicos', 'plataformas-elevatorias'],
    featuredEquipmentSlugs: ['manipulador-telescopico-mxt840'],
    nearbyRegiaoSlugs: ['contagem', 'betim', 'belo-horizonte', 'ibirite'],
    heroImage: '/solucoes/logistica-hero.webp',
    heroAlt: 'Manipulador telescópico em pátio de centro de distribuição',
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
      'O sucesso da montagem depende de içamento e acesso em altura no mesmo ritmo do avanço físico — por isso o mix de frota e a flexibilidade de prorrogação entram no planejamento desde o briefing.',
    ],
    challenges: [
      'Cronogramas fechados exigem previsibilidade de disponibilidade e mobilização de várias frentes.',
      'Estruturas metálicas em altura pedem plataformas e alcance adequados.',
      'Movimentação de peças pesadas e volumosas requer içamento planejado e seguro.',
      'Atrasos de obra mudam o pico de demanda — o contrato precisa de folga operacional.',
    ],
    applications: [
      'Montagem de estruturas metálicas, mezaninos e passarelas.',
      'Instalação e alinhamento de equipamentos e tubulações.',
      'Acesso em altura para soldagem e aparafusamento.',
      'Apoio a testes e ajustes no comissionamento.',
    ],
    scenarios: [
      {
        title: 'Ereção de estrutura metálica',
        description:
          'Guindaste industrial para içamentos leves e médios no pátio, com plataformas para soldadores e montadores em altura.',
      },
      {
        title: 'Instalação de equipamentos e tubulação',
        description:
          'Manipuladores e plataformas para posicionar e acessar pontos de conexão em áreas industriais novas ou em ampliação.',
      },
      {
        title: 'Comissionamento e start-up',
        description:
          'Acesso residual para ajustes finos, testes e correções sem desmobilizar toda a frente antes da hora.',
      },
      {
        title: 'Retrofit em planta existente',
        description:
          'Montagem em convivência com operação parcial — equipamentos compactos e mobilidade no canteiro industrial.',
      },
    ],
    processSteps: [
      {
        title: 'Leitura do cronograma',
        description:
          'Marcos de içamento e frentes de altura definem quando cada equipamento entra e sai.',
      },
      {
        title: 'Mix guindaste + acesso',
        description:
          'Franna e plataformas/manipuladores no mesmo pacote quando a montagem exige os dois tipos de operação.',
      },
      {
        title: 'Prorrogação controlada',
        description:
          'Se a montagem atrasa, negociamos extensão conforme disponibilidade — previsto no acompanhamento comercial.',
      },
    ],
    highlights: [
      'Guindaste industrial com boa mobilidade em canteiros industriais.',
      'Manipuladores e plataformas para altura e movimentação de peças.',
      'Contratos ajustados ao cronograma da montagem.',
      'Atendimento ao polo Contagem–Betim–Ibirité.',
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
      {
        question: 'Como funciona a devolução ao final da montagem?',
        answer:
          'Combinamos a data de retirada com o cliente, considerando o encerramento da frente e o cronograma acordado no contrato.',
      },
    ],
    featuredCategorySlugs: [
      'guindaste-industrial',
      'plataformas-elevatorias',
      'manipuladores-telescopicos',
    ],
    featuredEquipmentSlugs: ['franna-fr17', 'manipulador-telescopico-mxt840'],
    nearbyRegiaoSlugs: ['contagem', 'betim', 'ibirite', 'belo-horizonte'],
    heroImage: '/solucoes/montagens-industriais-hero.webp',
    heroAlt: 'Montagem de estrutura metálica com guindaste e plataformas em canteiro industrial',
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
