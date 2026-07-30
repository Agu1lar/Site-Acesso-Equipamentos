import type { EquipmentCategory } from '@/types/equipment';
import { EQUIPMENT_CATEGORY_ORDER } from '@/types/equipment';

export type CategorySeoFaq = {
  question: string;
  answer: string;
};

export type CategorySeoContent = {
  slug: EquipmentCategory;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  paragraphs: string[];
  faqs?: CategorySeoFaq[];
  /** Optional H2 above FAQ; falls back to i18n `seo_faq_title`. */
  faqTitle?: string;
};

/** Textos originais para SEO local por linha de negócio. */
const CATEGORIES_SEO: Record<EquipmentCategory, CategorySeoContent> = {
  'plataformas-elevatorias': {
    slug: 'plataformas-elevatorias',
    h1: 'Aluguel de plataforma elevatória em Belo Horizonte',
    metaTitle: 'Aluguel de plataforma elevatória em BH | Acesso Equipamentos',
    metaDescription:
      'Aluguel de plataforma elevatória em BH: tesoura, articulada e telescópica. Frota revisada, entrega na obra e orçamento rápido em Belo Horizonte e região.',
    paragraphs: [
      'O aluguel de plataforma elevatória (também chamada de plataforma aérea) é a solução mais usada em obras que precisam de trabalho em altura com produtividade e segurança — fachadas, instalações elétricas, estruturas metálicas, galpões e manutenção industrial. Em Belo Horizonte e na região metropolitana, a Acesso Equipamentos loca plataformas elevatórias para construtoras, empreiteiras e equipes de manutenção que querem equipamento revisado sem imobilizar capital na compra.',
      'No catálogo você encontra plataforma tesoura, lança articulada, lança telescópica e mastro vertical, em diferentes alturas de trabalho e capacidades. Use os filtros por tipo e altura para comparar modelos. Na cotação, informamos valores sob consulta conforme período (diária, semanal ou mensal), logística de entrega e retirada e condições do terreno — o comercial indica o equipamento adequado ao vão, ao piso e ao alcance necessário.',
      'Antes de fechar o aluguel de plataforma elevatória, vale definir altura de trabalho, tipo de piso, necessidade de deslocamento na obra e se haverá operador capacitado. Trabalhar em altura exige planejamento: análise do solo, isolamento da área, EPIs e conformidade com as normas aplicáveis. A Acesso Equipamentos, fundada em 2013, orienta sobre documentação usual de locação e boas práticas do setor.',
      'Além da locação, oferecemos treinamento em operação segura de plataformas elevatórias, alinhado à NR-18 e ao trabalho em altura. Veja os modelos abaixo, consulte a página de treinamento ou peça orçamento pelo formulário e WhatsApp comercial.',
    ],
    faqTitle: 'Perguntas frequentes sobre aluguel de plataforma elevatória',
    faqs: [
      {
        question: 'Quanto custa o aluguel de plataforma elevatória?',
        answer:
          'Os valores são sob consulta. O preço do aluguel de plataforma elevatória depende do modelo (tesoura, articulada ou telescópica), da altura, do período de locação e da logística de entrega em Belo Horizonte ou na região. Envie o tipo de serviço e o prazo pelo formulário ou WhatsApp para receber a proposta.',
      },
      {
        question: 'Qual a diferença entre plataforma tesoura e articulada?',
        answer:
          'A plataforma tesoura sobe na vertical e é ideal para trabalhos em linha reta com boa capacidade de carga. A articulada (lança) contorna obstáculos e alcança pontos laterais, útil em fachadas e áreas com interferências. Na dúvida, nossa equipe indica o modelo no orçamento.',
      },
      {
        question: 'Vocês fazem aluguel de plataforma elevatória em Belo Horizonte?',
        answer:
          'Sim. Atendemos Belo Horizonte, Contagem, Betim, Nova Lima e demais cidades da região metropolitana, com entrega e retirada na obra conforme disponibilidade da frota. Informe o endereço da obra na solicitação de orçamento.',
      },
      {
        question: 'Preciso de operador para locar a plataforma elevatória?',
        answer:
          'A operação deve ser feita por profissional capacitado, com atenção às normas de trabalho em altura. Orientamos sobre requisitos usuais na locação; a responsabilidade pelo uso seguro na obra permanece com o contratante, salvo disposição contratual específica. Também oferecemos treinamento em plataformas aéreas.',
      },
    ],
  },
  'guindaste-industrial': {
    slug: 'guindaste-industrial',
    h1: 'Locação de guindaste industrial e remoção técnica em BH',
    metaTitle: 'Locação de guindaste industrial em BH | Acesso Equipamentos',
    metaDescription:
      'Locação de guindaste industrial e remoção técnica de cargas pesadas em Belo Horizonte, Minas Gerais e em todo o Brasil.',
    paragraphs: [
      'A locação de guindaste industrial e equipamentos para remoção técnica atende operações que exigem movimentação segura de cargas pesadas, máquinas industriais, estruturas metálicas, geradores, transformadores e materiais de grande porte. Em Belo Horizonte e em todo o território nacional, a Acesso Equipamentos apoia empresas que precisam de içamento, carga, descarga e transporte com equipe especializada.',
      'O dimensionamento do serviço considera peso da carga, raio de operação, acesso ao local, interferências no entorno e necessidade de programação logística. Esses dados ajudam a definir o equipamento mais adequado e reduzem riscos em remoções industriais, manutenções, montagens de estruturas, obras civis e movimentações emergenciais.',
      'Locar guindaste evita investimento em equipamento próprio e permite contratar a solução conforme a demanda de cada projeto. A operação deve ser planejada com responsáveis técnicos, isolamento de área, acessórios compatíveis e profissionais habilitados para garantir produtividade e segurança.',
      'Solicite orçamento informando cidade, endereço de atendimento, peso aproximado da carga, dimensões, fotos do local e prazo desejado. Nossa equipe comercial retorna com disponibilidade, condições e orientações para programar o serviço.',
    ],
  },
  'manipuladores-telescopicos': {
    slug: 'manipuladores-telescopicos',
    h1: 'Locação de manipuladores telescópicos em Belo Horizonte',
    metaTitle: 'Locação de manipuladores telescópicos | Acesso Equipamentos',
    metaDescription:
      'Aluguel de manipuladores telescópicos para movimentação de cargas em obra, indústria e logística em BH, Minas Gerais e em todo o Brasil.',
    paragraphs: [
      'Manipuladores telescópicos — também conhecidos como telehandlers — combinam alcance, elevação e capacidade de carga para movimentar materiais em canteiros, galpões, pátios logísticos e ambientes industriais. A locação permite dimensionar o equipamento conforme altura, peso e tipo de acessório necessário em cada fase da obra.',
      'A Acesso Equipamentos atende demandas de manipuladores telescópicos em Belo Horizonte, Minas Gerais e em todo o território nacional. Na cotação, informe altura de trabalho, carga máxima, tipo de terreno e período de locação para indicarmos o modelo disponível na frota ou a alternativa mais próxima.',
      'A operação segura exige operador capacitado, inspeção pré-uso, estabilização adequada e respeito aos limites de carga e alcance indicados pelo fabricante. Nossa equipe comercial orienta sobre documentação, logística de entrega e retirada e condições de locação sob consulta.',
      'Consulte o catálogo desta linha abaixo ou fale com o comercial para verificar disponibilidade e datas. Empresa fundada em 2013, com atendimento ágil por telefone, e-mail e WhatsApp em horário útil.',
    ],
  },
  andaimes: {
    slug: 'andaimes',
    h1: 'Locação de andaimes em Belo Horizonte',
    metaTitle: 'Locação de andaimes em BH | Acesso Equipamentos',
    metaDescription:
      'Aluguel de andaimes, tubos, escoras e sistemas de acesso para obras em Belo Horizonte, Minas Gerais e em todo o Brasil.',
    paragraphs: [
      'Andaimes tubulares, escoras metálicas, treliças e componentes de acesso vertical são a base para execução segura de serviços em fachadas, caixas de elevador, passarelas temporárias e diversas frentes de obra. Em Belo Horizonte e em todo o território nacional, a locação de andaimes atende desde reformas residenciais até empreendimentos de médio porte que exigem montagem planejada e fornecimento em quantidade.',
      'A Acesso Equipamentos trabalha com linha ampla de peças para montagem de andaimes e estruturas de apoio, com catálogo que inclui tubos, pisos metálicos, rodas, diagonais e acessórios. O dimensionamento da quantidade deve considerar altura, carga de trabalho e normas técnicas aplicáveis ao tipo de montagem — recomendamos envolver profissional habilitado no projeto do andaime.',
      'A montagem e desmontagem de andaimes são atividades de risco e devem ser executadas por equipe treinada, com projeto quando exigido. Fornecemos os componentes em locação; a responsabilidade pela montagem conforme normas e pelo uso seguro permanece com o contratante da obra, salvo disposição contratual específica.',
      'Veja os itens de andaimes listados abaixo. Para demandas grandes ou longo período, solicite proposta formal com lista de peças e cronograma de entrega.',
    ],
  },
  'ferramentas-eletricas': {
    slug: 'ferramentas-eletricas',
    h1: 'Locação de ferramentas elétricas para obra em Belo Horizonte',
    metaTitle: 'Locação de ferramentas elétricas em BH | Acesso Equipamentos',
    metaDescription:
      'Aluguel de marteletes, serras, betoneiras, compressores e ferramentas elétricas para construção civil em BH, Minas Gerais e em todo o Brasil.',
    paragraphs: [
      'Ferramentas elétricas — marteletes, serras, lixadeiras, compressores, betoneiras, vibradores e equipamentos portáteis — são o coração da produtividade em reformas e obras de acabamento. Locar esses itens é prática comum entre pedreiros, empreiteiras e equipes de manutenção que precisam de ferramenta confiável por dias ou semanas, não por anos.',
      'A Acesso Equipamentos oferece em Belo Horizonte, Minas Gerais e em todo o território nacional um catálogo extenso de ferramentas elétricas para locação, com valores sob consulta conforme modelo e período. Ao pedir orçamento, indique voltagem disponível no local, tipo de serviço e se há necessidade de acessórios (brocas, discos, mangueiras).',
      'Revise o estado do equipamento na retirada ou na entrega, utilize EPIs adequados e respeite as instruções de uso. Devoluções fora do prazo ou com danos podem gerar cobranças adicionais conforme contrato — nossa equipe comercial esclarece as condições no momento da locação.',
      'Por concentrar também plataformas elevatórias, andaimes e guindastes, a Acesso reduz a fragmentação de fornecedores em obras que exigem máquinas leves e pesadas ao mesmo tempo. Atendimento em horário comercial e contato via WhatsApp para demandas urgentes dentro da disponibilidade da frota.',
    ],
  },
  'ferramentas-combustao': {
    slug: 'ferramentas-combustao',
    h1: 'Locação de ferramentas à combustão em Belo Horizonte',
    metaTitle: 'Locação de ferramentas à combustão em BH | Acesso Equipamentos',
    metaDescription:
      'Aluguel de geradores, compactadores, roçadeiras e ferramentas à combustão para obras em BH, Minas Gerais e em todo o Brasil.',
    paragraphs: [
      'Ferramentas e máquinas à combustão — geradores, placas vibratórias, roçadeiras e cortadoras a gasolina — atendem obras sem rede elétrica disponível ou que exigem mobilidade e potência em campo. A locação permite usar o equipamento no período necessário, com custo previsível e sem imobilizar capital em compra.',
      'Na Acesso Equipamentos, esta linha reúne equipamentos para compactação, geração de energia e serviços externos em Belo Horizonte, Minas Gerais e em todo o território nacional. Informe tipo de serviço, autonomia desejada, local de uso e período de locação para montarmos a proposta.',
      'O uso seguro exige operador capacitado, ventilação adequada em ambientes fechados, abastecimento correto e manutenção conforme manual do fabricante. EPIs e isolamento da área de trabalho são obrigatórios conforme a atividade.',
      'Consulte o catálogo de ferramentas à combustão abaixo e solicite orçamento pelo formulário, telefone ou WhatsApp comercial.',
    ],
  },
};

export { isEquipmentCategory } from '@/types/equipment';

export function getCategorySeo(slug: EquipmentCategory): CategorySeoContent {
  return CATEGORIES_SEO[slug];
}

export const ALL_EQUIPMENT_CATEGORIES = EQUIPMENT_CATEGORY_ORDER;
