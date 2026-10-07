import { hasEquipmentLongDescription, isThinLongDescription } from '@/lib/equipment-long-description';
import type { Equipment } from '@/types/equipment';

const BH_REGION = 'Belo Horizonte e região metropolitana';

type EquipmentSeoExtra = {
  title: string;
  paragraphs: string[];
  /** When true, the page already shows a technical block — use i18n title instead of `title`. */
  commercialOnly?: boolean;
};

const SLUG_SEO_EXTRA: Partial<Record<string, EquipmentSeoExtra>> = {
  'franna-fr17': {
    title: 'Locação de guindaste Franna FR17 pick and carry em Belo Horizonte',
    paragraphs: [
      `O Franna FR17 é guindaste móvel pick and carry da Terex, com capacidade nominal de 17 toneladas e lança de até 20,40 m — indicado para içamento, carga e descarga sem estabilizadores em obras e indústria em ${BH_REGION}.`,
      `Informe peso da carga, raio de operação e endereço da obra para proposta com logística de entrega. Valores e período mínimo sob consulta com nossa equipe comercial.`,
    ],
  },
  'plataforma-elevatoria-s80': {
    title: 'Locação de plataforma telescópica Genie S-85 XC E em Belo Horizonte',
    paragraphs: [
      `A Genie S-85 XC E é lança telescópica elétrica com altura de trabalho de 27,91 m e alcance horizontal de 22,71 m — ideal para manutenções e montagens com baixa emissão em ${BH_REGION}.`,
      `Combine locação com treinamento de operadores alinhado à NR-18 quando necessário. Solicite orçamento informando endereço, datas e altura de trabalho.`,
    ],
  },
  'plataforma-elevatoria-s80-j': {
    title: 'Locação de plataforma telescópica Genie S-80 J em Belo Horizonte',
    paragraphs: [
      `A Genie S-80 J é uma lança telescópica com jib, altura de trabalho de 26,51 m, alcance horizontal de 16,69 m e capacidade de 300 kg — indicada para obras externas e manutenção industrial em ${BH_REGION}.`,
      `Nossa equipe comercial orienta sobre documentação, entrega na obra e condições de locação sob consulta.`,
    ],
  },
  'plataforma-elevatoria-gs4655': {
    title: 'Locação de plataforma tesoura Genie GS-4655 em Belo Horizonte',
    paragraphs: [
      `A Genie GS-4655 E-Drive é tesoura elétrica com altura de trabalho de 15,95 m em uso interno e capacidade de 350 kg — indicada para galpões e obras com piso firme em ${BH_REGION}.`,
      `Informe altura necessária, ambiente (interno/externo) e período de locação para montarmos a proposta.`,
    ],
  },
  'plataforma-elevatoria-1350sjp': {
    title: 'Locação de plataforma telescópica JLG 1350SJP em Belo Horizonte',
    paragraphs: [
      `O JLG 1350SJP Ultra Boom é lança telescópica com altura de plataforma de 41,30 m e alcance horizontal de 24,38 m — para obras de grande altura e manutenções industriais em ${BH_REGION}.`,
      `Solicite orçamento com endereço da obra, datas e descrição do serviço. Atendimento comercial em horário útil por telefone, e-mail e WhatsApp.`,
    ],
  },
  'manipulador-telescopico-mxt840': {
    title: 'Locação de manipulador telescópico Manitou MXT 840 em Belo Horizonte',
    paragraphs: [
      `O Manitou MXT 840 movimenta até 4.000 kg com elevação de 7,60 m e alcance de 4,23 m — indicado para carga e descarga, posicionamento de materiais e obras com terreno irregular em ${BH_REGION}.`,
      `Informe carga máxima, altura de trabalho e tipo de acessório para proposta com disponibilidade e logística de entrega.`,
    ],
  },
};

const CATEGORY_EXTRA: Partial<Record<Equipment['category'], EquipmentSeoExtra>> = {
  'ferramentas-eletricas': {
    title: 'Locação de ferramentas elétricas em Belo Horizonte',
    paragraphs: [
      `Ferramentas elétricas em locação reduzem custo fixo em obras com demanda variável em ${BH_REGION}. Informe voltagem no canteiro, tipo de serviço e período de uso para montarmos proposta com o equipamento compatível.`,
    ],
  },
  andaimes: {
    title: 'Locação de andaimes em Belo Horizonte',
    paragraphs: [
      `Andaimes e componentes de acesso temporário para fachadas e frentes de obra em ${BH_REGION}. Envie lista de peças, altura e prazo para orçamento com entrega programada.`,
    ],
  },
  'guindaste-industrial': {
    title: 'Locação de guindaste industrial em Belo Horizonte',
    paragraphs: [
      `Guindaste industrial e içamento técnico em ${BH_REGION}. Informe peso da carga, raio de operação e endereço da obra para proposta com equipe especializada.`,
    ],
  },
  'ferramentas-combustao': {
    title: 'Locação de ferramentas à combustão em Belo Horizonte',
    paragraphs: [
      `Geradores, compactadores e máquinas à combustão para obras sem rede elétrica em ${BH_REGION}. Informe autonomia, tipo de serviço e local de uso.`,
    ],
  },
  'manipuladores-telescopicos': {
    title: 'Locação de manipuladores telescópicos em Belo Horizonte',
    paragraphs: [
      `Manipuladores telescópicos (telehandlers) para movimentação de cargas em canteiros, galpões e pátios logísticos em ${BH_REGION}. Informe capacidade, altura de elevação e período de locação.`,
    ],
  },
};

function commercialOnlyExtra(paragraphs: string[]): EquipmentSeoExtra | null {
  if (paragraphs.length === 0) {
    return null;
  }
  return {
    title: '',
    paragraphs,
    commercialOnly: true,
  };
}

/**
 * Optional extra SEO block on equipment detail pages (category-specific copy).
 */
export function getEquipmentSeoExtra(equipment: Equipment): EquipmentSeoExtra | null {
  const hasRichTechnical =
    hasEquipmentLongDescription(equipment) && !isThinLongDescription(equipment);
  const slugExtra = SLUG_SEO_EXTRA[equipment.slug];
  if (slugExtra) {
    if (hasRichTechnical) {
      return commercialOnlyExtra(slugExtra.paragraphs.slice(1));
    }
    return slugExtra;
  }

  if (equipment.category === 'plataformas-elevatorias') {
    return {
      title: 'Locação de plataformas elevatórias em Belo Horizonte',
      paragraphs: [
        `Para serviços em altura, combine o equipamento com treinamento de operadores alinhado à NR-18 quando necessário. Entrega e retirada são programadas com o responsável pela obra; valores e período mínimo de locação sob consulta com nossa equipe comercial.`,
        `Solicite orçamento informando endereço da obra, datas e descrição do serviço. Se preferir resposta imediata, use o WhatsApp com o nome deste equipamento — o atendimento funciona em horário útil com foco em construção civil e indústria em Minas Gerais.`,
      ],
    };
  }

  const categoryExtra = CATEGORY_EXTRA[equipment.category];
  if (categoryExtra && hasRichTechnical) {
    return null;
  }

  return categoryExtra ?? null;
}
