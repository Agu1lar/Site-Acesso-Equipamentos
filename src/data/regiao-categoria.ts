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
  'brumadinho',
  'santa-luzia',
  'vespasiano',
  'lagoa-santa',
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

/** Brumadinho × plataformas — página longa para a query “plataformas elevatórias Brumadinho”. */
function buildBrumadinhoPlataformasEnrichment(): RegiaoCategoriaEnrichment {
  return {
    typesTitle: 'Tipos de plataforma elevatória para Brumadinho',
    types: [
      {
        title: 'Plataforma tesoura em Brumadinho',
        body:
          'Indicada para galpões, áreas de apoio e pisos nivelados. Em Brumadinho, atende bem manutenção interna, iluminação e serviços em estruturas com solo firme — desde que o ponto de trabalho esteja alinhado à base da máquina.',
      },
      {
        title: 'Plataforma articulada em Brumadinho',
        body:
          'Lança articulada para contornar obstáculos e operar em frentes com relevo ou interferências. Frequente em manutenção de estruturas, plantas de apoio à mineração e acessos laterais onde a tesoura não chega.',
      },
      {
        title: 'Plataforma telescópica em Brumadinho',
        body:
          'Maior alcance vertical e horizontal para frentes externas e estruturas altas. Avaliamos área de estabilização, acesso rodoviário e altura de trabalho antes de indicar o modelo do catálogo.',
      },
      {
        title: 'Plataforma tipo mastro em Brumadinho',
        body:
          'Opção compacta para acessos internos e altura moderada. Útil em áreas de estoque, corredores e serviços leves em edificações de apoio.',
      },
    ],
    propulsionTitle: 'Elétrica ou diesel — o que faz sentido em Brumadinho',
    propulsion: [
      {
        title: 'Plataformas elétricas',
        body:
          'Melhor escolha em ambientes internos, pisos acabados e áreas com restrição de emissão. Em Brumadinho, entram em galpões, manutenção predial e espaços onde ruído e gases precisam ser controlados.',
      },
      {
        title: 'Plataformas a diesel',
        body:
          'Indicadas para áreas externas, pátios e frentes com terreno mais exigente. Em operações de mineração e infraestrutura no município, a autonomia e a tração costumam pesar na escolha.',
      },
    ],
    heightsTitle: 'Alturas de trabalho frequentes em Brumadinho',
    heights: [
      {
        title: 'Faixa de 8 a 16 metros',
        body:
          'Cobre manutenções prediais, galpões e serviços técnicos comuns no município. Informe altura de trabalho real (ponto a alcançar), não só a altura da plataforma.',
      },
      {
        title: 'Faixa de 16 a 26 metros',
        body:
          'Usada em estruturas, fachadas e frentes externas. Em Brumadinho, confirme espaço para estabilizadores e condições de piso no local da obra.',
      },
      {
        title: 'Acima de 26 metros',
        body:
          'Para frentes mais altas, a frota inclui lanças de maior alcance. Em paradas e cronogramas fechados, reservamos com antecedência pela logística a partir de BH.',
      },
    ],
    whyTitle: 'Por que locar com a Acesso em Brumadinho',
    why: [
      'Base em Belo Horizonte com entrega para Brumadinho e frentes no entorno',
      'Orientação técnica para terreno, altura e tipo (tesoura, articulada ou telescópica)',
      'Frota revisada e documentação usual de locação para apoiar a obra',
      'Diária, semanal ou mensal — valores sob consulta conforme modelo e acesso ao canteiro',
    ],
  };
}

function applyBrumadinhoPlataformasOverride(base: RegiaoCategoriaContent): RegiaoCategoriaContent {
  return {
    ...base,
    metaTitle: 'Locação de plataformas elevatórias em Brumadinho',
    metaDescription: clipMetaDescription(
      'Aluguel de plataforma elevatória em Brumadinho: tesoura, articulada e telescópica. Entrega a partir de BH, frota revisada e orçamento sob consulta pela Acesso Equipamentos.',
    ),
    tagline:
      'Plataformas para mineração, infraestrutura e manutenção em Brumadinho — logística a partir de Belo Horizonte.',
    intro: [
      'A Acesso Equipamentos loca plataformas elevatórias em Brumadinho com atenção a frentes de mineração, infraestrutura e manutenção em altura. A operação parte da base em Belo Horizonte, com planejamento de entrega conforme acesso rodoviário e condições do canteiro.',
      'Nesta página está o recorte local de plataformas elevatórias em Brumadinho: tipos (tesoura, articulada, telescópica e mastro), propulsão elétrica ou diesel, faixas de altura e catálogo da linha. O comercial indica o modelo conforme altura de trabalho, piso, relevo e prazo.',
      'O município combina áreas urbanas, rurais e operações ligadas à mineração. Terreno irregular, solo compactado e acessos longos pedem avaliação prévia do local — informe endereço, interno/externo e altura aproximada no orçamento.',
      'Trabalhamos com a frota publicada no catálogo do site. Valores são sob consulta: a proposta considera equipamento, deslocamento a partir de BH e condições reais da obra em Brumadinho.',
    ],
    faqs: [
      {
        question: 'Vocês locam plataformas elevatórias em Brumadinho?',
        answer:
          'Sim. Atendemos Brumadinho e frentes no entorno com entrega a partir de Belo Horizonte, conforme disponibilidade da frota e condições de acesso ao local.',
      },
      {
        question: 'A plataforma funciona em terreno inclinado como o de Brumadinho?',
        answer:
          'Depende do modelo. Articuladas e telescópicas costumam atender melhor frentes externas com piso irregular; tesoura e mastro pedem piso mais nivelado. Descreva o terreno no orçamento para indicarmos a opção adequada.',
      },
      {
        question: 'Qual a diferença entre tesoura e articulada para Brumadinho?',
        answer:
          'A tesoura sobe na vertical em áreas niveladas. A articulada contorna obstáculos e alcança pontos laterais — útil em estruturas e plantas com interferências. Indicamos no orçamento conforme o serviço.',
      },
      {
        question: 'Plataforma elétrica ou diesel em Brumadinho — qual escolher?',
        answer:
          'Elétrica para áreas internas e restrição de emissão. Diesel para externas e terrenos mais exigentes. Informe se o trabalho é interno ou externo.',
      },
      {
        question: 'Preciso de capacitação para operar a plataforma?',
        answer:
          'Sim. A operação exige capacitação alinhada às normas aplicáveis (como NR-18 e boas práticas de trabalho em altura). A locação inclui a documentação técnica usual do equipamento; o contratante organiza a habilitação da equipe.',
      },
      {
        question: 'Como pedir orçamento de plataforma elevatória em Brumadinho?',
        answer:
          'Pelo WhatsApp ou formulário: informe altura aproximada, interno/externo, endereço em Brumadinho e prazo. Retornamos com disponibilidade e condições sob consulta.',
      },
    ],
    enrichment: buildBrumadinhoPlataformasEnrichment(),
  };
}

/** Santa Luzia × plataformas — página longa para a query “plataformas elevatórias Santa Luzia”. */
function buildSantaLuziaPlataformasEnrichment(): RegiaoCategoriaEnrichment {
  return {
    typesTitle: 'Tipos de plataforma elevatória para Santa Luzia',
    types: [
      {
        title: 'Plataforma tesoura em Santa Luzia',
        body:
          'Indicada para galpões, CDs e pisos nivelados. Em Santa Luzia, atende bem manutenção de iluminação, exaustão, inventário em altura e reformas internas no parque industrial e logístico.',
      },
      {
        title: 'Plataforma articulada em Santa Luzia',
        body:
          'Lança flexível para contornar tubulações, marquises e estruturas. Útil em plantas, fachadas comerciais e frentes externas com obstáculos no vetor nordeste da RMBH.',
      },
      {
        title: 'Plataforma telescópica em Santa Luzia',
        body:
          'Maior alcance para obras, estruturas metálicas e manutenção externa. Indicamos o modelo conforme altura de trabalho, área de estabilização e acesso ao canteiro.',
      },
      {
        title: 'Plataforma tipo mastro em Santa Luzia',
        body:
          'Opção compacta para corredores, estoques e serviços leves em altura moderada. Avaliamos vão e capacidade junto com o comercial.',
      },
    ],
    propulsionTitle: 'Elétrica ou diesel — o que faz sentido em Santa Luzia',
    propulsion: [
      {
        title: 'Plataformas elétricas',
        body:
          'Preferidas em galpões, centros de distribuição e áreas internas com restrição de emissão ou ruído — perfil frequente no eixo industrial de Santa Luzia.',
      },
      {
        title: 'Plataformas a diesel',
        body:
          'Indicadas para áreas externas, obras e terrenos mistos. Em frentes abertas e montagens, a autonomia e a tração costumam pesar na escolha.',
      },
    ],
    heightsTitle: 'Alturas de trabalho frequentes em Santa Luzia',
    heights: [
      {
        title: 'Faixa de 8 a 16 metros',
        body:
          'Cobre boa parte das manutenções industriais e prediais: galpões, iluminação, pintura e acesso a mezzaninos.',
      },
      {
        title: 'Faixa de 16 a 26 metros',
        body:
          'Comum em estruturas, fachadas e serviços externos. Confirme altura de trabalho real e espaço para estabilizadores no local.',
      },
      {
        title: 'Acima de 26 metros',
        body:
          'Para frentes mais altas, a frota inclui lanças de maior alcance. Em cronogramas fechados, reservamos com antecedência pela logística a partir de BH.',
      },
    ],
    whyTitle: 'Por que locar com a Acesso em Santa Luzia',
    why: [
      'Base em Belo Horizonte com entrega ágil no vetor nordeste (Santa Luzia e entorno)',
      'Orientação técnica para galpão, fachada ou frente externa — tesoura, articulada ou telescópica',
      'Frota revisada e documentação usual de locação para apoiar a obra',
      'Diária, semanal ou mensal — valores sob consulta conforme modelo e logística',
    ],
  };
}

function applySantaLuziaPlataformasOverride(base: RegiaoCategoriaContent): RegiaoCategoriaContent {
  return {
    ...base,
    metaTitle: 'Locação de plataformas elevatórias em Santa Luzia',
    metaDescription: clipMetaDescription(
      'Aluguel de plataforma elevatória em Santa Luzia: tesoura, articulada e telescópica. Entrega a partir de BH, frota revisada e orçamento sob consulta pela Acesso Equipamentos.',
    ),
    tagline:
      'Plataformas para indústria, galpões e obras em Santa Luzia — logística a partir de Belo Horizonte.',
    intro: [
      'A Acesso Equipamentos loca plataformas elevatórias em Santa Luzia com foco no perfil misto da cidade: parque industrial, logística e obras prediais no vetor nordeste da RMBH. A operação parte da base em Belo Horizonte, com entrega alinhada ao cronograma da obra.',
      'Nesta página está o recorte local de plataformas elevatórias em Santa Luzia — tipos (tesoura, articulada, telescópica e mastro), propulsão elétrica ou diesel, faixas de altura e catálogo da linha. O comercial indica o modelo conforme altura de trabalho, piso, alcance e prazo.',
      'Santa Luzia concentra reformas de galpões, manutenção industrial e serviços em fachadas. Informe endereço, interno/externo e altura aproximada para orçamento sob consulta com disponibilidade da frota.',
      'Trabalhamos com a frota publicada no catálogo do site. Valores não são tabelados online: a proposta considera equipamento, deslocamento a partir de BH e condições do local em Santa Luzia.',
    ],
    faqs: [
      {
        question: 'Vocês locam plataformas elevatórias em Santa Luzia?',
        answer:
          'Sim. Atendemos Santa Luzia e o entorno com entrega a partir de Belo Horizonte, conforme disponibilidade da frota e endereço da obra.',
      },
      {
        question: 'Qual a diferença entre tesoura e articulada para Santa Luzia?',
        answer:
          'A tesoura sobe na vertical em áreas niveladas (galpões e CDs). A articulada contorna obstáculos e alcança pontos laterais — útil em fachadas e plantas com interferências.',
      },
      {
        question: 'Plataforma elétrica ou diesel em Santa Luzia — qual escolher?',
        answer:
          'Elétrica para áreas internas e restrição de emissão. Diesel para externas e terrenos mais exigentes. Informe se o serviço é interno ou externo.',
      },
      {
        question: 'Locam plataformas para reforma de galpões em Santa Luzia?',
        answer:
          'Sim. Tesoura e articulada são muito usadas em reforma de galpões, coberturas e estruturas. Antecipe a reserva quando o prazo da obra for apertado.',
      },
      {
        question: 'Preciso de capacitação para operar a plataforma?',
        answer:
          'Sim. A operação exige capacitação alinhada às normas aplicáveis (como NR-18). A locação inclui a documentação técnica usual do equipamento; o contratante organiza a habilitação da equipe.',
      },
      {
        question: 'Como pedir orçamento de plataforma elevatória em Santa Luzia?',
        answer:
          'Pelo WhatsApp ou formulário: informe altura aproximada, interno/externo, endereço em Santa Luzia e prazo. Retornamos com disponibilidade e condições sob consulta.',
      },
    ],
    enrichment: buildSantaLuziaPlataformasEnrichment(),
  };
}

/** Ibirité × plataformas — página longa para a query “plataformas elevatórias Ibirité”. */
function buildIbiritePlataformasEnrichment(): RegiaoCategoriaEnrichment {
  return {
    typesTitle: 'Tipos de plataforma elevatória para Ibirité',
    types: [
      {
        title: 'Plataforma tesoura em Ibirité',
        body:
          'Indicada para galpões, áreas de planta e pisos nivelados. Em Ibirité, atende bem manutenção interna, iluminação e serviços em estruturas durante paradas técnicas e rotinas industriais.',
      },
      {
        title: 'Plataforma articulada em Ibirité',
        body:
          'Lança flexível para contornar tubulações, racks e obstáculos em plantas. Frequente em manutenção industrial e frentes externas no eixo petroquímico e logístico da cidade.',
      },
      {
        title: 'Plataforma telescópica em Ibirité',
        body:
          'Maior alcance para estruturas altas, pátios e montagens. Indicamos o modelo conforme altura de trabalho, área de estabilização e janela da parada.',
      },
      {
        title: 'Plataforma tipo mastro em Ibirité',
        body:
          'Opção compacta para acessos internos e altura moderada. Avaliamos vão, piso e capacidade junto com o comercial.',
      },
    ],
    propulsionTitle: 'Elétrica ou diesel — o que faz sentido em Ibirité',
    propulsion: [
      {
        title: 'Plataformas elétricas',
        body:
          'Preferidas em áreas internas e ambientes com restrição de emissão ou ruído — galpões e zonas de planta onde a operação precisa ser mais limpa.',
      },
      {
        title: 'Plataformas a diesel',
        body:
          'Indicadas para áreas externas, pátios e frentes com piso mais exigente. Em paradas e montagens ao ar livre, autonomia e tração costumam pesar na escolha.',
      },
    ],
    heightsTitle: 'Alturas de trabalho frequentes em Ibirité',
    heights: [
      {
        title: 'Faixa de 8 a 16 metros',
        body:
          'Cobre boa parte das manutenções industriais e prediais em Ibirité: galpões, iluminação, tubulação e acesso a mezzaninos.',
      },
      {
        title: 'Faixa de 16 a 26 metros',
        body:
          'Comum em estruturas, plantas e serviços externos. Confirme altura de trabalho real e espaço para estabilizadores no local.',
      },
      {
        title: 'Acima de 26 metros',
        body:
          'Para frentes mais altas, a frota inclui lanças de maior alcance. Em paradas programadas, reservamos com antecedência pela logística a partir de BH.',
      },
    ],
    whyTitle: 'Por que locar com a Acesso em Ibirité',
    why: [
      'Base em Belo Horizonte com entrega no eixo industrial de Ibirité e entorno',
      'Orientação técnica para paradas, manutenção e obras — tesoura, articulada ou telescópica',
      'Frota revisada e documentação usual de locação para apoiar a planta',
      'Diária, semanal ou mensal — valores sob consulta conforme modelo e janela da obra',
    ],
  };
}

function applyIbiritePlataformasOverride(base: RegiaoCategoriaContent): RegiaoCategoriaContent {
  return {
    ...base,
    metaTitle: 'Locação de plataformas elevatórias em Ibirité',
    metaDescription: clipMetaDescription(
      'Aluguel de plataforma elevatória em Ibirité: tesoura, articulada e telescópica. Entrega a partir de BH, frota revisada e orçamento sob consulta pela Acesso Equipamentos.',
    ),
    tagline:
      'Plataformas para paradas técnicas, manutenção e obras em Ibirité — logística a partir de Belo Horizonte.',
    intro: [
      'A Acesso Equipamentos loca plataformas elevatórias em Ibirité com foco no eixo industrial da RMBH: plantas, logística e frentes de manutenção. A operação parte da base em Belo Horizonte, com entregas alinhadas a janelas curtas de parada quando necessário.',
      'Nesta página está o recorte local de plataformas elevatórias em Ibirité — tipos (tesoura, articulada, telescópica e mastro), propulsão elétrica ou diesel, faixas de altura e catálogo da linha. O comercial indica o modelo conforme altura de trabalho, piso, alcance e prazo.',
      'Ibirité concentra demanda de paradas programadas, manutenção industrial e montagens. Informe endereço da obra, interno/externo e altura aproximada para orçamento sob consulta com disponibilidade da frota.',
      'Trabalhamos com a frota publicada no catálogo do site. Valores são sob consulta: a proposta considera equipamento, deslocamento a partir de BH e condições do local em Ibirité.',
    ],
    faqs: [
      {
        question: 'Vocês locam plataformas elevatórias em Ibirité?',
        answer:
          'Sim. Atendemos Ibirité e o entorno industrial com entrega a partir de Belo Horizonte, conforme disponibilidade da frota e endereço da obra.',
      },
      {
        question: 'Vocês atendem paradas técnicas em Ibirité?',
        answer:
          'Sim. Em paradas programadas, recomendamos antecipar a reserva para garantir altura, quantidade de equipamentos e entrega na janela crítica.',
      },
      {
        question: 'Qual a diferença entre tesoura e articulada para Ibirité?',
        answer:
          'A tesoura sobe na vertical em áreas niveladas (galpões e plantas). A articulada contorna obstáculos e alcança pontos laterais — útil em tubulações, racks e frentes com interferências.',
      },
      {
        question: 'Plataforma elétrica ou diesel em Ibirité — qual escolher?',
        answer:
          'Elétrica para áreas internas e restrição de emissão. Diesel para externas e terrenos mais exigentes. Informe se o serviço é interno ou externo.',
      },
      {
        question: 'Preciso de capacitação para operar a plataforma?',
        answer:
          'Sim. A operação exige capacitação alinhada às normas aplicáveis (como NR-18). A locação inclui a documentação técnica usual do equipamento; o contratante organiza a habilitação da equipe.',
      },
      {
        question: 'Como pedir orçamento de plataforma elevatória em Ibirité?',
        answer:
          'Pelo WhatsApp ou formulário: informe altura aproximada, interno/externo, endereço em Ibirité e prazo. Retornamos com disponibilidade e condições sob consulta.',
      },
    ],
    enrichment: buildIbiritePlataformasEnrichment(),
  };
}

/** Vespasiano × plataformas — página longa para a query “plataformas elevatórias Vespasiano”. */
function buildVespasianoPlataformasEnrichment(): RegiaoCategoriaEnrichment {
  return {
    typesTitle: 'Tipos de plataforma elevatória para Vespasiano',
    types: [
      {
        title: 'Plataforma tesoura em Vespasiano',
        body:
          'Indicada para galpões, plantas e pisos nivelados. Em Vespasiano, atende bem manutenção de iluminação, exaustão e reformas internas no parque industrial e logístico do vetor norte.',
      },
      {
        title: 'Plataforma articulada em Vespasiano',
        body:
          'Lança flexível para contornar tubulações, marquises e obstáculos. Útil em fachadas, plantas e frentes externas com interferências.',
      },
      {
        title: 'Plataforma telescópica em Vespasiano',
        body:
          'Maior alcance para estruturas, pátios e serviços externos. Indicamos o modelo conforme altura de trabalho e área de estabilização no canteiro.',
      },
      {
        title: 'Plataforma tipo mastro em Vespasiano',
        body:
          'Opção compacta para corredores, estoques e altura moderada. Avaliamos vão e capacidade junto com o comercial.',
      },
    ],
    propulsionTitle: 'Elétrica ou diesel — o que faz sentido em Vespasiano',
    propulsion: [
      {
        title: 'Plataformas elétricas',
        body:
          'Preferidas em galpões e áreas internas com restrição de emissão ou ruído — perfil frequente no eixo industrial de Vespasiano.',
      },
      {
        title: 'Plataformas a diesel',
        body:
          'Indicadas para áreas externas, obras e terrenos mistos. Em frentes abertas, autonomia e tração costumam pesar na escolha.',
      },
    ],
    heightsTitle: 'Alturas de trabalho frequentes em Vespasiano',
    heights: [
      {
        title: 'Faixa de 8 a 16 metros',
        body:
          'Cobre boa parte das manutenções industriais e prediais: galpões, iluminação, pintura e mezzaninos.',
      },
      {
        title: 'Faixa de 16 a 26 metros',
        body:
          'Comum em estruturas, fachadas e serviços externos. Confirme altura real e espaço para estabilizadores.',
      },
      {
        title: 'Acima de 26 metros',
        body:
          'Para frentes mais altas, a frota inclui lanças de maior alcance. Em cronogramas fechados, reservamos com antecedência pela logística a partir de BH.',
      },
    ],
    whyTitle: 'Por que locar com a Acesso em Vespasiano',
    why: [
      'Base em Belo Horizonte com entrega ágil no vetor norte (Vespasiano e entorno)',
      'Orientação técnica para galpão, fachada ou frente externa — tesoura, articulada ou telescópica',
      'Frota revisada e documentação usual de locação para apoiar a obra',
      'Diária, semanal ou mensal — valores sob consulta conforme modelo e logística',
    ],
  };
}

function applyVespasianoPlataformasOverride(base: RegiaoCategoriaContent): RegiaoCategoriaContent {
  return {
    ...base,
    metaTitle: 'Locação de plataformas elevatórias em Vespasiano',
    metaDescription: clipMetaDescription(
      'Aluguel de plataforma elevatória em Vespasiano: tesoura, articulada e telescópica. Entrega a partir de BH, frota revisada e orçamento sob consulta pela Acesso Equipamentos.',
    ),
    tagline:
      'Plataformas para indústria, galpões e obras em Vespasiano — logística a partir de Belo Horizonte.',
    intro: [
      'A Acesso Equipamentos loca plataformas elevatórias em Vespasiano com foco no vetor norte da RMBH: parque industrial, logística e obras urbanas. A operação parte da base em Belo Horizonte, com entrega alinhada ao cronograma da obra.',
      'Nesta página está o recorte local de plataformas elevatórias em Vespasiano — tipos (tesoura, articulada, telescópica e mastro), propulsão elétrica ou diesel, faixas de altura e catálogo da linha. O comercial indica o modelo conforme altura de trabalho, piso, alcance e prazo.',
      'Vespasiano concentra manutenção industrial, reforma de galpões e serviços prediais. Informe endereço, interno/externo e altura aproximada para orçamento sob consulta com disponibilidade da frota.',
      'Trabalhamos com a frota publicada no catálogo do site. Valores não são tabelados online: a proposta considera equipamento, deslocamento a partir de BH e condições do local em Vespasiano.',
    ],
    faqs: [
      {
        question: 'Vocês locam plataformas elevatórias em Vespasiano?',
        answer:
          'Sim. Atendemos Vespasiano e o entorno com entrega a partir de Belo Horizonte, conforme disponibilidade da frota e endereço da obra.',
      },
      {
        question: 'Qual a diferença entre tesoura e articulada para Vespasiano?',
        answer:
          'A tesoura sobe na vertical em áreas niveladas (galpões e plantas). A articulada contorna obstáculos e alcança pontos laterais — útil em fachadas e frentes com interferências.',
      },
      {
        question: 'Plataforma elétrica ou diesel em Vespasiano — qual escolher?',
        answer:
          'Elétrica para áreas internas e restrição de emissão. Diesel para externas e terrenos mais exigentes. Informe se o serviço é interno ou externo.',
      },
      {
        question: 'Locam plataformas para galpões industriais em Vespasiano?',
        answer:
          'Sim. Tesoura e articulada são muito usadas em manutenção e reforma de galpões. Antecipe a reserva quando o prazo da obra for apertado.',
      },
      {
        question: 'Preciso de capacitação para operar a plataforma?',
        answer:
          'Sim. A operação exige capacitação alinhada às normas aplicáveis (como NR-18). A locação inclui a documentação técnica usual do equipamento; o contratante organiza a habilitação da equipe.',
      },
      {
        question: 'Como pedir orçamento de plataforma elevatória em Vespasiano?',
        answer:
          'Pelo WhatsApp ou formulário: informe altura aproximada, interno/externo, endereço em Vespasiano e prazo. Retornamos com disponibilidade e condições sob consulta.',
      },
    ],
    enrichment: buildVespasianoPlataformasEnrichment(),
  };
}

/** Lagoa Santa × plataformas — página longa para a query “plataformas elevatórias Lagoa Santa”. */
function buildLagoaSantaPlataformasEnrichment(): RegiaoCategoriaEnrichment {
  return {
    typesTitle: 'Tipos de plataforma elevatória para Lagoa Santa',
    types: [
      {
        title: 'Plataforma tesoura em Lagoa Santa',
        body:
          'Indicada para áreas niveladas, galpões leves e interiores. Em Lagoa Santa, atende bem manutenção predial, comércio e serviços internos no eixo urbano e logístico.',
      },
      {
        title: 'Plataforma articulada em Lagoa Santa',
        body:
          'Lança flexível para fachadas, marquises e pontos com obstáculos. Útil em reformas comerciais, condomínios e frentes externas no corredor Confins.',
      },
      {
        title: 'Plataforma telescópica em Lagoa Santa',
        body:
          'Maior alcance para estruturas, obras e serviços externos. Indicamos o modelo conforme altura de trabalho e área de estabilização no local.',
      },
      {
        title: 'Plataforma tipo mastro em Lagoa Santa',
        body:
          'Opção compacta para corredores, estoques e altura moderada. Avaliamos vão e capacidade junto com o comercial.',
      },
    ],
    propulsionTitle: 'Elétrica ou diesel — o que faz sentido em Lagoa Santa',
    propulsion: [
      {
        title: 'Plataformas elétricas',
        body:
          'Preferidas em interiores, comércios e áreas com restrição de emissão ou ruído — frequente em reformas prediais e galpões leves.',
      },
      {
        title: 'Plataformas a diesel',
        body:
          'Indicadas para áreas externas, obras e terrenos mistos. Em frentes abertas no eixo Confins, autonomia e tração costumam pesar na escolha.',
      },
    ],
    heightsTitle: 'Alturas de trabalho frequentes em Lagoa Santa',
    heights: [
      {
        title: 'Faixa de 8 a 16 metros',
        body:
          'Cobre boa parte das manutenções prediais e comerciais: iluminação, pintura, fachadas baixas e mezzaninos.',
      },
      {
        title: 'Faixa de 16 a 26 metros',
        body:
          'Comum em fachadas, estruturas e serviços externos. Confirme altura real e espaço para estabilizadores.',
      },
      {
        title: 'Acima de 26 metros',
        body:
          'Para frentes mais altas, a frota inclui lanças de maior alcance. Em cronogramas fechados, reservamos com antecedência pela logística a partir de BH.',
      },
    ],
    whyTitle: 'Por que locar com a Acesso em Lagoa Santa',
    why: [
      'Base em Belo Horizonte com entrega no eixo Confins e norte da RMBH',
      'Orientação técnica para obra predial, comércio ou frente externa',
      'Frota revisada e documentação usual de locação para apoiar a obra',
      'Diária, semanal ou mensal — valores sob consulta conforme modelo e logística',
    ],
  };
}

function applyLagoaSantaPlataformasOverride(base: RegiaoCategoriaContent): RegiaoCategoriaContent {
  return {
    ...base,
    metaTitle: 'Locação de plataformas elevatórias em Lagoa Santa',
    metaDescription: clipMetaDescription(
      'Aluguel de plataforma elevatória em Lagoa Santa: tesoura, articulada e telescópica. Entrega no eixo Confins a partir de BH e orçamento sob consulta pela Acesso Equipamentos.',
    ),
    tagline:
      'Plataformas para obras urbanas, comércio e logística em Lagoa Santa — logística a partir de Belo Horizonte.',
    intro: [
      'A Acesso Equipamentos loca plataformas elevatórias em Lagoa Santa com foco no eixo norte da RMBH e no corredor do Aeroporto de Confins: obras prediais, comércio e frentes de serviço. A operação parte da base em Belo Horizonte.',
      'Nesta página está o recorte local de plataformas elevatórias em Lagoa Santa — tipos (tesoura, articulada, telescópica e mastro), propulsão elétrica ou diesel, faixas de altura e catálogo da linha. O comercial indica o modelo conforme altura de trabalho, piso, alcance e prazo.',
      'Lagoa Santa concentra reformas, fachadas e demanda ligada ao entorno aeroportuário. Informe endereço, interno/externo e altura aproximada para orçamento sob consulta com disponibilidade da frota.',
      'Trabalhamos com a frota publicada no catálogo do site. Valores são sob consulta: a proposta considera equipamento, deslocamento a partir de BH e condições do local em Lagoa Santa.',
    ],
    faqs: [
      {
        question: 'Vocês locam plataformas elevatórias em Lagoa Santa?',
        answer:
          'Sim. Atendemos Lagoa Santa e o entorno do eixo Confins com entrega a partir de Belo Horizonte, conforme disponibilidade da frota e endereço da obra.',
      },
      {
        question: 'Atendem obras no entorno do aeroporto de Confins?',
        answer:
          'Sim. A logística cobre Lagoa Santa e cidades vizinhas do corredor aeroportuário. Informe o endereço exato no orçamento para combinar a entrega.',
      },
      {
        question: 'Qual a diferença entre tesoura e articulada para Lagoa Santa?',
        answer:
          'A tesoura sobe na vertical em áreas niveladas. A articulada contorna obstáculos e alcança pontos laterais — útil em fachadas e reformas com interferências.',
      },
      {
        question: 'Plataforma elétrica ou diesel em Lagoa Santa — qual escolher?',
        answer:
          'Elétrica para áreas internas e restrição de emissão. Diesel para externas e terrenos mais exigentes. Informe se o serviço é interno ou externo.',
      },
      {
        question: 'Preciso de capacitação para operar a plataforma?',
        answer:
          'Sim. A operação exige capacitação alinhada às normas aplicáveis (como NR-18). A locação inclui a documentação técnica usual do equipamento; o contratante organiza a habilitação da equipe.',
      },
      {
        question: 'Como pedir orçamento de plataforma elevatória em Lagoa Santa?',
        answer:
          'Pelo WhatsApp ou formulário: informe altura aproximada, interno/externo, endereço em Lagoa Santa e prazo. Retornamos com disponibilidade e condições sob consulta.',
      },
    ],
    enrichment: buildLagoaSantaPlataformasEnrichment(),
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

  if (typedCity === 'brumadinho' && typedCategory === 'plataformas-elevatorias') {
    return applyBrumadinhoPlataformasOverride(base);
  }

  if (typedCity === 'santa-luzia' && typedCategory === 'plataformas-elevatorias') {
    return applySantaLuziaPlataformasOverride(base);
  }

  if (typedCity === 'ibirite' && typedCategory === 'plataformas-elevatorias') {
    return applyIbiritePlataformasOverride(base);
  }

  if (typedCity === 'vespasiano' && typedCategory === 'plataformas-elevatorias') {
    return applyVespasianoPlataformasOverride(base);
  }

  if (typedCity === 'lagoa-santa' && typedCategory === 'plataformas-elevatorias') {
    return applyLagoaSantaPlataformasOverride(base);
  }

  return base;
}

/** All static params for the S4 matrix (10 cities × 4 categories = 40 combos). */
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
